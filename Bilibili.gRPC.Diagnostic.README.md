# Bilibili gRPC latency isolation tests

These modules diagnose reported **slow video introductions and comments**, which recovered after disabling `grpc.biliapi.net` HTTPS MITM and gRPC response scripts. This is not an isolated root-cause proof: either MITM/HTTP2 interception itself or `requires-body=1` response processing may be responsible.

## Controlled comparison

Keep `Bilibili.Helper.Audited.sgmodule` (**Fast**) enabled as the stable baseline. Disable the Maasea original, Full Experimental and all other Bilibili gRPC modules. In each test, enable **exactly one** module below, reload Surge configuration, fully close the Bilibili app, reopen, and compare the time taken for **video description** and **comments** to become visible. Use the same video and network/proxy route.

| Test | Module URL | gRPC MITM | Intercepted response bodies |
|---|---|---|---|
| A, control | none (Fast only) | No | None |
| B | https://raw.githubusercontent.com/qweaszxcdf/Misc/main/Bilibili.gRPC.Diagnostic.MITM.sgmodule | Yes | None |
| C | https://raw.githubusercontent.com/qweaszxcdf/Misc/main/Bilibili.gRPC.Diagnostic.SearchDynamic.sgmodule | Yes | SearchAll + DynAll only |
| D | https://raw.githubusercontent.com/qweaszxcdf/Misc/main/Bilibili.gRPC.Diagnostic.VideoDetail.sgmodule | Yes | View/View + ViewUnite/View only |
| E | https://raw.githubusercontent.com/qweaszxcdf/Misc/main/Bilibili.gRPC.Diagnostic.Comments.sgmodule | Yes | Reply/MainList only |

### Interpreting observations

- **B slows down vs A:** gRPC hostname-wide MITM (and HTTP/2 interception) is a likely source. Even C-E only target specific URLs in the response scripts, but **MITM occurs for all URLs on that hostname**. It cannot be limited by URL path through the hostname entry.
- **B normal, C normal, D slow:** video-detail response-body buffering / rewriting is strongly implicated.
- **B normal, C normal, E slow:** comment response-body buffering / rewriting is strongly implicated.
- **B normal, C slow:** potentially the search/dynamic scripts or gRPC stream interaction; check request log before attributing.
- **All tests normal but Full Experimental slow:** possible interaction among simultaneously intercepted routes, the additional gRPC paths (DmView/Teenagers/ViewProgress) or PCDN rule.

**Important:** This is a diagnosis, not a measured performance claim. Since the scripts may modify legitimate promotional data and use buffer size 1 MiB, unexpected responses pass through unchanged. These modules do not change request headers or add PCDN rules. Do not run more than one diagnostic module simultaneously. To preserve low latency in daily use, use Fast only.

Relevant maintained files: [Fast](Bilibili.Helper.Audited.sgmodule), [Full Experimental](Bilibili.Helper.Full.Experimental.sgmodule), [gRPC script](scripts/bilibili-helper-grpc.js). No existing files are modified by these diagnostics.

## D/E follow-up: distinguish script startup, body buffering and protobuf editing

If **B (MITM-only) is normal**, but D or E causes loading delays, three mechanisms remain plausible: script startup/queueing, full-response buffering (`requires-body=1`), or actual protobuf rewriting.

The following additional controls are **pass-through** (`$done({})`) and do not alter any response.

| Endpoint | Headers-only no-op (`requires-body=0`) | Body-buffer no-op (`requires-body=1`) | Actual rewriting |
|---|---|---|---|
| Video detail / intro | [Detail Headers](Bilibili.gRPC.Diagnostic.VideoDetail.HeadersNoop.sgmodule) | [Detail Body](Bilibili.gRPC.Diagnostic.VideoDetail.BodyNoop.sgmodule) | [D: Detail Rewrite](Bilibili.gRPC.Diagnostic.VideoDetail.sgmodule) |
| Comments | [Comments Headers](Bilibili.gRPC.Diagnostic.Comments.HeadersNoop.sgmodule) | [Comments Body](Bilibili.gRPC.Diagnostic.Comments.BodyNoop.sgmodule) | [E: Comments Rewrite](Bilibili.gRPC.Diagnostic.Comments.sgmodule) |

### Suggested test sequence

Keep **Fast** active and turn off all other gRPC test modules. For the endpoint where D or E causes delay:

1. Confirm B (MITM-only) still loads normally.
2. Test the corresponding **HeadersNoop** module.
3. Test the corresponding **BodyNoop** module.
4. Compare with D/E actual rewrite.

| Observed result | Most likely source |
|---|---|
| HeadersNoop delayed, but MITM-only normal | Script scheduling / WebView engine startup or HTTP-response script path |
| HeadersNoop normal, BodyNoop delayed | Buffering the complete gRPC response or transferring binary body to the script |
| Both Noop modes normal, actual rewrite delayed | Protobuf code or rewritten-response handling |
| All normal during retest | Intermittent network/app effects, cached sessions, or another module interaction |

Surge documentation: https://manual.nssurge.com/scripting/http-response.html states that body scripts buffer the whole (decompressed) response, while header-only scripts run at response header arrival. If a second profile-level response script matches the same URL, only the first enabled script runs; verify execution in Surge's HTTP request details. These tests do **not** show live per-request timings by themselves, and the no-op script does not log URLs or sensitive contents.

**Caution:** using `requires-body=1` on large or streaming gRPC payloads can cause a delay even when returning the body unchanged; do not keep diagnostic modules enabled for daily use.
