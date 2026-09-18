# Athena custom page routes

Athena HTML templates in `templates/athena-*.html` are served by the **NanoDLP binary**, not by this repository alone.

| URL | Template |
|-----|----------|
| `/custom/webcam` | `athena-webcam.html` |
| `/custom/heater` | `athena-heater.html` |
| `/custom/calibration` | `athena-calibration.html` |
| `/custom/timelapse` | `athena-timelapse.html` |

When adding a new Athena page, register the route in the NanoDLP source/binary so the URL resolves; then add a menu link in `templates/menu.html`.

## Combined camera page

The Athena menu links to `/custom/webcam` as **Camera & Timelapses**. Both webcam
and timelapse templates include `components/camera-timelapses.html`, preserving
old routes and plate-filter query links without changing the locked binary.
