# Dashboard metric selection

The dashboard's **Live Analytics** card has a **Metrics** control beside Tare
and Full Analytics. It opens a grouped checklist with Apply, Cancel, and Reset
defaults. Users can select one to five metrics. The default selection remains
Force, Resin Temp, and Layer Height.

Five series keeps the compact chart and legend usable while allowing several
additional sensors. The full analytics page remains available for a broader
comparison. Settings belong beside the chart because this is a display choice,
not a machine configuration change.

## Available metrics

All 28 metrics from the existing full analytics chart are offered. IDs and label
overrides come from the shared `ALL_CHART_CONFIG` in `public/js/analytics.js`.
The ordered axis metadata formerly embedded in the dashboard template is now
in `public/js/dashboard-metrics.js`.

| Group | Metrics |
| --- | --- |
| Print and motion | Layer Height, Solid Area, Area Count, Largest Area, Speed, Cure Time, Force, Layer Time, Lift Height, Dynamic Wait Time |
| Temperatures | Resin Temp and target, UV Temp and target, MCU Temp and target, VAT Temp and target, Chamber Temp and target, PTC Temp and target |
| Fan speeds | MCU Fan RPM, UV Fan RPM, PTC Fan RPM, AEGIS Fan RPM |
| Air quality | VOC Score Inlet, VOC Score Outlet |

Each metric retains its own unit scale. The dashboard shows up to three Y-axis
scales on desktop and two on mobile, prioritizing Force and temperature when
selected and available. The remaining selected series remain plotted, and their
values and units are shown in the legend. VOC uses the same fixed 0–100 score
range as full analytics; RPM uses the same zero-based rounded scale behavior.

## Persistence and unavailable readings

The selection is saved in browser local storage under
`c3d-dashboard-metrics:v1`. This is local to that browser and site origin. No
printer database or machine setting is written. If storage is unavailable, the
selection still works until the page closes and the UI explains that limitation.

Metrics without readings stay selected so they can appear when data arrives.
The chart reports partially unavailable selections. If none of the selected
metrics have data, it clears the previous plot and shows **No readings yet for
the selected metrics.** It does not leave an unrelated earlier chart visible.

The dashboard has its own saved legend entry, `dashboard-metrics:v1`, within
`legends:v3`. Its visibility choices do not overwrite the full analytics chart
legends. Applying a new selection resets only the dashboard's hidden-series
preferences so the explicitly selected metrics are visible.
Current-page legend choices also remain in memory, so a browser that allows
storage reads but rejects writes cannot restore a stale hidden-series setting
immediately after Apply.

## Data behavior

The existing status and analytics polling remains in place at the same cadence:
`/status`, then `/analytic/data/start` or `/analytic/data/10000`. The full
response reaches the shared chart processor unchanged. Apply redraws the latest
retained response and makes no additional network request. A selection made
while a poll is pending remains current when that response arrives.

Changing the selection resets dashboard zoom and the dashboard's render cache.
Failed polls preserve the last valid chart and retry at the normal interval.
None of these controls send G-code or change the NanoDLP parser, Klipper,
telemetry collection, or the raw analytics data.

## Verification

Run `node --test tests/dashboard-metrics.test.js` from the repository root.
The ten regression tests cover all 28 fields through the shared renderer,
selection limits, saved preferences, blocked storage, unit scales, zero and
missing readings, legend isolation, pending requests, zoom reset, empty states,
and recovery after a failed poll. Browser rendering is a separate acceptance
check, including the modal checklist and desktop/mobile chart layout.
`tests/analytics-preferences.test.js` adds seven shared-chart checks for legend
isolation in both directions, reordered series, invalid or blocked storage,
read-only storage reset, and count/speed axis labels.
