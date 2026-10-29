# Spotify Surge Proto (Selective)

A small, independent Spotify Surge response editor. Premium-like account attributes are simulated by default; no server-side subscription or ad-free playback is guaranteed.

Module: https://raw.githubusercontent.com/qweaszxcdf/Misc/main/spotify-proto.sgmodule

The implementation selectively patches known protobuf account attributes and passes through unexpected responses. It does **not** replace Spotify's remote feature configuration.

See `scripts/spotify-proto.js` and `tests/spotify-proto.test.cjs`.
