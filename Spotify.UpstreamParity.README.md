# Spotify audio ads — upstream-matched baseline (2026-11-12)

The user confirmed the official [Amlabort/spot-new.module](https://github.com/Amlabort/MY_clash/blob/0e03454fe90b00cecccf8586ba8922c640dc4812/files/surge/spot-new.module) **does not play audio ads on their device**, while the previous custom `spotify-proto-account-parity.sgmodule` still did.

Therefore, **stop guessing individual Premium flags**. The module at the user's existing path is changed to a strict behavioral match of that tested upstream, pinning all remote script sources to upstream commit `0e03454fe90b00cecccf8586ba8922c640dc4812`. The only differences are module metadata and immutable URLs; no functional directives have been added or removed. This protects reproducibility against silent upstream changes.

## Modules

- Active upstream-matched: `https://raw.githubusercontent.com/qweaszxcdf/Misc/main/spotify-proto-account-parity.sgmodule`
- Previous custom backup: `https://raw.githubusercontent.com/qweaszxcdf/Misc/main/spotify-proto-account-parity-legacy.sgmodule`
- Earlier diagnostic (do not run concurrently): `spotify-proto-account-parity-diagnostic.sgmodule`

## Differences from the previous custom version

- New source `261110-spot.js` on the upstream Bootstrap/Nebula pattern; it modifies Nebula GET account attributes (no custom `remoteAds=1` script). Upstream notes Spotify 9.1.98 and later.
- New **separate remote-config-resolver** response rewrite, `spot-remote.js`, which can merge ~878 configuration entries and applies a blacklist of ~18 entries. Its effects extend far beyond audio-ad suppression.
- Disable GABO request script, NoHomeAd, and membership UI rewrite in lockstep with the upstream configuration. They are **still available in the legacy backup**, but not simultaneously.
- Use original upstream Search and Scroll scripts, not the custom protobuf field filters. **Do not enable multiple Spotify modules together**.
- Preserve upstream `max-size=0` to match the user-tested configuration exactly. Surge's limit semantics and treatment of oversized buffers can vary by version; this is not presented as a performance optimization.

## Scripts verified at pin

- `files/lpx/js/spot-gabo.js`: 3c1f0b52ace64bc34ae49862743b412658852bdc (469 source characters)
- `files/lpx/js/261110-spot.js`: 3abd89a5653820c485ba4364010e02b92203e02d (9000 source characters)
- `files/lpx/js/spot-remote.js`: 8bc6af005b577f3bbf4de15794f61a9f0085b118 (309069 source characters)
- `files/lpx/js/spot-NoSearchAd.js`: 3464ae7d826fac0d4723f12397ad02560e89c40c (1067 source characters)
- `files/lpx/js/spot-NoHomeAd.js`: 4fe12170092ce2e48b33d8c09996b3c8031a062e (369 source characters)
- `files/lpx/js/spot-NoScrollAd.js`: b7cf3740a2e1199adf8947e8cac7b64c7cba9fa2 (420 source characters)

## Caveats

The user has empirically verified the **upstream live main branch**, not this pinned mirror under their own repo. We verified directive parity and pinned each of its referenced scripts; device confirmation after refreshing Surge is still needed.

The remote config script merges a large number of feature and player-cohort flags, and could cause playback changes or regressions, including 10-second skipping. If that occurs, disable the module rather than stacking more rules. The module does **not** grant server-authorized Premium subscription rights.

To try regaining GABO or NoHomeAd without changing baseline, isolate each rule in a future separate test after confirming parity works first.
