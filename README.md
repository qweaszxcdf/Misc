# Spotify Surge Proto (Selective)

Surge module: https://raw.githubusercontent.com/qweaszxcdf/Misc/main/spotify-proto.sgmodule

This project selectively patches known Spotify client-facing account attributes; Premium simulation and the `ads=false` attribute are enabled by default. It does **not** grant server-side Premium rights or guarantee that audio advertisements disappear.

## Enabled by default

- **[Rule]**: reject Spotify QUIC to permit compatible HTTPS inspection; reject `aet.spotify.com`.
- **[Header Rewrite]**: remove `If-None-Match` on the customization endpoint.
- **[URL Rewrite]**: reject `pendragon` popups, `pam-view-service` membership UI and the matching AI DJ URI.
- **[Script]**: a minimal local HTTP 200 empty response for GABO requests and selective Protobuf account-attribute patching.
- **[MITM]**: append Spotify client API hostnames.

The membership UI, AI DJ and GABO blocks are intentionally **enabled by default at the user's request**. They may interfere with normal functionality. Remove their corresponding lines to disable them individually. The same applies to QUIC blocking.

Do not enable a competing Spotify module that rewrites the same API responses. Surge requires a trusted MITM certificate to inspect HTTPS requests. Keep an unmodified backup of your existing Surge configuration.

## Files

- `spotify-proto.sgmodule`: installable module.
- `scripts/spotify-proto.js`: selective attribute rewriting; preserves unrelated protobuf data and does not replace hundreds of remote configuration assignments.
- `scripts/spotify-gabo.js`: local acknowledgement for GABO event requests.
- `tests/spotify-proto.test.cjs`: synthetic protocol tests.

## Limits

The Protobuf field paths and attributes are inferred from the upstream Amlabort/MY_clash script, not guaranteed for every current Spotify app version. Validate with request logs and actual playback. Premium flags alone do not unlock real account entitlements. No live iPhone/Surge playback validation has been performed.
