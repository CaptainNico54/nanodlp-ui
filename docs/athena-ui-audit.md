# Athena UI audit and Work Package 1

## Work Package 1

Both `/custom/webcam` and `/custom/timelapse` render the same shared
`components/camera-timelapses.html` content. Navigation links only to the former;
existing job links to the latter, including `?plateid=`, remain valid. Each route
extends base.html once, so camera.js and timelapse.js each initialize once.
No binary route registrations or backend changes are needed.

System navigation hides Z Axis Control, Heater Control, Display Calibration and
the duplicate Help link. Their templates/routes remain intact. Monitoring,
service tools, access-lock conditions and the mode-switch IDs are preserved.

The combined view uses redesign.css tokens and Bootstrap 3 controls. Camera is
portrait on the left; the wider gallery is on the right and stacks below on
phones. Cards support keyboard preview activation, missing previews, aligned
actions, escaped job titles, secondary timestamps, empty results and retryable
load errors. Playback remains in the existing Bootstrap modal.

Preview rotation remains 90 degrees: the pre-existing thumbnail CSS and both
camera.js streamer implementations use this correction. The camera is mounted
in portrait while frames are landscape; confirm with actual printer previews.

## Validation

- JavaScript syntax check and git diff whitespace check passed.
- Headless Edge with local Bootstrap 3/jQuery/CSS and mocked timelapse APIs:
  1440, 1024, 768 and 390px layout checks passed, with no horizontal overflow;
  desktop camera-left and mobile stacking verified.
- Shared content has unique DOM IDs. Quoted/HTML-like job names round-trip safely.
- Job filtering, confirmed deletion, empty results and load-error UI passed;
  no page JavaScript errors in the mock run.
- Static trace preserves fetch URLs, delete payload fields, modal/video IDs,
  camera stream setup and CAMERA_LED_ON command. athena.js and camera.js unchanged.
- No NanoDLP binary or connected Athena printer was available for integration tests.

### Printer acceptance checks

Open both routes, including a Jobs timelapse link with a plate ID. Check the live
portrait feed, LED 10-second timeout, camera unavailable state, real preview
orientation, video playback/close, all time filters, delete cancel/confirm,
encoding progress and API failure/retry. Check Chrome and Safari and a mobile
viewport. Confirm the menu in Easy/Advanced and locked configurations.

### Existing concerns, outside this visual package

- Encoding polling stops for an empty filtered gallery; it only continues after
  the initial status check if an entry is already processing. It does not refresh
  the gallery automatically on completion. This can miss a first/new recording.
- Camera unavailable state requires reload to retry. Safari's adaptive streamer
  defines an onload method but buildCameraStream does not visibly wire it to the
  image load event; verify frame refresh on a printer before changing it.
- The navbar still has an initially hidden resin-temperature link to Heater
  Control, and Settings/Tools can expose calibration/service routes. Removing
  System menu entries is not access control.

## Reachable-page audit / retained follow-on scope

| Page / area | Classification | Next action |
| --- | --- | --- |
| Dashboard | Redesigned; hardware validation pending | Preserve Environment/Printer and pressure chart left, portrait camera right |
| Camera & Timelapses | Redesigned in WP1 | Printer acceptance checks above |
| Status | Redesigned; validation pending | Preserve Paul's latest rebuild |
| Jobs | Follow-on content change | Replace Remote Slicer block with DragonFruit entry/page; resolve official URL from repository/config or flag missing; slicing instructions placeholder |
| Resins | Redesigned / preserve | Keep embedded Athena Resin Database; Proteus backend separate |
| Analytics | Requires visual validation | Same metric colors on Dashboard/full charts; check ALL series together on dark backgrounds |
| Print History / Gcode Terminal | Needs visual redesign | Customer-visible legacy template layouts |
| Support & Connectivity | Needs visual redesign | Adapt to existing design tokens |
| Resin Import | Requires functional/layout review | Separate resin import from machine restore; preserve routes |
| Settings and Tools / Machine Settings | Advanced/service page | Backup & Restore home; consider Advanced-only restore controls |
| Z Axis / Heater / Display Calibration | Hide on Athena | Hidden from System; backend retained |
| Pause / Resume | Requires separate functional review | Inspect movement/state handling before any lift/resume work; protect Z max |

This is a focused navigation audit, not certification of every internal template.
Do customer-visible legacy pages before obscure service pages. Keep Bootstrap 3,
jQuery, server templates and all backend hooks; no framework migration.
