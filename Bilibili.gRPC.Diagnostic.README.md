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

## Rewriting probe after Noop tests

Observation supplied by the tester: MITM-only and both Noop modes load normally; real D/E protobuf edits delay descriptions/comments.

This narrows the issue to returning a rewritten response or removing original protobuf fields, **not** to MITM and not to `requires-body=1` alone.

Two probes are provided for each endpoint:

| Endpoint | Identity rewrite (returns a copy of unchanged body) | Same-length retag (experimental) |
|---|---|---|
| Detail: View/View and ViewUnite/View | [Detail Identity](Bilibili.gRPC.Diagnostic.Detail.Identity.sgmodule) | [Detail Retag](Bilibili.gRPC.Diagnostic.Detail.Retag.sgmodule) |
| Comments: Reply/MainList | [Comments Identity](Bilibili.gRPC.Diagnostic.Comments.Identity.sgmodule) | [Comments Retag](Bilibili.gRPC.Diagnostic.Comments.Retag.sgmodule) |

**Do not enable both at once.** Retag rewrites the protobuf tag of known commercial fields, leaving their payload and entire gRPC body length unchanged, so the client treats them as unknown fields (assuming the new IDs are unused). It does **not** rewrite gRPC frame length or manually alter HTTP headers.

- If **Identity delays**, even unchanged bytes returned through `$done({body})` can trigger the issue; do not proceed with Protobuf edits until the response replacement path is understood.
- If **Identity is normal but Retag delays**, missing field semantics, missing advertising state, or client retries are suspected. Avoid removing these fields.
- If **Identity and Retag are both normal but D/E delays**, a shorter rewritten gRPC message / changed framing is a plausible explanation (or original transform differs on real responses). Investigate HTTP response headers, trailers and client requests in Surge captures before adopting retag.
- If **Retag is normal**, that does **not prove** advertisements are removed correctly. Check actual appearance and playback.

Retag uses field IDs 190/191/192 in ViewReply, field 15 in ViewUniteReply, and field 15 in MainListReply. These IDs are presumed unused based on the old extracted schema; newer versions may define them. The script refuses to modify when those IDs already appear at the top level. Treat as **temporary research code**, not a production fix.

Neither module records response contents or sensitive data. Use one profile-level HTTP response script per request; Surge only executes the first matching enabled script.

## Confirmed user observation: identity body replacement also delays (2026-11-04)

On the user's iPhone/Surge configuration:
- MITM-only is normal.
- Header-no-op (`requires-body=0`, `$done({})`) is normal.
- Body-no-op (`requires-body=1`, `$done({})`) is normal.
- Identity rewrite (`$done({body: new Uint8Array($response.body)})`) **delays video descriptions or comments**, despite identical bytes.
- Actual field deletion D/E also delays.

**Interpretation:** The observed slowdown correlates with returning a `body` replacement to Surge, not with Protobuf parsing, invalid gRPC frame length, or field deletion. This does not prove an internal Surge bug; the internal reason remains unverified.

### Last isolation test: return original body reference directly

| Endpoint | Copying identity | Same-reference identity |
|---|---|---|
| Video detail | [existing](Bilibili.gRPC.Diagnostic.Detail.Identity.sgmodule) | [new](Bilibili.gRPC.Diagnostic.Detail.SameReference.sgmodule) |
| Comments | [existing](Bilibili.gRPC.Diagnostic.Comments.Identity.sgmodule) | [new](Bilibili.gRPC.Diagnostic.Comments.SameReference.sgmodule) |

The new script returns `$done({body:$response.body})` **without** `new Uint8Array`, cloning, parsing or rewriting. It never modifies the underlying buffer.

- **If SameReference also delays:** JavaScript copying can be ruled out for these tests; the HTTP-response body replacement interface is strongly implicated. Stop rewriting these gRPC response bodies in a production module.
- **If SameReference is normal:** copying the body or its serialization/cross-context handling is implicated. Further targeted testing is necessary before treating this as a working ad-block fix.

The official Surge documentation distinguishes untouched `$done({})` from body replacement using `$done({body})`: https://manual.nssurge.com/scripting/http-response.html

### Production recommendation

Keep `Bilibili.Helper.Audited.sgmodule` (**Fast**) enabled for splash, search and feed ad filtering. Do **not** enable the Full Experimental module, original Maasea gRPC module, or any gRPC response-modifying diagnostics during normal use if the latency is unacceptable. Header-only script changes cannot remove an ad embedded in the gRPC response; use other supported non-gRPC endpoints only where independently verified. No gRPC in-place edit can be claimed to be delay-free until tested on device.

The diagnostic scripts are not performance benchmarks and have no instrumentation of server/client timing. Confirm the script actually ran in Surge's request detail. Test each module alone and restore Fast-only afterward.

## Confirmed SameReference result (2026-11-04)

**User-observed results on iPhone / Surge:**

| Configuration | Description and comment loading |
|---|---|
| Fast (no gRPC MITM) | Normal |
| MITM-only | Normal |
| HeadersNoop: `requires-body=0`, `$done({})` | Normal |
| BodyNoop: `requires-body=1`, `$done({})` | Normal |
| Identity: `$done({body:new Uint8Array($response.body)})` | Delayed |
| SameReference: `$done({body:$response.body})` | Delayed |
| Full protobuf D/E response edits | Delayed |

**Conclusion:** Returning an explicit body replacement on these gRPC responses is the common factor. This rules out a necessary contribution from JS buffer copying, protobuf parsing or field deletion, and rules out MITM and full-body buffering *alone*. Surge's internal reason is unverified; do not claim a confirmed upstream bug.

**Stop testing these endpoints for daily filtering.** The Fast module is the practical solution. Retag/body rewrite is not an established workaround. See [minimal reproduction and report notes](Bilibili.gRPC.Surge.Repro.md).
