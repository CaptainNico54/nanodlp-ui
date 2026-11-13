# Configurable dashboard feasibility

Investigation date: 12 November 2026. Source baseline: `281f62bdc2eae8c31d9db0a3e196efd853f2fea0` in `CaptainNico54/nanodlp-ui`, which includes upstream `c464e2577ee86bd142a4ac9af3729d394ce36ea4` and the terminal display filters. This report assesses user request 4. It does not implement the dashboard overhaul or change a printer.

## Conclusion

A configurable dashboard is feasible within the existing frontend. Users can add supported panels, hide them, change their order, choose useful sizes, and save their layout in their browser without changing the NanoDLP binary. Existing routes already provide much of the required data and all the requested navigation destinations.

The substantial work is converting fixed page code into reusable panels. Several current functions assume one particular DOM structure and one instance of each widget. Adding a drag library alone would not solve those assumptions. The first release should keep one instance of each panel, offer a small number of size presets, and retain a dependable default layout. A later release can add finer drag and resize behavior.

The principal backend limitation is persistence shared across browsers or users. No dashboard-layout write endpoint or account-preference service was identified in the inspected frontend. Local browser preferences are practical; automatically synchronizing the same personal layout between a desktop, phone, touchscreen, and partner's computer is not established by the current interface.

These are source-backed feasibility conclusions, not a deployed prototype. No new endpoints were called or invented for this investigation.

## What the current frontend provides

The dashboard is an existing route, `/`, rendered through `templates/index.html`. It already includes separate HTML components for print progress, environment control, the analytics chart, and the camera. This provides a useful starting point for a panel registry. The page has a fixed Bootstrap column hierarchy, and CSS changes its layout during printing. [Dashboard template][dashboard] [Dashboard styling][styles]

New panels can be rendered inside this existing page. A new settings route is unnecessary: an **Edit dashboard** button can open a Bootstrap modal or an inline edit mode. The repository explicitly documents that new `/custom/...` routes require registration in the NanoDLP binary, so adding a new template filename must not be mistaken for adding a working route. Existing modal patterns already avoid that limitation. [Custom route notes][routes]

The server-rendered context is another boundary. A `profiles` or `prints` loop in the Resin or History template does not prove that those variables are available to the dashboard handler. A frontend panel should obtain its data through an established route, rather than assuming that a new template include will receive additional backend data.

## Panel feasibility and confirmed routes

The table distinguishes a route used in the inspected source from an API contract that has not yet been demonstrated. Proposed panels should preserve the current machine's access and manufacturer-lock behavior.

| Panel | Existing source and data route | Frontend implementation | Boundary or remaining check |
|---|---|---|---|
| Current print and layer preview | `GET /status`; current progress template; layer PNG and existing preview paths | Move the existing single progress component into a panel wrapper and retain its established status updates. | Keep current-job status and pause/stop accessible while printing. Do not let layout configuration override printer-state rules. [Status code][main] [Print progress][progress] |
| Analytics | `GET /analytic/data/<range>` and the existing chart renderer | Reuse the dashboard metric configuration and chart rendering work; let the panel have compact/standard/wide sizes. | Chart instance IDs, global configuration, caches, and resizing need a panel lifecycle. Filtering selected series does not alter server analytics. [Chart widget][chart] [Chart renderer][analytics] |
| Recent jobs | `GET /plates/list` returns the server-rendered jobs fragment. `GET /json/db/plates.json` is already used to map plate IDs to names. | A data adapter can extract a small set of rows from the established fragment and render a compact list with preview and existing job actions. Start with five rows and a Jobs link. | Prefer the rendered fragment for action eligibility: raw `plates.json` is not established here as a complete readiness/permission contract. Preserve profile errors, processed/re-slice state, warnings, print state, and resume behavior. [Job list][jobs] [List refresh][main] [Existing JSON consumer][timelapse] |
| Resins | `GET /profiles`; existing edit links are `/profile/edit/<ProfileID>` | Read the list page as inert HTML, extract the list fields and permitted edit links, then open the existing editor. No inline editor rewrite is needed. | No dedicated resin-list JSON endpoint was confirmed by this inspection. Preserve disabled edit actions for `ManufacturerLock`. The adapter must be tested against the installed page format. [Resin list][resins] |
| Recent timelapse clips | `GET /athena-iot/control/timelapse_get_all`; processing status at `/athena-iot/control/timelapse_processing_status?plateid=...`; existing gallery at `/custom/webcam` and plate-filter links at `/custom/timelapse?plateid=...` | Render the latest few returned clips, open one existing-style player modal, and provide a gallery link. | These are Athena IoT endpoints, not a generic NanoDLP API. Handle the service or camera being unavailable. A first version should omit deletion and should not autoplay clips. [Timelapse client][timelapse] [Gallery component][gallery] |
| News | `https://dashboard.concepts3d.eu/dashboard.html`; existing parsed `.update-item` feed | Reuse the existing parser and safe text/link rendering for a compact news panel. | Internet/CORS availability is inherited from the existing feature. Show an unavailable state without affecting local printer panels. Avoid a second independent feed request. [Feed client][news] |
| G-code terminal | `GET /term-io` for display; existing manual send uses `POST /term-io` with `gcode` | Reuse the display filters for a compact output panel and an Open terminal link. A full command-entry variant can reuse the established send action. | The current terminal is a singleton with global state and a polling timer. Mount it once, stop display polling when removed, and preserve the raw display snapshot/analytics separation. Do not bind a send action to layout controls. [Terminal functions][main] [Terminal template][terminal] |
| Print history | `GET /plates/history`, rendered from `prints`; existing result actions use `/plate/result/<PlateID>/<PrintID>/<status>` | Parse a limited number of visible history rows into a summary panel with a Print history link. | A history JSON API was not confirmed. Begin with read-only history summaries; result marking can remain on the full page. Keep the route's access restrictions and existing status meanings. [History page][history] [Menu visibility][menu] |
| Live camera | `GET /athena-camera/state` and stream at `/athena-camera/stream` | Wrap the current stream as a single panel and use its existing stop/start methods when the panel is hidden or restored. | Camera detection currently changes other dashboard columns. That layout side effect must be removed from configurable mode. [Camera client][camera] |
| Environment and printer controls | Existing environment template, `/analytic/value/<id>` reads, and existing heater/motion actions | Keep one instance of the existing components and move their wrapper, retaining state rules and action handlers. | Environment code expects specific DOM IDs and starts one-second timers. Removing a panel should stop only its UI updates, never change heater/fan/motion settings. [Environment client][environment] [Dashboard controls][dashboard] |

### Jobs: reuse the existing start workflow carefully

The existing start link is `/printer/start/<PlateID>`, rendered only under the template's current state conditions. The link uses `.ask` and `data-ask="start-confirm"`. Resume uses a POST form to the same route with `LayerID`. The dashboard should reuse these established destinations and semantics, not turn an arbitrary ID from a cached list into a new start action. [Job action markup][jobs]

There is a specific integration trap: `confirm_init()` allows the original action to continue if its matching confirmation text element is absent. A compact card that copies `.ask` but omits `#start-confirm` could unintentionally lose the confirmation. The panel must include the required text once, or explicitly call the existing `c3dConfirm()` flow. Editing a layout must never follow job links. [Confirmation implementation][main]

A useful first version is **Recent jobs: 5**, showing name, resin, layer count or estimated time, readiness, and Preview/Start. Refresh the relevant server-rendered state before enabling a start action and when printing starts or stops. Use a stale/unavailable state if the refresh fails. The source establishes frontend checks and actions; it does not establish the backend's protection against every stale-state race, so browser checks must not be described as an atomic lock.

If the panel offers **Recently printed** as an alternative order, preserve the existing comparator: the displayed `LastPrint` value represents an age, and zero means never printed. Treating it as a Unix timestamp or reversing the age comparison would reintroduce the earlier sorting issue. [Job sorting implementation and regression test][jobtests]

## Frontend changes required before panels can move safely

### 1. Give the dashboard one layout owner

Today the structure is `control-column` plus `webcam-column`, with the heater/printer controls nested inside a control row. `camera.js` changes Bootstrap column classes when a camera is available. `environment-control.js` also hides and resizes columns when heaters are absent. `redesign.css` has separate no-camera, idle, and printing layout rules. A saved user layout would compete with those rules unless the new dashboard layout manager becomes the sole owner of card placement. [Camera layout changes][camera] [Environment layout changes][environment] [Layout CSS][styles]

Hardware availability should become panel state, such as available/unavailable, rather than a command to resize neighboring cards. Printing state should continue to control which physical actions are offered. Neither state should overwrite the user's saved panel order.

### 2. Preserve single instances first

Existing code relies on IDs such as `machine-status`, `image_wrapper`, `uplot-1`, `livestream-container`, `heater-form`, and `terminal`, plus globals such as `streamer`, `uplots`, and terminal preferences. The chart widget declares global configuration and starts itself on document ready. Repeating those templates can cause duplicate IDs, repeated timers, global declaration collisions, or handlers updating the wrong panel. [Dashboard template][dashboard] [Chart widget][chart] [Camera client][camera] [Terminal functions][main]

For the first release, each panel type should be addable once. Move its existing DOM node instead of cloning it. Keep common modals outside the movable grid and include each once. Supporting multiple charts or multiple terminal instances is possible later, but requires instance-scoped state and IDs.

### 3. Add a panel lifecycle

Each panel needs a small contract: mount, show, hide, resize, and dispose. The dashboard should own all interval handles, requests, event subscriptions, and observers associated with it.

- Adding or showing a panel starts only its needed updates.
- Hiding/removing a panel cancels its UI requests/timers and discards stale responses.
- Moving a panel preserves its current state and does not repeat initialization.
- Disposing the page stops streams and timers.
- Multiple panels share status data rather than creating another `/status` poll each.

The current status updater, chart, terminal, environment, and camera all have their own update mechanisms. Some timers are started without retaining a handle. Timelapse code already has an explicit `stopEncodingStatusPoll()`, which illustrates a useful cleanup pattern but is not a complete dashboard lifecycle. [Main updates][main] [Chart timer][chart] [Environment timers][environment] [Timelapse cleanup][timelapse]

This refactor only governs what the browser reads and draws. Hiding Environment Control must not turn off a heater; removing Printer Control must not send a motion command.

### 4. Resize charts when their card changes

The chart renderer currently listens for window resize and maintains a global `uplots` list. A card can change width without the browser window changing, especially after a drag, size preset, or neighboring panel removal. The layout manager therefore needs to notify the chart on card resize, preferably through a `ResizeObserver` on the card and the existing chart size API. A hidden zero-width chart should be sized when shown again. [Chart resize code][analytics]

### 5. Use data adapters instead of embedding whole pages

Jobs, resins, and history can be adapted from the existing routes. Parse returned HTML inertly and extract only supported fields, links, state markers, and warnings. Do not inject the full page, rerun its scripts, or copy its navigation/modal IDs into the dashboard.

For jobs specifically, the existing `#plates-list` refresh inserts the entire jobs fragment and the thumbnail observer watches that root. A compact dashboard list should either have an explicit adapter and its own wrapper, or the shared renderer should accept a target and compact mode. Simply reusing `#plates-list` could allow the normal refresh to replace the compact panel with the full page fragment. [List refresh][main] [Thumbnail lifecycle][thumbs]

## Recommended user experience

Add **Edit dashboard** beside the dashboard heading. Normal mode keeps the current printer interface behavior. Edit mode exposes panel handles, Add panel, Remove, size choices, and **Save**, **Cancel**, and **Reset layout**.

Start with a responsive CSS grid and a few supported widths, such as half-width and full-width, with panel-specific height presets where necessary. Use move-up/move-down controls as an accessible baseline; drag ordering can be added without making it the only way to arrange the page. Phones should use a single ordered column. Arbitrary pixel positioning is unnecessary for a useful first version and creates more collision, empty-space, and viewport migration problems.

The source already ships Bootstrap 3, jQuery, uPlot, and Toastr. No dashboard layout manager was identified in the inspected dependency tree. A new library is therefore optional, not a prerequisite. A drag/resize package should be selected only after deciding whether free sizing is actually needed, with its touch/keyboard behavior and maintained version checked at that time. The existing editor's isolated draggable utilities are not an established dashboard framework.

Recommended first panel rules:

- One instance per panel type.
- Current-print status and pause/stop remain available while a job is running, regardless of optional card choices.
- Optional jobs, resins, history, news, timelapse, camera, and terminal panels can be removed and restored.
- Settings such as job count, job order, chart metrics, and terminal filters are changed from that panel's menu.
- Default layouts are available for compact monitoring and general operation, while Reset returns to the shipped layout.
- Layout editing cannot activate printer controls or start a job.

These are recommended product choices, not restrictions imposed by the NanoDLP binary.

## Saving and sharing layouts

Use a versioned preference object in browser storage containing panel type, order, size preset, visibility, and each panel's supported settings. Validate panel names and ranges against a built-in registry. Restore a known default if saved JSON is missing, corrupt, or from an unsupported schema version. If storage is unavailable, keep the layout usable for the current page and explain that saving could not persist.

Browser storage is scoped to the site's origin and browser profile. The same printer opened through a different IP/hostname, a different browser, or another device may therefore have a different layout. Clearing site data removes the local preference. Do not call this printer-wide or account-synchronized storage.

An **Export layout / Import layout** JSON file is a frontend-only way to copy a layout between devices. It should contain layout preferences only, with no commands, arbitrary HTML, scripts, credentials, or machine settings. A centrally synchronized layout would need a separately established writable service or backend endpoint. The existing machine-settings and G-code execution mechanisms should not be repurposed as an undocumented preference database.

## Suggested implementation phases

| Phase | Deliverable | Why this order |
|---|---|---|
| 1 | Refactor the existing dashboard panels into a registry; introduce layout edit mode, order/visibility/size presets, reset, and browser persistence. Keep the current default appearance. | Establishes lifecycle and layout ownership before adding data consumers. |
| 2 | Add Recent jobs, Resins, and Recent timelapses. Reuse existing editor/preview/gallery destinations and preserve existing start confirmation and readiness behavior. | These are the most useful shortcuts and have established routes. |
| 3 | Add News, compact terminal output, and Print history; share fetchers and add layout export/import. | Completes the requested panel set after adapters and cleanup are stable. |
| 4 | Evaluate multiple chart instances, more granular sizing/dragging, printer-wide defaults, or synchronized preferences. | These require either more frontend isolation or a new persistence contract. |

The Tare, preview correction, and metric-selection work can be delivered independently of these phases. They do not require a dashboard overhaul first.

## Acceptance checks for a future prototype

1. Reorder, hide, restore, and resize every panel; refresh; verify saved values and Reset/Cancel behavior. Exercise invalid preferences and unavailable storage.
2. Test desktop, narrow mobile, and the printer HMI viewport. Check both keyboard and touch controls, real chart sizing, and layer-image aspect after layout changes.
3. Replay idle, preparing, printing, paused, halted, completed, disconnected, camera-unavailable, and heater-unavailable states. Confirm current-job controls remain usable and stale job data does not expose an enabled start action.
4. Add/remove panels repeatedly and inspect request counts, interval handles, streams, and event handlers. There should be no multiplying polls, duplicate command sends, or responses writing into disposed panels.
5. Mock all action endpoints while validating layout interactions. Verify every layout action makes zero printer-control requests. Separately verify the established confirmation and navigation flow for job start and resin editing.
6. Verify terminal filters remain display-only and analytics data continues independently of visible panels. Hiding the chart must not change data collection.
7. Test large job/resin/history lists, absent or malformed optional fields, feed failure, and slow/failed requests. Optional panels should fail independently and keep the last clearly marked valid state where appropriate.

## Open questions that affect later scope

The initial implementation can proceed with the defaults above. These decisions matter before expanding it further:

- Whether a single browser-local layout is sufficient or cross-device synchronization is a requirement.
- Whether presets and reorder controls satisfy positioning needs or free drag/resize is essential.
- Whether several instances of the same panel are needed.
- Whether the installed backend exposes stable profile/history JSON that can replace HTML adapters. The inspected source does not establish those endpoints.

No backend source access is required for the recommended first three phases, provided the existing route contracts are verified on the supported printer builds. New arbitrary routes, shared persistent preferences, new telemetry not already exposed, and stronger server-side transaction guarantees remain outside what this frontend repository alone can establish.

[dashboard]: https://github.com/CaptainNico54/nanodlp-ui/blob/281f62bdc2eae8c31d9db0a3e196efd853f2fea0/templates/index.html
[styles]: https://github.com/CaptainNico54/nanodlp-ui/blob/281f62bdc2eae8c31d9db0a3e196efd853f2fea0/public/css/redesign.css
[routes]: https://github.com/CaptainNico54/nanodlp-ui/blob/281f62bdc2eae8c31d9db0a3e196efd853f2fea0/docs/athena-custom-routes.md
[main]: https://github.com/CaptainNico54/nanodlp-ui/blob/281f62bdc2eae8c31d9db0a3e196efd853f2fea0/public/js/main.js
[progress]: https://github.com/CaptainNico54/nanodlp-ui/blob/281f62bdc2eae8c31d9db0a3e196efd853f2fea0/templates/components/print-progress.html
[chart]: https://github.com/CaptainNico54/nanodlp-ui/blob/281f62bdc2eae8c31d9db0a3e196efd853f2fea0/templates/dashboard-widgets/pressure-chart.html
[analytics]: https://github.com/CaptainNico54/nanodlp-ui/blob/281f62bdc2eae8c31d9db0a3e196efd853f2fea0/public/js/analytics.js
[jobs]: https://github.com/CaptainNico54/nanodlp-ui/blob/281f62bdc2eae8c31d9db0a3e196efd853f2fea0/templates/plate/list.html
[timelapse]: https://github.com/CaptainNico54/nanodlp-ui/blob/281f62bdc2eae8c31d9db0a3e196efd853f2fea0/public/js/timelapse.js
[resins]: https://github.com/CaptainNico54/nanodlp-ui/blob/281f62bdc2eae8c31d9db0a3e196efd853f2fea0/templates/profile/profiles.html
[gallery]: https://github.com/CaptainNico54/nanodlp-ui/blob/281f62bdc2eae8c31d9db0a3e196efd853f2fea0/templates/components/camera-timelapses.html
[news]: https://github.com/CaptainNico54/nanodlp-ui/blob/281f62bdc2eae8c31d9db0a3e196efd853f2fea0/public/js/updates-feed.js
[terminal]: https://github.com/CaptainNico54/nanodlp-ui/blob/281f62bdc2eae8c31d9db0a3e196efd853f2fea0/templates/term.html
[history]: https://github.com/CaptainNico54/nanodlp-ui/blob/281f62bdc2eae8c31d9db0a3e196efd853f2fea0/templates/plate/history.html
[menu]: https://github.com/CaptainNico54/nanodlp-ui/blob/281f62bdc2eae8c31d9db0a3e196efd853f2fea0/templates/menu.html
[camera]: https://github.com/CaptainNico54/nanodlp-ui/blob/281f62bdc2eae8c31d9db0a3e196efd853f2fea0/public/js/camera.js
[environment]: https://github.com/CaptainNico54/nanodlp-ui/blob/281f62bdc2eae8c31d9db0a3e196efd853f2fea0/public/js/environment-control.js
[jobtests]: https://github.com/CaptainNico54/nanodlp-ui/blob/281f62bdc2eae8c31d9db0a3e196efd853f2fea0/tests/job-sort.test.js
[thumbs]: https://github.com/CaptainNico54/nanodlp-ui/blob/281f62bdc2eae8c31d9db0a3e196efd853f2fea0/public/js/job-thumbs.js
