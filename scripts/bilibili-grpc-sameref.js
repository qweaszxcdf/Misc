'use strict';
// Diagnostic only: return exactly the original Uint8Array reference.
// No copying, parsing or content modification. Do not use for daily browsing.
(function(){
  try {
    const body=$response && $response.body;
    const status=String($response && ($response.status || $response.statusCode) || '');
    if(!/(?:^|\s)200(?:\s|$)/.test(status) || !(body instanceof Uint8Array) || !body.length)
      return $done({});
    return $done({body:body});
  } catch(e) {
    console.log('Bilibili SameReference passthrough: '+String(e).slice(0,80));
    return $done({});
  }
})();
