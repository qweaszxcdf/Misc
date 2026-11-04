# Bilibili Helper (Audited)

A conservative, self-hosted Surge implementation of Bilibili content filters based on the observable API behavior of Maasea's Bilibili Helper, without copying the large minified runtime. **Not an official Bilibili module.**

Source reviewed: https://github.com/Maasea/sgmodule/blob/master/Bilibili.Helper.sgmodule and its Script/Bilibili/bilibili.helper.js / bilibili.helper.v2.js (Maasea source licensed Apache-2.0).

## Modules

- Fast default: `https://raw.githubusercontent.com/qweaszxcdf/Misc/main/Bilibili.Helper.Audited.sgmodule`
- Full experimental: `https://raw.githubusercontent.com/qweaszxcdf/Misc/main/Bilibili.Helper.Full.Experimental.sgmodule`
- Splash only: `https://raw.githubusercontent.com/qweaszxcdf/Misc/main/Bilibili.Splash.Audited.sgmodule`
- PCDN domain blocking only: `https://raw.githubusercontent.com/qweaszxcdf/Misc/main/Bilibili.P2P.Optional.sgmodule`

Install **only one** of Fast, Full, or Splash. The Full module already includes the PCDN domain rule. Fast does not include PCDN blocking.

## Features

- Startup splash: a Map Local response for `/x/v2/splash/show`; list, event, and brand responses filtered selectively.
- Search JSON: remove `data.item[]` entries whose `linktype` ends with `_ad`, plus explicit `is_ad` entries.
- Feed JSON: remove `data.items[]` cards whose `card_type` indicates banner or CM advertisement.
- gRPC DmView: remove command / interactive danmaku field 1 under field 22.
- Teenager ModeStatus: neutralize the `teenagers` mode flag, not all modes.
- View details: remove commercial fields 30, 31, 41.
- ViewProgress: remove DM field 1.
- Comment MainList: remove commercial field 11.
- gRPC SearchAll: remove item field 4 when nested `linktype` ends with `_ad`.
- Dynamic DynAll: remove dynamic cards of type 15 (ad), retaining other cards.
- ViewUnite: remove CM field 7; in related recommendations keep AV card type 1 for the relevant module only.
- PCDN domain rule blocks wildcard `*pcdn*.biliapi.net`. This may impact connectivity on certain networks.

## Playback safety

No request-header spoofing: no `x-tf-isp` override and no `x-bili-network-bin` replacement. Original Maasea's network-header changes are outside the ad filtering logic and can affect regional/CDN routing.

The gRPC filter is intentionally **fail open** for compressed messages, multiple frames, invalid protobuf, error status, unexpected fields, and oversized responses. Only uncompressed single-message gRPC responses are processed. No external HTTP calls, token access, or persistent storage.

The module requires Surge MITM with HTTP/2 inspection enabled and the user's MITM certificate trusted. Body buffer cap: 2 MiB, unlike unlimited buffering in the source module.

## Limitations

The field IDs were extracted from Maasea's bundled schema and may change with Bilibili app versions; automatic removal is not guaranteed. Video details and related-recommendation filtering may also remove non-ad promotional UI. This is locally fixture-tested, **not verified on an iPhone**. For regressions, turn off the full module and try splash-only; then isolate individual gRPC paths. Avoid enabling another Bilibili rewrite module at the same time.

Test with `node --test tests/bilibili-helper.test.cjs`.

## 2026-11-04: Delayed video descriptions and comments

Observed on device: both the upstream Maasea module and the former full audited module delayed video descriptions and comment loading.

**Updated from controlled on-device tests:** MITM-only and `requires-body=1` with `$done({})` both load normally, while returning a cloned-but-byte-identical `$done({body})` causes delay. The observed issue is associated with **Surge response-body replacement**, not merely HTTPS MITM or body buffering. The internal cause has not been independently verified. See [gRPC diagnostics](Bilibili.gRPC.Diagnostic.README.md).

The default `Bilibili.Helper.Audited.sgmodule` is now **Fast**:
- Retains splash, search, feed JSON filtering on `app.bilibili.com`.
- **No** `grpc.biliapi.net` in MITM; no gRPC scripts.
- **No** PCDN domain rejection by default, to avoid altering other network paths during isolation.
- Loses gRPC-only processing of comment ads, detail ads, interactive danmaku, teen popup, gRPC search ads and dynamic ads.

Full gRPC functionality remains available in `Bilibili.Helper.Full.Experimental.sgmodule` but may incur latency. PCDN hostname rejection is separately available in `Bilibili.P2P.Optional.sgmodule`.

Only enable **one** of Fast / Full / Splash. If comments are still slow with Fast, confirm the old module is disabled and check other modules/profile-level `[MITM]` entries for `grpc.biliapi.net` and whether your proxy routes Bilibili traffic differently. Surge's response-body buffering is documented: https://manual.nssurge.com/scripting/http-response.html

## Final gRPC latency isolation (2026-11-04)

After MITM-only, no-op, identity, and SameReference tests, the user confirmed that **even returning the original binary body reference** with `$done({body:$response.body})` delays descriptions/comments. No-op `$done({})` does not. Thus the observed issue is associated with HTTP-response body replacement rather than gRPC MITM or full body buffering alone. Internal root cause is not confirmed. **Keep Fast for daily use.** See the [diagnostic summary](Bilibili.gRPC.Diagnostic.README.md) and [Surge reproduction](Bilibili.gRPC.Surge.Repro.md).
