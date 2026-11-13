# Terminal display filters

The G-code Terminal has three independent **Hide temperatures**, **Hide fan RPM**, and
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

Routine records are matched strictly:

- M105 commands, with optional line number, tool index, and checksum.
- Complete actual/target temperature reports using Athena's sensor names or
  conventional T/B names.
- Numeric UVLed, UV, Case, MCU, PTC, Aux, and AEGIS fan RPM readings.
- Numeric VOCINLET and VOCOUTLET readings.

Recognized `echo:`, `Send:`, `Recv:`, and `//` wrappers are supported.
Generic `ok` acknowledgements are always retained. Errors, warnings, invalid
readings, unfamiliar formats, and ambiguous truncated text are retained. A record
containing both telemetry and other text stays visible as a whole.
Manually entered M105 commands follow the same display filter; disable Hide
temperatures to inspect them. Commands are always sent normally. The internal
`m105` preference key is unchanged, preserving existing saved choices.

## Leading fragments from the rolling buffer

Visual review found a single fan or partial temperature line remaining when all
filters were enabled. A read-only capture confirmed that `/term-io` can begin
inside the oldest HTML record, including midway through its timestamp:

```html
4</b><br>echo: UVLedFanRPM 1676.6467065739696
</div><div><b>19:54:24</b><br>...
```

The previous filter visited complete `div` rows only. The parser discarded
unmatched closing tags, leaving loose text that never reached classification.

The filter now checks that leading fragment before HTML parsing, and only when
its closing `div` precedes the first opening `div`. It removes recognizable
timestamp/header remnants for classification and requires every remaining line
to match an enabled telemetry category. A numeric actual/target fragment such
as `5 /0.0` can be identified as temperature data when followed exclusively by
complete known temperature fields. This exception is limited to that clipped
leading record; normal rows retain strict complete-record matching.

Bare numbers, errors, warnings, invalid readings, unknown text, and mixed
records remain visible. The original snapshot is retained, so turning a filter
off restores its leading fragment as well as complete records.

## Verification

Run the dependency-free regression tests from the repository root:

```sh
node --test tests/terminal-filters.test.js
node tests/job-sort.test.js
node --check public/js/main.js
```

The 14-test filter suite covers all eight switch combinations, exact command
matching, temperature/fan/VOC formats, clipped leading boundaries and headers,
the reported temperature suffix, diagnostic preservation, and saved preferences.

An offline HTML replay also exercised the actual filter click handlers,
retained snapshot restoration, unchanged polling, and blocked browser storage.
A captured 295-record terminal snapshot rendered 8 significant event records
with all filters enabled, hiding 287 routine telemetry records (97%).
All 8 significant event records remained visible, and disabling all filters
restored all 295 records. The replay used an HTML parser and a minimal DOM
adapter; it was not a visual browser test. Outgoing M105 requests were covered
with constructed examples, not a captured outgoing request.

During the alpha review, eight read-only terminal snapshots were captured. An
offline DOM replay of the first and last reproduced the stray fan text with the
old code and produced no leftover telemetry with the correction. The reported
temperature suffix also reproduced and was removed. Turning the filters off
restored all 166 and 180 complete records respectively, plus each original
leading fragment, without changing the retained raw snapshot or making requests.
The older 295-record replay still preserves all eight significant event records.

The correction and renamed control require another browser check on desktop and
mobile, including auto-scroll and reload persistence. These replay results are
behavior checks, not a claim of rendered visual acceptance.
