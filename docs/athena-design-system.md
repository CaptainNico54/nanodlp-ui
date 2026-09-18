# Athena WebUI design system — implementation reference

For Pascal's Proteus and mobile work. These values describe the current WebUI in
`public/css/redesign.css` and `public/css/athena.css`; they are a shared visual
reference for Athena WebUI, OrionHMI, DragonFruit, Proteus, and the Concepts3D
mobile app. Preserve each surface's platform conventions while keeping the same
color, type, spacing, and status language.

## Typography

- **Family:** Atkinson Hyperlegible, with sans-serif fallback. The WebUI loads
  regular, bold, italic, and bold italic font files in `athena.css`.
- **Weights:** 400 for body copy; 600 for controls and compact labels (browser
  synthesis where a 600 file is unavailable); 700 for headings, values and
  selected states.
- **Hierarchy:** page titles 26 px/700; card headings around 18 px/600–700;
  row titles 15–16 px/700; body 14–15 px; metadata and uppercase eyebrows
  12 px. Eyebrows use 700 weight, 0.14em tracking, and Athena gold.

## Color tokens

The hex values in the **mobile fallback** column for `color-mix()` tokens are
calculated sRGB approximations, rounded to the nearest 8-bit channel. Keep the
CSS expression as the WebUI source of truth.

| Role | WebUI token / source | Mobile fallback |
| --- | --- | --- |
| Page background | `--df-bg: color-mix(in srgb, var(--brand-accent) 5%, #0b0d12)` | `#161515` |
| Surface 0 / cards | `--df-surface-0: color-mix(in srgb, var(--brand-accent) 8%, #10131a)` | `#221f1e` |
| Surface 1 / inputs, raised areas | `--df-surface-1: color-mix(in srgb, var(--brand-accent) 9%, #191c24)` | `#2c2928` |
| Surface 2 / hover, selected dark area | `--df-surface-2: color-mix(in srgb, var(--brand-accent) 10%, #22252e)` | `#373331` |
| Subtle border | `--df-border-subtle: color-mix(in srgb, var(--brand-accent) 12%, #272a33)` | `#3f3a36` |
| Strong border | `--df-border-strong: color-mix(in srgb, var(--brand-accent) 14%, #353944)` | `#4f4945` |
| Athena gold | `--brand-accent` | `#f0ad4e` |
| Gold hover | `--brand-accent-hover` | `#e59c36` |
| Ink on gold | `--brand-accent-ink` | `#1d1307` |
| Strong text | `--df-text-strong` | `#f8f6f1` |
| Muted text / indicators | `--df-text-muted`, `--df-indicator` | `#cbc5ba` |
| Info blue | `--c3d-info` | `#8ab4f8` |
| Success | `--df-success` | `#2eb67d` |
| Danger | `--df-danger` | `#e45454` |
| Warning | `--df-warn` | `#f0ad4e` |

## Components and layout

- **Surfaces:** page background is darkest, cards use surface 0, inputs and
  raised controls use surface 1, and hover areas use surface 2. Cards have a
  subtle border, 14 px radius and a low `0 8px 24px rgba(0,0,0,.28)` shadow.
  Strong borders distinguish interactive controls and dropdowns.
- **Controls:** primary actions are gold with dark ink; secondary actions are
  dark ghost buttons with a strong border; danger actions use red. Selected
  chips and tabs use gold, while information actions use blue. Status colors
  should communicate state consistently, not decorate ordinary content.
- **Inputs:** dark surface, strong border, light text and a gold focus border.
  Buttons and inputs use a 6 px radius. Dropdowns use a 10 px radius and a
  deeper shadow. Major cards use 14 px corners.
- **Spacing:** compact controls, 8–12 px gaps within groups, roughly 18–20 px
  between cards, and about 22 px inner padding on larger workflow cards.
  Avoid artificial vertical centering; content follows the heading naturally.
- **Width and breakpoints:** the shared container is capped at 1600 px with
  24 px side padding. Grids commonly move from three/two columns to fewer
  columns around 1100–992 px and to one column below 768 px. Controls wrap on
  smaller screens; long names and metadata must not force horizontal scroll.

Use existing WebUI assets and hooks when adapting a feature. Proteus's embedded
iframe has its own UI; the NanoDLP shell styles only its surrounding card.
