# Bilibili gRPC response replacement latency — Surge reproduction

**Reported on-device, 2026-11-04.** No independently confirmed Surge internal bug.

Symptoms: Bilibili iOS video descriptions and comments are delayed only when an HTTP response script returns an explicit binary `body`, even when it is the identical original `Uint8Array`.

**Endpoints**
- `https://grpc.biliapi.net/bilibili.app.view.v1.View/View`
- `https://grpc.biliapi.net/bilibili.app.viewunite.v1.View/View`
- `https://grpc.biliapi.net/bilibili.main.community.reply.v1.Reply/MainList`

**Reproduction**
1. Enable Surge HTTPS MITM (with HTTP/2) for `grpc.biliapi.net`.
2. Test [MITM only](Bilibili.gRPC.Diagnostic.MITM.sgmodule): description and comments load normally.
3. Test [BodyNoop for comments](Bilibili.gRPC.Diagnostic.Comments.BodyNoop.sgmodule): `requires-body=1`, `$done({})`, normal.
4. Test [SameReference for comments](Bilibili.gRPC.Diagnostic.Comments.SameReference.sgmodule): `requires-body=1`, `$done({body:$response.body})`, delayed.
5. Repeat the same comparison for [video detail](Bilibili.gRPC.Diagnostic.Detail.SameReference.sgmodule).

SameReference script: [source](scripts/bilibili-grpc-sameref.js). This script does **not** parse or modify protobuf fields, copy the body, access external URLs, or change headers.

**Observed difference:** `$done({})` passes normally whereas `$done({body:$response.body})` delays UI. Even a freshly copied but identical Uint8Array delays. The underlying cause (HTTP/2/gRPC forwarding, trailers, or flow control) remains unknown and needs investigation.

**Additional diagnostics to collect if reporting to Surge:** Surge version/build, iOS and Bilibili app versions, affected request timings, response status and gRPC metadata, and any retry differences. Redact cookies, authorization headers, query tokens, and response contents. See https://manual.nssurge.com/scripting/http-response.html.

**Workaround:** use [Bilibili Helper Fast](Bilibili.Helper.Audited.sgmodule), which does not rewrite gRPC responses, instead of the full experimental module.
