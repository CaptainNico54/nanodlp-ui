# Unsaved changes in the resin editor

The normal resin editor, service-mode resin editor, and legacy simple editor
warn before leaving when the current form values differ from the loaded profile.
The guard is frontend-only and does not save or alter a profile itself.

## Behavior

- Page links, browser Back/Forward, refresh, and closing the tab use the browser's
  unsaved-changes dialog. Staying preserves the edits; leaving discards them.
- Restoring all original values removes the warning. Numeric display formatting
  such as `1` versus `1.00` does not count as a change.
- Easy/Advanced display switches, setting categories, help dialogs and links
  opening another tab do not leave the editor and do not show the warning.
- A valid Save continues through the existing NanoDLP POST and serialization.
  Failed native validation or a canceled submit keeps the protection active.
- Entering or leaving Service Mode asks before the mode-switch request when
  there are edits, so choosing Stay does not change the server's view mode.

## Implementation decisions

`resin-unsaved.js` is loaded only by the two resin templates, in their `js`
blocks after the common scripts. It tracks forms explicitly marked
`data-resin-editor-form`, excluding the inactive editor form. The machine
settings form also uses `setup` as its ID and is deliberately not opted in.

The baseline is captured one task after jQuery ready. This includes the inline
dynamic-speed conversion, initial checkbox states, Dynamic Wait values,
decimal formatting, AFP clone title setup, and the separate native
DOMContentLoaded UV PWM conversion. Capturing immediately in jQuery 1.x ready
would precede that last conversion and produce a false warning.

The guard compares actual control values when navigation is attempted. Hidden
and disabled profile fields and checked/selected states are included, as are
custom fields. Buttons, display styling, and unnamed hidden configuration
helpers are excluded. This also catches formula-editor `.val()` updates that
do not emit input/change events. The baseline is not made permanently clean
on a Save click or before a server response.

An uncanceled submit from the active form permits one unload, for that exact
post-serialization snapshot. The permission is consumed by the unload and
cleared by further interaction, history restoration, or a one-second fallback
if no navigation follows. Later edits or canceled submissions still warn.
The native `beforeunload` listener remains attached while this editor is open
so programmatic changes without events are covered.

Browsers control the unload dialog's text and buttons and require prior user
interaction. Browser or mobile OS termination cannot be guaranteed to fire
the event; this feature is a warning, not autosave or draft recovery. See
[MDN: beforeunload](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event).

## Validation

Run `node --test tests/resin-unsaved.test.js`. The tests cover initial
normalization, clean/changed/reverted values, hidden and programmatic fields,
checkboxes and selections, invalid numeric input, canceled or invalid saves,
accepted submission, later edits, stale permission, history restoration,
unrelated forms, new-tab submissions, and the service-mode request boundary.
These are behavior tests, not proof of rendered browser-dialog appearance.

For review on a disposable edited value:

1. Open an editable resin profile and change its description. Choose Back or
   another page. Choose Stay in the warning and confirm the description remains.
2. Restore the original description and leave. There should be no warning.
3. Edit again, then refresh or use browser Back. Confirm the warning appears.
4. Confirm Easy/Advanced can be switched while edits remain unsaved.
5. On a profile intended for editing, use Save and verify normal save behavior.
   A missing required name should keep the editor and its protection active.

No profile save or mode-switch request is needed for automated deployment
verification. Actual Save acceptance is a user-controlled review step.
