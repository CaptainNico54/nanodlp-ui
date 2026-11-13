# Terminal display filters

The G-code Terminal has three independent **Hide M105**, **Hide fan RPM**, and
**Hide VOC** switches. All three start enabled. Preferences are saved in the
browser's local storage under `terminal-display-filters`; the switches also work
for the current page when local storage is unavailable.

## Data boundary

The existing one-second GET to `/term-io` continues unchanged. Its original HTML
snapshot is retained as `terminal_raw_html`. Filtering works on a detached copy
immediately before rendering `#terminal`. Switching a filter off restores
matching records that remain in the current server snapshot.

The switches make no network requests, send no G-code, and do not change
subscriptions, polling, NanoDLP's board parser, or Klipper. Analytics continues
using its separate `/analytic/data/<range>` endpoint. The existing terminal
buffer capacity and retention policy are unchanged.

## Matching rules

Only complete routine records are hidden:

- M105 commands, with optional line number, tool index, and checksum.
- Complete actual/target temperature reports using Athena's sensor names or
  conventional T/B names.
- Numeric UVLed, UV, Case, MCU, PTC, Aux, and AEGIS fan RPM readings.
- Numeric VOCINLET and VOCOUTLET readings.

Recognized `echo:`, `Send:`, `Recv:`, and `//` wrappers are supported.
Generic `ok` acknowledgements are always retained. Errors, warnings, invalid
readings, unfamiliar formats, and truncated text are retained. A record
containing both telemetry and other text stays visible as a whole.
Manually entered M105 commands follow the same display filter; disable Hide
M105 to inspect them. Commands are always sent normally.

## Verification

Run the dependency-free regression tests from the repository root:

```sh
node --test tests/terminal-filters.test.js
node tests/job-sort.test.js
node --check public/js/main.js
```

The filter suite covers all eight switch combinations, exact command matching,
temperature/fan/VOC formats, diagnostic preservation, and saved preferences.

An offline HTML replay also exercised the actual filter click handlers,
retained snapshot restoration, unchanged polling, and blocked browser storage.
A captured 295-record terminal snapshot rendered 8 significant event records
with all filters enabled, hiding 287 routine telemetry records (97%).
All 8 significant event records remained visible, and disabling all filters
restored all 295 records. The replay used an HTML parser and a minimal DOM
adapter; it was not a visual browser test. Outgoing M105 requests were covered
with constructed examples, not a captured outgoing request.

Before rollout, check the terminal in a browser on desktop and mobile, including
filter appearance, auto-scroll while following/reading older output, and reload
persistence. A live deployment and visual browser verification have not been
performed as part of this change.
