# Spotify Surge Proto (Selective)

Surge module: https://raw.githubusercontent.com/qweaszxcdf/Misc/main/spotify-proto.sgmodule

This project selectively patches known Spotify client-facing account attributes; Premium simulation and the `ads=false` attribute are enabled by default. It does **not** grant server-side Premium rights or guarantee that audio advertisements disappear.

## Enabled by default

- **[Rule]**: reject Spotify QUIC to permit compatible HTTPS inspection; reject `aet.spotify.com`, `adeventtracker.spotify.com`, `ads-fa.spotify.com`.
- **[Header Rewrite]**: remove `If-None-Match` on the customization endpoint.
- **[URL Rewrite]**: reject `pendragon` popups, `pam-view-service` membership UI and the matching AI DJ URI.
- **[Script]**: a minimal local HTTP 200 empty response for GABO requests, Premium/account ad-flag patching, selective existing UCS advertising switches, and experimental Search/Home/Scroll page ad field removal.
- **[MITM]**: append Spotify client API hostnames.

The membership UI, AI DJ and GABO blocks are intentionally **enabled by default at the user's request**. They may interfere with normal functionality. Remove their corresponding lines to disable them individually. The same applies to QUIC blocking.

Do not enable a competing Spotify module that rewrites the same API responses. Surge requires a trusted MITM certificate to inspect HTTPS requests. Keep an unmodified backup of your existing Surge configuration.

## Files

- `spotify-proto.sgmodule`: installable module.
- `scripts/spotify-proto.js`: selective attribute rewriting; preserves unrelated protobuf data and does not replace hundreds of remote configuration assignments.
- `scripts/spotify-gabo.js`: local acknowledgement for GABO event requests.
- `scripts/spotify-page-ads.js`: experimental, fail-open Search/Home/Scroll protobuf field suppression. Numeric page tags are inferred from upstream code, not verified against Spotify's official schema.
- `scripts/spotify-proto.js`: also modifies a short allowlist of *existing* `core-ads`, `core-podcast-ads`, `core-podcast-ads-feature` and sponsored-content boolean flags. Unknown and absent assignments are preserved.
- `tests/spotify-proto.test.cjs`: synthetic protocol tests.

## Limits

The Protobuf field paths and attributes are inferred from the upstream Amlabort/MY_clash script, not guaranteed for every current Spotify app version. Validate with request logs and actual playback. Premium flags alone do not unlock real account entitlements. No live iPhone/Surge playback validation has been performed.

## Important validation caveats

All ad-related rules in this module are **enabled by default**. The page-field deletion heuristics can remove non-ad content when numeric tags are reused. Changing an internal advertising flag may affect playback or telemetry and does not guarantee ad removal. These are experimental integrations without real iPhone/Surge playback validation. If playback breaks, disable the module and re-enable its lines individually. No real account Premium subscription is granted.
