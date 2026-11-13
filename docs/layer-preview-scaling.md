# Layer preview scaling

## Confirmed cause

The dashboard and full Analytics status panel use `image_display()` in
`public/js/main.js`. The earlier physical-size correction was confined to the
separate job-preview page's `#preview img` in `public/js/preview.js`.

The status-panel path used the server's `displayRatio` as a percentage width,
while CSS capped that width and applied `object-fit: contain`. The inspected
16K dashboard supplied `2.429534`, matching 15136 / 6230 logical pixels. With
14 by 19 micrometre pixels, the physical ratio is approximately 1.79018.
Keeping a PNG's natural aspect also retains any reduction or packing of its
horizontal dimension. These are two independent reasons for incorrect shape.

## Geometry and observed image families

Use the printer's configured physical display aspect:

`(ProjectorWidth * XYRes) / (ProjectorHeight * YRes)`

`YRes` is an optional override; a missing or zero override uses `XYRes`.
Invalid geometry is not replaced with a guessed resolution or aspect ratio.

| Configuration | Logical raster | Observed numbered PNG dimensions | Physical aspect |
| --- | --- | --- | --- |
| 12K, 19 by 24 micrometres | 11520 x 5120 | 3840 x 5120 RGB8; 11520 x 5120 grayscale | 1.78125 |
| 16K, 14 by 19 micrometres | 15136 x 6230 | 7568 x 6230 grayscale; 15136 x 6230 grayscale | Approximately 1.79018 |
| 16K, 14 by 19 micrometres | 15120 x 6230 | 5040 x 6230 RGB8 | Approximately 1.78829 |
| 8K, square pixels | 7680 x 4320 | 2560 x 4320 RGB8; 7680 x 4320 grayscale | 1.77778 |

These dimensions were read from existing local job metadata and PNG headers.
For a real 2,003-layer 12K export, first, middle, and last images all measured
3840 x 5120 against a declared 11520 x 5120 logical raster. The repository's
`sample-configs/db-12/machine.json` supplies the 19/24 micrometre pixel pitches.
The images need not be classified by slicer to set the display geometry.
Some re-exported archives label the program NanoDLP even when their supplied
filenames describe DragonFruit input; filenames alone do not prove encoding.

## Change

Both preview paths now share the physical-ratio calculation. The status panel
fits an explicit image rectangle inside the available frame, then stretches
only the layer image (`img.two`) into that rectangle with `object-fit: fill`.
The 3D model image (`img.three`) keeps its existing natural-aspect containment.
The source PNG, printer framebuffer, slicing, and exposure data are unchanged.

Sizing is refreshed after the layer image is created or replaced and when its
frame changes size. The geometry request is shared and cached for the page.
Failed or invalid reads are not cached permanently: later dashboard image
updates can retry after a 30-second cooldown. Until valid geometry is available,
the normal image fallback remains. Reloading also retries configuration.

## Verification and limits

`node --test tests/preview-aspect.test.js` covers physical pixel pitch, missing
Y overrides, width/height bounds, full/half/RGB-packed rasters, preservation of
the 3D image, hidden frames, shared configuration loading, and bounded recovery.
Reported one-eighth-width encoding is covered by synthetic geometry cases;
no actual one-eighth-width PNG was found in the inspected archive selection.

The archive checks establish actual 12K image dimensions without a 12K printer.
They do not establish a successful 12K hardware print or a live deployment.
Visual browser acceptance is recorded separately in the alpha-feedback report.
