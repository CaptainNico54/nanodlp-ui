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
| Resins | Production behavior reconciled in WP5 | Printer acceptance for all-profile sorting, default badge, editor modes and database iframe |
| Analytics | Requires visual validation | Same metric colors on Dashboard/full charts; check ALL series together on dark backgrounds |
| Print History / Gcode Terminal | Needs visual redesign | Customer-visible legacy template layouts |
| Support & Connectivity | Redesigned in WP3 | Printer acceptance; see athena-support-diagnostics.md for hook inventory, download findings and existing functional issues |
| Resin Import | Route confirmed in WP5; layout separation deferred | `/import` retains both profile and machine-settings forms unchanged |
| Settings and Tools / Machine Settings | Tools redesigned in WP4; Machine Settings remains a service page | `/printer/restore` is a separate, untested ZIP Restore Backup page; shortcut remains Service Mode only |
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

## Work Package 3

Support & Connectivity now uses three resource cards, a wider ticket panel next
to Connectivity, and a full-width data-processing table. Privacy/consent wording,
all original hooks and resource destinations remain available. No scripts or
backend behavior changed. See [support diagnostics notes](athena-support-diagnostics.md)
for validation, the existing `/debug` download investigation and printer checks.

## Work Package 4: completed Tools scope; import split deferred

Settings & Tools redesign is complete, with grouped Printer, Backup & Restore,
Customization and Service Tools actions. Exports remain normally available.
The `/printer/restore` shortcut appears only for `viewMode == 1`; this does not
protect the backend route or alter restore behavior. Import templates, their
repository link and duplicate input IDs are deliberately unchanged pending
verification with Pascal/on Athena. Duplicate Pi/filesystem/timezone capabilities
are retained. See [WP4 notes](athena-settings-tools.md) for validation, preserved
hooks, exact scope and remaining printer checks.

## Work Package 5: production UI reconciliation and local review

The authorized Athena II test printer runs NanoDLP from `/home/pi/printer` under
`nanodlp.service`. Its UI templates, stylesheets and scripts were copied read-only
to a temporary local comparison snapshot before WP5. The printer was not changed.
Production is the functional reference for resin editing; the branch design is
the visual reference.

The Resins page now keeps the default profile in the same sortable list as every
other profile, with a Default badge. New Resin, Import, profile actions and
`ManufacturerLock` conditions remain. The production Athena Resin Database
bar and its expand/collapse state were adapted to the dark design. Proteus still
uses `https://proteus.concepts3d.eu`, the existing machine/image detection,
iframe messages and `/profile/import` upload. Only the production toggle/ARIA
handling was merged into the integration script.

The production `templates/profile/edit.html` was used as the functional base:
its paired Bottom/Normal settings, Easy/Advanced layout, field grouping and help
text are retained. Production resin-editor CSS and the peel-detection visibility
logic were merged selectively. Form actions and field names match the production
template. `templates/profile/simple.html` was identical and remains unchanged.

Read-only GETs on the frozen build established the import routes:

| Route | Rendered template | Content |
| --- | --- | --- |
| `/import` | `templates/import.html` | Profile JSON/URL import plus machine-settings JSON/URL restore forms; page title “Setup / Profile Import” |
| `/printer/restore` | `templates/setup/restore.html` | Separate `BackupFile` ZIP upload form; page title “Restore Backup” |

No route form was submitted. Pascal confirmed that Restore Backup has never been
tested on Athena. WP5 relabels its WP4 shortcut and warns that it is an untested
service function. The shortcut remains under `viewMode == 1`; no restore backend
or import form changed. Import-page separation and investigation of ZIP restore
behavior remain future work.

Camera capability was investigated read-only in `machine.json`, `printers.json`,
`custom-inputs.json`, nginx, `ustreamer.service` and existing UI scripts. The
legacy camera/timelapse settings are zero even while `/athena-camera/state`
reports `result.source.online: true`; they do not indicate installed hardware.
No reliable persistent installed-camera flag was found. System navigation
therefore remains visible. The unchanged `camera.js` still hides the Dashboard
Webcam column and expands controls when its existing state request reports
offline or fails. A capability flag is needed before camera-less printers can
hide navigation without also hiding it during temporary outages.

Jobs now presents DragonFruit, New Job, More and Calibrate Exposure in that
order. Its 3D Editor toolbar and row-menu links are removed; the editor
files/backend remain. The
System menu has no Machine heading and shows Machine Settings within Tools only
in Service Mode. Navbar height/status alignment and Dashboard card positioning
were adjusted without changing their live hooks. The Discord invite is now
`https://discord.gg/concepts3d`. The supplied replacement PNG was verified to
decode to that exact invite, copied to `public/shots/athena-discord.png`, and
restored on the Support page. The image also decoded at its 88 px display size.

### Local validation

The recovered editor retains all production field names, element IDs and form
actions, with all 45 production tooltip hooks. JavaScript syntax checks and
`git diff --check` passed. Static checks verified Jobs action order, removal
of only the 3D Editor link, one resin list containing the default badge,
sorting/action hooks, Service Mode restore gating, unchanged import forms and
unchanged `camera.js`. A headless Edge fixture checked Jobs, Resins, both editor
modes, Dashboard, menu, Tools and Support at 1440, 1024, 768 and 390 px: no
horizontal overflow or page errors. The Dashboard heading-to-card gap was
about 30 px at each width. A separate mocked interaction fixture passed resin
name sorting and Proteus open/close state, including iframe machine type.
These fixtures do not execute the frozen NanoDLP renderer or hardware APIs.

### Outstanding printer acceptance

After an explicitly approved deployment, check NanoDLP template rendering in
both modes, resin editing and saving on a disposable profile, default selection
and sorting, Proteus iframe/open/close and import, all Jobs actions, bit-depth
and other navbar live status, Dashboard spacing and camera online/offline layout,
Camera & Timelapses, Support/Discord, and WP4 Tools/exports. Do not test ZIP
restore as part of UI acceptance. Test desktop/mobile and Chrome/Safari.

## Work Package 6: final local cleanup before deployment

The navbar now has an explicit Dashboard link before Jobs. Its 50 px command
bar aligns the logo, navigation and live right-side readouts at desktop widths;
tablet widths collapse the navigation. The Dashboard news feed remains the
Concepts3D website feed, labelled News / Latest News. A separate Software
Update link to `/printer/upgrade` starts hidden and is revealed only by the
existing `update_changelog()` available state. Current and error states hide it.
Heater buttons now say Chamber Heater and Vat Heater in every state.

The resin database heading says Proteus Resin Database and its shell aligns
with the All Resins list. The existing iframe, profile messaging, machine type,
search and import behavior remain unchanged. `docs/athena-design-system.md`
records current WebUI tokens and derived sRGB fallbacks for Proteus/mobile use.

The `/import` page now groups its four existing JSON file/URL forms into Resin
Profile and Machine Settings cards. Actions, payload names, methods, enctype
and required inputs are preserved. File IDs are unique; the obsolete external
NanoDLP repository link is no longer presented. `/profile/compare` keeps both
selectors and JSON comparison logic, while showing an empty state for matching
profiles. New Job gives local file and production USB sources clear tabs;
`ZipFile`, `USBFile`, upload progress and advanced fields remain. The browser
slice button is hidden from Athena presentation while its ID and underlying
NanoDLP implementation remain available in code.

Production calibration reconciliation used the authorized printer read-only:
`calibrationConfig.json`, all six Concepts3D RERF STLs, its preview image, the
guide QR, current model name and the production evaluation instructions were
recovered. The QR decodes to the linked Concepts3D calibration guide. The
second J3D model remains unchanged; its image matched production. Calibration
form IDs, exposure calculations, submit route and print action were not changed;
no calibration print was executed.

Print History now presents statistics and existing result controls in the dark
card system, with semantic status colors and wrapping job names. The Gcode
Terminal uses the same card/control style while retaining its live output,
`#gcode` input and existing send hook. Settings & Tools no longer presents
Export NanoSupport Settings. The existing AEGIS control remains in
Customization with `#aegis-control-div` and `#aegis-available-toggle`, and
`aegis_checkbox_init()` still follows the Athena printer-type/API response.
Support now names technical and customer support and displays the verified
Discord QR at 124 px on desktop, 88 px on mobile.

### Printer acceptance still required

After an approved deployment, test both normal and Service Mode rendering,
navbar status alignment and collapse, Dashboard news and update states,
Proteus database open/close/import, all four import/restore forms only with
separate authorization, comparison with real profiles, local/USB job upload,
calibration preview and model selection, history result controls, terminal
output/input, AEGIS visibility, and Support QR scanning. Do not execute a
calibration print or a Gcode command as part of visual acceptance.

The Software Update page and `changeUpdateChannel()` workflow were not changed.
On physical Athena hardware, separately test channel change, reboot prompt,
cancel and accept paths, state after reboot, update availability, and update
launch/progress. Do not invoke these operations locally. Deeper Machine
Settings organization is deferred until real-printer testing.
