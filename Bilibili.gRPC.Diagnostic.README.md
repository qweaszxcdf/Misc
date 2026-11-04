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
