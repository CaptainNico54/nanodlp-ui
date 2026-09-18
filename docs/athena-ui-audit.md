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
| Jobs | WP2 information modal added | Supply official DragonFruit download URL and Athena instructions; printer acceptance pending |
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

## Work Package 2: Jobs, DragonFruit and navbar

- Jobs retains its existing layout and actions, with a gold outlined DragonFruit
  Slicer action next to New Job. A wide, responsive modal presents Get DragonFruit,
  Getting Started and Slicing for Athena. Content is a reusable template separate
  from the dialog shell. No backend or route changes.
- Official download URL was not found in repository/configuration/documentation.
  A disabled download button, visible explanation and source TODO mark the gap.
  Athena setup/profile and slicing instructions remain explicit placeholders.
- The obsolete NanoDLP Remote Slicer promotion was in New/Edit Job, not the Jobs
  list. Removed that presentation and the genuinely duplicated largeFile warning
  and duplicated enabled-status message. Kept one functional warning/status;
  the upload form is unchanged, including USB, data-remote, file-size, browser
  slicing and submit hooks. No job action URL or print-start behavior changed.
- Resin temperature now links to `/`. Bit depth remains dynamically updated in
  the same element, inside a non-interactive span with matching navbar spacing.
- Updated the redesign CSS cache key so existing printers load the new styles.

### Validation

Headless Edge fixture using local Bootstrap 3, jQuery and project CSS passed at
1440x1000, 1024x768, 768x1024, 390x844, 320x568 and 1024x500: Jobs action wrapping,
modal viewport bounds, scrolling, close/Escape, focus restoration, More menu,
unique IDs, disabled download placeholder and navbar targets. No page JS errors.
Desktop/mobile screenshots reviewed; modal bars and muted text explicitly use
existing design tokens to avoid inherited Bootstrap theme colors.

Static comparisons confirm the upload form and all pre-existing Jobs action
URLs are unchanged. The duplicate largeFile ID is removed. WP1 components and
camera/timelapse JS are unchanged; the WP1 mock layout/filter/delete/error checks
were rerun successfully. Git whitespace validation passed.

### Printer acceptance and remaining concerns

The fixture does not execute NanoDLP template rendering or real printer APIs.
Verify Jobs modal rendering on the locked binary, all Jobs actions (New Job,
USB/upload, 3D Editor, More, calibration and existing print controls), live navbar
updates for both 3-bit and 8-bit hardware, and Safari/mobile behavior. Confirm
WP1 stream/LED/video behavior as previously documented. The exact frozen binary's
routing implementation is not present here; no unverified route was assumed.

The preserved Remote slicing enabled status and file-size guidance describe
existing backend capabilities rather than promoting a slicer. Service settings
still expose RemoteSlicer configuration, intentionally unchanged.
