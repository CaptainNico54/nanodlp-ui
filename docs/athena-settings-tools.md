# Work Package 4: Settings & Tools

> WP5 follow-up: a read-only GET on Athena confirmed `/printer/restore` renders
> `templates/setup/restore.html`, a separate `BackupFile` ZIP page titled
> **Restore Backup**. Pascal confirmed this function has never been tested on
> Athena. WP5 renamed the Service Mode shortcut to **Restore Backup** and added
> an untested-service warning. The WP4 description below records the earlier
> implementation; no restore form or backend was changed.

## Completed scope

Settings & Tools now uses the existing Athena/DragonFruit card and button styles:
Printer, Backup & Restore, Customization, and a distinct Service Tools section.
The existing Enter/Leave Service Mode action is in the page header. Layout uses
three columns on desktop, two on tablets, and one on mobile. Danger styling is
applied to Force Stop, Power Off and Terminate without changing commands.

All existing actions, URLs, command hooks, AJAX classes, data-ajax destinations,
confirmation IDs/text, architecture/OS conditions, and AEGIS/Orion controls are
preserved. Download Debug keeps its name and `/debug` URL. Existing JavaScript is
unchanged. The global stylesheet cache key advances from redesignv96 to v97.

Exports remain normally visible at their existing URLs:

- `/setup/export`: Export Machine Settings
- `/printer/backup`: Export Plates and Settings
- `/setup/export/nanosupport`: Export NanoSupport Settings

The existing `/printer/restore` shortcut is presented as Restore Machine Settings
under Backup & Restore only when `viewMode == 1`. It carries the requested warning:
“Restoring machine settings can replace printer configuration. Use only with a
backup intended for this printer.” Existing service tools retain their original
normal-mode hiding rules. No alternative advanced-mode state was introduced.

**This gates only the Settings & Tools shortcut. It does not establish backend
route protection or change restore behavior.** Other entry points are unchanged.

## Explicitly deferred import work

The user deferred import separation pending verification with Pascal/on a real
Athena printer. `templates/import.html` and `templates/profile/import.html` remain
unchanged, including their form actions, payload names, duplicate import input
IDs, and old NanoDLP repository link.

Verified repository facts:

- Resins Import links to `/import` in templates/profile/profiles.html.
- Settings & Tools links to `/printer/restore`.
- templates/import.html contains the four profile/machine forms posting to
  `/profile/import`, `/profile/fetch`, `/setup/import` and `/setup/fetch`.
- templates/profile/import.html is a separate existing form with an empty action.
- No frozen backend route handlers/binary are present in this checkout. The exact
  templates/variables served by `/printer/restore`, and any additional consumers
  of import.html, cannot be established from these frontend links alone.

Do not infer route behavior from its name. No pathname workaround, new route,
route replacement or restore action was implemented. The old repository URL
was inspected in source; an attempted web fetch failed, so its current usefulness
was not verified. Its removal is deferred with the rest of the import page.

## Retained duplication / existing concerns

- Raspberry Pi settings have two entries (one existing href has trailing whitespace).
- Expand Filesystem appears twice; both confirmation hooks are retained.
- Timezone exists as a normal customization action and a service action.
- Heater and Force Stop controls overlap Dashboard capabilities; retained pending
  a separate decision rather than silently removed.
- Existing Orion switching remains visible normally after its capability read,
  as before; explicit HMI start/stop/restart actions remain service-only here.
- Existing specialized click handlers coexist with the generic a.ajax handler;
  that behavior was not rewritten in this visual package.

## Validation completed

Static fixture evaluation covered `viewMode` 0 and 1 with ARM/Linux and
amd64/Windows conditions. It compared every original action URL, ID, onclick,
data-ajax, data-confirm, AJAX class and inherited hidden state against the new
page. All matched except the deliberately removed normal-mode restore shortcut.
Every original ID remains; no duplicate IDs were introduced in the Tools page.
Import templates and all JavaScript files are unchanged.

Headless Edge fixtures with local Bootstrap 3/jQuery/project CSS passed at 1440,
1200, 1024, 768, 390 and 320px in all four variants. Checks covered no horizontal
page/card overflow, normal controls, exports, customization, Service Tools and
restore visibility, Enter/Leave mode labels, and Orion/AEGIS state loading using
the existing functions with strictly read-only mocked fetch responses. No page
JavaScript errors occurred. Desktop/mobile screenshots were reviewed.

All network navigation was blocked in the fixtures. No restore, printer command,
mode change, export request, or destructive action was executed. Action behavior
was checked by hook comparison rather than invoking commands. Whitespace checks
passed. These fixtures do not run the frozen NanoDLP template engine.

## Printer checks still required

- Confirm native template rendering in both modes, correct service-mode transition,
  OS/architecture conditions and supported browsers, including Safari/mobile.
- Check normal export downloads and Download Debug for valid results.
- Confirm AEGIS availability and Orion labels load from the installed services;
  assess command/confirmation behavior only during separately authorized service work.
- Verify `/printer/restore` purpose, rendered template, context variables and other
  import-template consumers with Pascal/on Athena before separating import views.
  Read-only route inspection is sufficient for this investigation; do not restore.
- Smoke-check WP1-WP3 after deployment; their templates and JS were not changed.
