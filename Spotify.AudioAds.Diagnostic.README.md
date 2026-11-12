# Spotify audio ads — account parity diagnostic, November 2026

Symptoms: audio ads began playing again even with `remoteAds=1`.

## What we know

- The current script only edits selected account attributes and ten **existing** remote ad boolean assignments, not all Spotify audio-ad activity.
- The pinned script was limited to POST `/bootstrap/v1/bootstrap` and POST `/user-customization-service/v1/customize`.
- Current Amlabort upstream added GET `/nebula/v1/configuration/attributes`. Our module and script now support that endpoint using the same standalone UcsResponseWrapper field layout.
- Old `max-size=0` was ambiguous/unsafe: Surge's current docs say the limit is in bytes, `-1` disables the limit, and over-limit responses skip the script. Updated to 1 MiB. We did **not** change the actual premium and remote-ads value choices, to avoid re-introducing 10-second auto-skip.
- EeveeSpotifyReincarnated PR #220 (merged 2026-11-07) documents new audio-ad delivery via internal Swift ad services and player-core ad requests on Spotify 9.1.x; the fix is native hooking, **not** achievable from Surge response rewriting alone. See https://github.com/SideloadLabs/EeveeSpotifyReincarnated/pull/220.

## Diagnose

Install only one of the modules:

- Regular: `https://raw.githubusercontent.com/qweaszxcdf/Misc/main/spotify-proto-account-parity.sgmodule`
- Instrumented: `https://raw.githubusercontent.com/qweaszxcdf/Misc/main/spotify-proto-account-parity-diagnostic.sgmodule`

Diagnostic variant passes `remoteAds=1;debug=1` and sets Surge script debug mode. When a matching response is processed it logs an event like:

`[Spotify parity] endpoint=nebula accountPatched=true remoteMatches=1 bodyBytes=12345`

It logs **only** endpoint type, boolean, count, and length; no token, account identifiers or raw response body.

After restarting Spotify and observing another audio ad, check Surge's request records and script log. Inspect whether any of `bootstrap`, `customize`, or `nebula` are matched, if the script was skipped due to response size, and the `remoteMatches` count. **A successful response rewrite is not proof of audio-ad suppression**. Check for new ad paths such as `/ads`, `/ads/v3/ads`, `/ad-logic/prefetch` without blocking them blindly (doing so may cause playback retries or 10-second skips).

Make sure no other Spotify response script wins the same request first, and that HTTPS MITM is enabled. Surge response-script docs: https://manual.nssurge.com/scripting/http-response.html

## Limits

This module does not grant an actual Premium subscription and does not guarantee removal of server-triggered audio advertisements. Spotify app version, Connect / external playback, cached product state, and changes in advertising paths can affect results. No live playback on the user's device was tested.
