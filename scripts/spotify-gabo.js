'use strict';
// Explicitly opt-in by enabling the corresponding script entry in the module.
// Sends an empty local acknowledgement without contacting Spotify for matched GABO requests.
$done({
  response: {
    status: 200,
    headers: { "Content-Length": "0", "Cache-Control": "no-store" },
    body: ""
  }
});
