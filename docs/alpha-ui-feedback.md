# Alpha UI feedback: implementation and investigation

Date: 12 November 2026. Branch: `nico/alpha-ui-feedback`.
Base: `281f62bdc2eae8c31d9db0a3e196efd853f2fea0`, including the earlier
display-only terminal telemetry filters.

## Scope and status

| Request | Result |
| --- | --- |
| Force-sensor Tare on dashboard and full Analytics | Implemented on both live chart pages. |
| Incorrect dashboard layer-image aspect | Cause identified in the separate status-preview path; physical-aspect fitting implemented and checked against saved 12K/16K job dimensions. |
| Custom dashboard chart metrics | Implemented a Metrics picker beside the chart, with one to five selections from all 28 existing metrics. |
| Configurable dashboard and new panels | Investigated only. A detailed frontend feasibility and implementation proposal is included. |

The changes are prepared for review. No printer deployment, service restart,
merge, live Tare operation, or other physical printer action was performed.
The NanoDLP parser, Klipper, firmware, printer configuration, and telemetry
collection are outside this change.

## Tare behavior

Both the dashboard Live Analytics header and the live full Analytics page have
a **Tare Force** button. A deliberate click sends the exact command
`[[PressureWrite 1]]` through the existing `runGcode()` helper, as a
form-encoded `POST /gcode` request.

The buttons disable while the request is pending to suppress duplicate clicks.
HTTP success reports **Force tare requested.** This confirms submission only;
the frontend has no established acknowledgement that the force MCU has completed
its zeroing procedure. Network and HTTP failures show an error and restore the
controls so the user can retry. Page initialization sends no command.

The offline/historical analytics viewer does not gain a machine-control button.

## Layer-image diagnosis and correction

The earlier physical-size correction affected the full job preview, but the
dashboard and live Analytics status panel used a separate `image_display()`
path. That path used a logical-pixel ratio and retained the PNG's natural
aspect through `object-fit: contain`. Both are wrong for a display with
rectangular physical pixels when the PNG also stores a reduced or packed X
dimension.

The corrected path fits the layer image to the configured physical aspect:

`(ProjectorWidth * XYRes) / (ProjectorHeight * YRes)`

An omitted/zero Y-resolution override uses the X resolution. The result is
fitted inside both available dimensions. Only the layer image is stretched;
the separate 3D model image retains its previous containment behavior.

Existing local archives supplied real 12K evidence: a 2,003-layer export declares
11520 x 5120 logical pixels while its first, middle, and last images are
3840 x 5120 RGB PNGs. The repository's 12K sample configuration uses 19 x 24
micrometre pixels, giving a physical aspect of 1.78125. The broader archive
inspection found full-width and packed 12K images, as well as full-width,
half-width, and RGB-packed 16K images. No actual one-eighth-width example was
found; that variant is covered by synthetic geometry checks.

The correction uses machine geometry rather than a slicer-name guess, so it
does not need to identify DragonFruit versus NanoDLP from archive metadata.
The read-only geometry lookup is cached, retries after a bounded cooldown on
failure, and does not modify the source image or exposure data. Layer caching
also includes the job ID, avoiding a stale preview when different jobs have
the same current layer number.

See [Layer preview scaling](layer-preview-scaling.md) for the evidence matrix,
geometry behavior, and validation limits. Private job archives and extracted
customer images are not included in the commit.

## Dashboard metrics and interface decisions

The **Metrics** button sits next to Tare and Full Analytics. It opens a grouped
checklist with Apply, Cancel, and Reset defaults. Keeping this control beside
the chart makes a viewing preference easy to discover without putting it in
machine settings.

The maximum is **five metrics**, with at least one required. Defaults remain
Force, Resin Temp, and Layer Height. Every existing full-chart metric is
available, including temperatures and targets, fan RPM, VOC, and print/motion
metrics. Missing readings remain selected and can appear when data becomes
available. An empty selection of available readings shows an explicit empty
state instead of leaving an unrelated old chart on screen.

Metric scales remain separate. Up to three Y axes are displayed on desktop and
two on mobile, with Force and temperature prioritized when selected. Other
selected readings retain their own scales and legend values/units. VOC and
RPM retain the existing full-chart range behavior.

Selections are saved in the current browser for the printer's site origin.
This is not a shared printer-wide setting. If storage is unavailable, the
current page remains usable and explains the saving limitation. Dashboard
legend preferences are independent of full Analytics, including when storage
can be read but cannot be written.

Apply redraws the latest retained data without an additional request. The
existing status/analytics polling cadence is preserved, and a pending response
uses the latest selection. The full raw response reaches the existing chart
processor unchanged. See [Dashboard metric selection](dashboard-metrics.md).

## Configurable-dashboard finding

A useful configurable dashboard is feasible within this frontend and the
existing routes. The first release can offer Edit dashboard, add/remove panels,
reordering, a few size presets, Save/Cancel/Reset, and browser-local layout
preferences. Jobs, resins, timelapses, news, a terminal, and print history all
have existing routes or page data that can be adapted.

The substantial work is replacing fixed DOM/column assumptions with a panel
registry and controlled initialization, resizing, and cleanup. The initial
version should permit one instance of each panel, keep current-print controls
accessible, and share status polling. Existing job start eligibility and
confirmation must be preserved. No new backend route or shared preference
service was established by the investigation.

See [Configurable dashboard feasibility](configurable-dashboard-feasibility.md)
for the source-linked panel matrix, exact current routes, lifecycle work,
backend boundaries, and recommended implementation phases. This larger
overhaul has not been implemented.

## Verification and outstanding acceptance

The focused Node suite has **40 passing tests**:

| Area | Tests | Main checks |
| --- | --- | --- |
| Tare | 5 | Exact command/endpoint, no initialization action, duplicate suppression, success wording, failure/retry, both pages. |
| Preview geometry | 8 | Rectangular pixel pitch, real raster families, synthetic one-eighth width, fit bounds, 3D preservation, hidden frames, shared read and retry. |
| Dashboard metrics | 10 | All 28 mappings and original values through the actual shared renderer, selection limits, unavailable readings, persistence, pending requests, zoom and recovery. |
| Shared chart preferences | 7 | Isolation between dashboard and full charts, series reorder, corrupt/blocked/read-only storage, count/speed axes. |
| Existing terminal filters | 10 | Telemetry classification, non-telemetry preservation, all filter combinations and saved preferences. |

Run these checks from the repository root:

```sh
node --test tests/analytics-preferences.test.js tests/dashboard-metrics.test.js tests/force-tare.test.js tests/preview-aspect.test.js tests/terminal-filters.test.js
node tests/job-sort.test.js
git diff --check
```

JavaScript syntax checks also cover all modified scripts and the dashboard's
inline chart script. The existing job-sort regression remains part of the final
repository validation.

**Visual browser acceptance remains outstanding.** The connected local browser
was unavailable, and the fallback browser policy blocked the local mock page.
No alternate route was used to bypass that restriction. The automated checks
establish command construction, data flow, and geometry behavior, but do not
prove rendered desktop/mobile appearance or a successful live 12K print.

Before deployment, inspect dashboard and full Analytics layouts at desktop,
mobile, and printer-HMI sizes; check the metric modal and long legends; verify
the 12K/16K layer preview against a known circular or square model; and perform
an explicitly authorized live Tare test with an unloaded sensor. These are
acceptance checks, not claimed completed operations.
