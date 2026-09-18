# Support & Connectivity: hooks and diagnostic-download investigation

## Work Package 3 scope

Presentation only: support template, shared design CSS, CSS cache key, and a
separate data-processing table component. No JavaScript, backend, command, route,
request payload, consent default or connectivity default changed.

### Preserved hooks

| Element / hook | Consumer / purpose |
| --- | --- |
| SupportForm; name/email/report field names | Existing ticket form |
| SupportNameField, SupportEmailField, SupportTextField | athena.js reads values and clears fields after Send |
| SupportAiAnalysisField; ai_analysis | Existing checked-by-default AI consent, serialized as a boolean |
| SupportSubmitButton | Existing athena.js click handler; now a semantic type=button, avoiding native submit/navigation |
| support_notification, modalLabelSmall, anotherbar | Existing Bootstrap busy modal and progress display |
| iot-control | support.js reveals controls after state loads |
| iot-control-toggle-row, iot-control-toggle; iotControlToggle | Cloud toggle and state |
| asset-sync-toggle-row, asset-sync-toggle; assetSyncToggle | Asset sync toggle and state |
| iot-control-qr, iot-control-text | Existing cloud-state visibility |
| iot-control-printername, iot-control-printerserial | Existing identity response |

support.js remains loaded once and untouched. State loading still reads
`/athena-iot/printer_name`, `/athena-iot/mqtt/status` and
`/athena-iot/asset_sync/status`; user toggles POST the existing `{status: boolean}`
payloads. Printer pairing uses `/athena-iot/mqtt/qrcode` unchanged.

Resource links and Discord QR source remain identical. The Discord PNG has
transparent pixels and white artwork, so it uses a dark backing. Resource cards
stack on tablets; ticket and connectivity stack below 992px, ticket first.
The complete original eight-row service table is retained below both panels,
with horizontal scrolling confined to its focusable wrapper on narrow screens.
Consent and data transmission wording remain visible, not collapsed.

## Local diagnostic download: findings and decision

| Evidence in repository | What it establishes | What remains unknown |
| --- | --- | --- |
| setup/tools.html links to `/debug` as Download Debug | An existing download route is already exposed in Tools | Contents of this frozen binary's archive; equivalence to the Athena ticket bundle |
| main.js display_console_log GETs `/log` | Existing console-log text endpoint | Completeness beyond NanoDLP console output; no evidence of an archive |
| athena.js support helper POSTs `/gcode` with an Exec of `/home/pi/athena-debug-submission.sh` | Ticket submission invokes an external diagnostic collection/submission script | Script source, collected files, any local-only mode or local archive path; script is absent here |
| athena.js polls `static/tickets/<timestamp>` | Existence/HTTP success is used as a ticket completion marker | No evidence this marker is the diagnostic package; response body is never consumed |
| index-progress.html references `/debug/send` | Existing report-send action | Not a local-only download capability |

No Download Diagnostic Log button added: there is not enough evidence that
`/debug` supplies the same useful Athena diagnostics. No new route, shell command,
or guessed archive path was introduced. `/debug` remains available in Tools.

Next investigation should inspect the frozen binary's `/debug` archive and the
installed Athena submission script on an authorized test printer, then compare
file inventories. If `/debug` is sufficient, its existing URL can be exposed
without backend work. Otherwise a local-only package needs a separate functional
proposal. Do not invoke the submission script merely to inspect it.

## Validation performed

- Static comparison preserved every original ID, form-field name, resource URL,
  image source and service-table cell. No duplicate IDs in the assembled page.
- Headless Edge fixture using Bootstrap 3, jQuery, the real support.js and the
  exact support helper section from athena.js; HTTP and ticket transport mocked.
  No real tickets, cloud changes or printer commands were sent.
- Responsive checks at widths 1440, 1200, 1024, 768, 390 and 320: resource columns,
  ticket/connectivity order and no document horizontal overflow. Desktop/mobile
  screenshots reviewed. Table overflow remains inside its wrapper.
- Initial state reads do not POST. Both enabled/disabled states load; toggles
  preserve POST bodies and control QR/manual-identity visibility.
- Send reads the expected fields and AI opt-out, encodes the same JSON keys and
  constructs the same /gcode submission. Successful marker polling and AJAX
  failure drive the existing toast/modal handlers without page JS errors.
- Existing WP1/WP2 files and JS are unchanged. CSS additions are support-scoped;
  global stylesheet cache key incremented.

## Existing issues retained for functional review

- Ticket click handling bypasses native required/email validation and clears
  entered details before submission succeeds. Repeat clicks are not disabled.
- The ticket timeout handler does not return before the final poll; a successful
  response at the timeout boundary could produce both failure and success notices.
- An immediate AJAX failure during the Bootstrap modal opening transition can
  leave it visible because Bootstrap ignores a hide during transition. Normal
  post-transition failure handling was validated; resolving this race is separate.
- Connectivity fetches/POSTs have no error recovery or save confirmation. Failure
  in the sequential initial identity/state requests can prevent later controls
  from loading or handlers from attaching; a failed POST can leave optimistic UI.
- Existing pairing QR/manual identity are initially visible until cloud state
  loads. Their initial visibility and state-driven behavior were preserved.

## Printer acceptance still required

Verify rendering/includes on the frozen NanoDLP binary, existing external links
and Discord scanning, real printer pairing QR scanning, mobile/Safari layout,
cloud and asset-sync state persistence, and name/serial display. With explicitly
authorized test submissions, check AI consent on/off, actual ticket arrival,
confirmation email/data link, log/config attachment completeness, success/error
and timeout behavior. Check inaccessible IoT services separately for the existing
failure behavior above. WP1 live stream/LED/video and WP2 modal/navbar should also
receive a smoke check after deployment.
