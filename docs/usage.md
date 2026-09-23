# Usage

1. **Paste a screenshot** — `Cmd/Ctrl+V` or *Image → Paste Screenshot*. Reads
   an image straight from the OS clipboard.
2. **Drag a rectangle** over the region to highlight. It's assigned to the
   currently active group (`1`–`5` or `M`, shown in the status bar) and
   immediately painted with that group's color shift, or masked if the
   active group is `M`. Rectangles smaller than 3×3 px are discarded as
   accidental clicks.
3. **Copy or save the result** — `Cmd/Ctrl+C` copies the highlighted image
   back to the clipboard; `Cmd/Ctrl+S` saves it as a PNG.

Pasting a new screenshot clears all rectangles and undo history but keeps
your profile and group configuration.

## Groups, profiles, and direction

There are 5 **colour groups** (keys `1`–`5`), each bound to one of 5
**profiles**. A profile is an RGB shift vector — `r`, `g`, `b`, each in
`-255..255` — added to every pixel inside rectangles assigned to a group
pointing at it. A group also carries its own **direction sign** (`+1` or
`-1`), so two groups can share one profile and render exactly opposite
shifts (e.g. one lightens an area, the other darkens it by the same
amount). A 6th group, `M` (mask), is reached the same way as `1`–`5` but
carries no colour binding — every rectangle assigned to it is masked
instead (see below).

The status bar holds six group buttons (`1`–`5`, `M`) plus a light/dark
button for the active group — inert while `M` is active, since a mask has
no direction. Press `p` to open the picker for the active group: colour
groups get a 2-row grid (Light / Dark); `M` gets a 1-row Mask menu (see
below). Picking a light/dark cell sets the profile *and* direction for the
active colour group in one undo step. Edit a profile's vectors from the
picker with `E` or shift-click on a light/dark cell, which opens the
slider/numeric panel: per-channel R/G/B for both sides, a "Mirror dark side"
checkbox, *Reset*, and *Close*.

## Masking

`m`/`M` selects the `M` group — makes it active, or (with a selection)
moves the selected rectangles into it, exactly like a digit key does for a
colour group. Every rectangle in `M` is masked with the group's current
style, repainted from the region's own geometry and colour statistics, not
the pixel underneath.

Four styles, picked from the `M` group's Mask menu (`p` while `M` is
active) with `1`–`4`:

- **Noise** (default) — speckled grain in the region's own colours.
- **Pixelate** — a coarse mosaic averaged from the pixels underneath.
- **Light** — a fixed light grey box.
- **Dark** — a fixed dark grey box.

Noise, light, and dark never read the pixel underneath — nothing in the
export can be reversed back to the source. **Pixelate is the exception**:
each block is an average of the source pixels, so the original content is
still recoverable by a determined attacker (mosaic inversion attacks).
It's offered for tidiness, not for secrets.

A mask always hides the pixels underneath, whichever was drawn first —
dragging a highlight across a masked area cannot uncover it, but does tint
the mask's own colour with that group's shift.

## Selecting and reassigning existing rectangles

- **Click a rectangle** to select only it. Click empty canvas to clear the
  selection.
- **Ctrl/Cmd+click a rectangle** to add it to the selection, or remove it if
  it's already selected — the usual multi-select toggle.
- **With one or more rectangles selected, press `1`–`5` or `m`/`M`** to
  reassign all of them to that group, as a single undo step — this also
  makes that group active, exactly like pressing the key with nothing
  selected. Normal digit-key behavior when nothing is selected is
  unaffected — reassigning existing rectangles is independent of which
  group new drags go into.
- Selected rectangles get a solid blue outline; `Escape` clears the
  selection (or closes an in-progress drag / any open popup first, if
  either is active).

## Resize

Press `r` (or *Image → Resize Image…*, `⇧⌘R` / `Ctrl+Shift+R`) to open the
resize popup. It re-decodes the pasted screenshot from the clipboard bytes
hlit retains in memory, so every scale — including going back to 100% — is
reached at full fidelity; there's no cumulative blur from repeated resizes.

Drag the slider or use the anchors (`1`–`6` for 100/75/66.7/50/33.3/25%,
magnetic within 2 points) and press `Enter` to apply, or `q`/`Esc` to cancel.
Applying rescales every rectangle to match — highlights stay on the same
image features — and updates the status bar with the new dimensions and
scale (e.g. `1920×1080 · 2 rects · 50%`; the scale suffix is omitted at
100%). Undo/redo history survives a resize. `Cmd/Ctrl+C` and `Cmd/Ctrl+S`
export at the currently active scale (WYSIWYG).

## Shortcuts

| Key | Action |
| --- | --- |
| `1`–`5` / `m` `M` | Select the active group, or reassign the selected rectangles |
| `Tab` / `⇧Tab` | Next / previous active group (cycles `1 2 3 4 5 M`) |
| `p` | Open the picker for the active group |
| `t` | Open the theme picker |
| `r` / `⇧⌘R` | Open the resize popup |
| `i` | Flip the active group between light and dark (inert on `M`) |
| `x` / `Delete` / `Backspace` | Delete the rectangle under the cursor |
| `u` / `⌃R` | Undo / redo (`⌘Z` / `⇧⌘Z` also work) |
| `q` / `Esc` | Close the open popup |
| `Esc` | Cancel an in-progress drag, or clear the selection |
| `?` | Toggle the help overlay |
| `⌘V` / `⌘C` / `⌘S` | Paste screenshot / copy result / save PNG |
| in the resize popup: `1`–`6` | Snap to an anchor (100/75/66.7/50/33.3/25%) |
| in the resize popup: `←` `→` / `h` `l` | Adjust the scale by 1 point |
| in the resize popup: `Enter` | Apply the chosen scale |
| in pickers: `h j k l`, arrows | Move the cursor |
| in pickers: `g` / `G` | Jump to the first / last entry |
| in pickers: `Enter`, digits | Apply the highlighted entry / take one directly |
| in the binding picker: `E` / shift-click on a light/dark cell | Edit that profile's vectors |
| in the mask picker: `1`–`4` | Noise / pixelate / light / dark |

On Windows/Linux the modifier is spelled `Ctrl` (`Ctrl+V` / `Ctrl+C` /
`Ctrl+S`, `Ctrl+Z` / `Ctrl+Shift+Z`, `Ctrl+Shift+R` for resize) and View ▸
Reload is `F5`, so `Ctrl+R` is redo on every platform.

## Config files

Settings and palettes live in `~/.config/hlit/` (`settings.json` +
`themes/`) on every platform — on Windows that resolves to
`C:\Users\<you>\.config\hlit` — written debounced ~150 ms after a change;
if the config directory is unwritable the app keeps running with
in-memory values. `XDG_CONFIG_HOME` still wins when set to an absolute
path. `settings.json` is
`{ "version": 4, "theme": "<id>", "groups": [5 × {profile,sign}], "maskStyle": 1-4 }`
— the palette itself is not stored there.

## Undo/redo

Undo/redo covers adding, deleting, and reassigning/flipping rectangles and
groups, and changing the `M` group's mask style; it does not cover profile
vector edits made in the popup slider or theme loads — those apply
immediately and directly, without an undo step.

Theme and palette file details are in [themes.md](themes.md).
