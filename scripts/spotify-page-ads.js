'use strict';
// Experimental protobuf page-ad removal. Only removes complete wire-type-2 fields.
// The numeric field tags originate from the upstream Amlabort implementation;
// they have not been confirmed against Spotify's official protobuf schema.
(function () {
  try {
    const url = $request && $request.url || '';
    const response = $response || {};
    const status = Number(response.status || response.statusCode);
    if (status !== 200 || !(response.body instanceof Uint8Array)) return $done({});
    const spec = /\/browsita\/v[^/]+\/browse(?:\?|$)/.test(url)
      ? {tag: 6, minSize: 12001, kind: 'search'}
      : /\/casita\/v[^/]+\/home\/default(?:\?|$)/.test(url)
      ? {tag: 21, minSize: 0, kind: 'home'}
      : /\/scrollsita\/v[^/]+\/scroll\/spotify(?:\?|$)/.test(url)
      ? {tag: 30, minSize: 0, kind: 'scroll'} : null;
    if (!spec) return $done({});
    const src = response.body;
    // A small budget avoids excessive parsing on the network extension.
    if (!src.length || src.length > 1048576) return $done({});
    const result = modifyMessage(src, spec, 0, 0);
    if (result.matches > 0 && result.matches <= 16 && result.bytes.length < src.length)
      return $done({body: result.bytes});
    $done({});
  } catch (e) {
    console.log('Spotify page ads: bypass malformed or unsupported message: ' + String(e).slice(0, 100));
    $done({});
  }
})();
function uint(n) {
  const out = [];
  do {const x = n % 128; n = Math.floor(n / 128); out.push(n ? x | 128 : x);} while (n);
  return Uint8Array.from(out);
}
function join(parts) {
  const n = parts.reduce((s, p) => s + p.length, 0);
  const b = new Uint8Array(n); let i = 0;
  for (const p of parts) { b.set(p, i); i += p.length; }
  return b;
}
function varint(b, i) {
  let v = 0, factor = 1;
  for (let j = 0; j < 5 && i < b.length; j++) {
    const x = b[i++]; v += (x & 127) * factor;
    if (v > 4294967295) throw Error('varint overflow');
    if (!(x & 128)) return [v, i];
    factor *= 128;
  }
  throw Error('invalid varint');
}
function parse(b) {
  let i = 0, out = [];
  while (i < b.length) {
    const start = i, t = varint(b, i), tag = t[0]; i = t[1];
    const id = Math.floor(tag / 8), wire = tag % 8;
    if (!id) throw Error('zero field');
    let content = i;
    if (wire === 2) {
      const l = varint(b, i); i = l[1]; content = i; i += l[0];
    } else if (wire === 0) {
      let terminated = false;
      for (let j = 0; j < 10 && i < b.length; j++) {
        if (!(b[i++] & 128)) { terminated = true; break; }
      }
      if (!terminated) throw Error('invalid value');
    } else if (wire === 1) i += 8;
    else if (wire === 5) i += 4;
    else throw Error('unsupported wire type');
    if (i > b.length) throw Error('truncated');
    out.push({id, wire, start, end: i, content});
    if (out.length > 25000) throw Error('too many fields');
  }
  return out;
}
function modifyMessage(src, spec, base, depth) {
  const fs = parse(src), out = [];
  let matches = 0, last = 0;
  for (const f of fs) {
    if (f.wire !== 2) continue;
    let replacement = null;
    const payloadSize = f.end - f.content;
    if (base + f.start < 666 && f.id === spec.tag && payloadSize >= spec.minSize) {
      replacement = new Uint8Array(0);
      matches++;
    } else if (depth < 5 && payloadSize >= 2 && payloadSize <= 262144 && base + f.content < 666) {
      // A nested candidate must itself be a complete valid protobuf message.
      try {
        const child = modifyMessage(src.subarray(f.content, f.end), spec, base + f.content, depth + 1);
        if (child.matches) {
          replacement = join([uint(f.id * 8 + 2), uint(child.bytes.length), child.bytes]);
          matches += child.matches;
        }
      } catch (_) { /* text/blob, not a nested protobuf message */ }
    }
    if (replacement !== null) {
      out.push(src.subarray(last, f.start), replacement);
      last = f.end;
    }
  }
  if (!matches) return {bytes: src, matches: 0};
  out.push(src.subarray(last));
  return {bytes: join(out), matches};
}
