# Bilibili Helper (Audited)

A conservative, self-hosted Surge implementation of Bilibili content filters based on the observable API behavior of Maasea's Bilibili Helper, without copying the large minified runtime. **Not an official Bilibili module.**

Source reviewed: https://github.com/Maasea/sgmodule/blob/master/Bilibili.Helper.sgmodule and its Script/Bilibili/bilibili.helper.js / bilibili.helper.v2.js (Maasea source licensed Apache-2.0).

## Modules

- Full set: `https://raw.githubusercontent.com/qweaszxcdf/Misc/main/Bilibili.Helper.Audited.sgmodule`
- Splash only: `https://raw.githubusercontent.com/qweaszxcdf/Misc/main/Bilibili.Splash.Audited.sgmodule`
- PCDN domain blocking only: `https://raw.githubusercontent.com/qweaszxcdf/Misc/main/Bilibili.P2P.Optional.sgmodule`

Install **only one** of the full or splash-only modules. The full module already includes the PCDN domain rule; do not install the optional PCDN rule on top of it.

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
