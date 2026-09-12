# Usage

1. **Paste a screenshot** — `Cmd/Ctrl+V` or *Image → Paste Screenshot*. Reads
   an image straight from the OS clipboard.
2. **Drag a rectangle** over the region to highlight. It's assigned to the
   currently active group (1–5, shown in the status bar) and immediately
   painted with that group's color shift. Rectangles smaller than 3×3 px are
   discarded as accidental clicks.
3. **Copy or save the result** — `Cmd/Ctrl+C` copies the highlighted image
   back to the clipboard; `Cmd/Ctrl+S` saves it as a PNG.

Pasting a new screenshot clears all rectangles and undo history but keeps
your profile and group configuration.

## Groups, profiles, and direction

There are 5 **groups** (keys `1`–`5`), each bound to one of 5 **profiles**.
A profile is an RGB shift vector — `r`, `g`, `b`, each in `-255..255` — added
to every pixel inside rectangles assigned to a group pointing at it. A group
also carries its own **direction sign** (`+1` or `-1`), so two groups can
share one profile and render exactly opposite shifts (e.g. one lightens an
area, the other darkens it by the same amount).

The status bar holds five group buttons plus a light/dark button for the
active group. Press `p` to open the profile picker — a 2×5 grid (light row /
dark row) — and pick a cell to set the active group's profile *and*
direction in one undo step. Edit a profile's vectors from that picker with
`E` or shift-click, which opens the slider/numeric panel: per-channel R/G/B
for both sides, a "Mirror dark side" checkbox, *Reset*, and *Close*.

## Selecting and reassigning existing rectangles

- **Click a rectangle** to select only it. Click empty canvas to clear the
  selection.
- **Ctrl/Cmd+click a rectangle** to add it to the selection, or remove it if
  it's already selected — the usual multi-select toggle.
- **With one or more rectangles selected, press `1`–`5`** to reassign all of
  them to that group, as a single undo step. The active group is
  unaffected, and so is normal digit-key behavior when nothing is selected
  — reassigning existing rectangles is independent of which group new
  drags go into.
- Selected rectangles get a solid blue outline; `Escape` clears the
  selection (or closes an in-progress drag / any open popup first, if
  either is active).

## Shortcuts

| Key | Action |
| --- | --- |
| `1`–`5` | Select the active group, or reassign the selected rectangles |
| `Tab` / `⇧Tab` | Next / previous active group |
| `p` | Open the profile picker |
| `t` | Open the theme picker |
| `o` | Flip the active group between light and dark |
| `x` / `Delete` / `Backspace` | Delete the rectangle under the cursor |
| `u` / `⌃R` | Undo / redo (`⌘Z` / `⇧⌘Z` also work) |
| `q` / `Esc` | Close the open popup |
| `Esc` | Cancel an in-progress drag, or clear the selection |
| `?` | Toggle the help overlay |
| `⌘V` / `⌘C` / `⌘S` | Paste screenshot / copy result / save PNG |
| in pickers: `h j k l`, arrows | Move the cursor |
| in pickers: `g` / `G` | Jump to the first / last entry |
| in pickers: `Enter`, digits | Apply the highlighted entry / take one directly |
| in the profile picker: `E` / shift-click | Edit that profile's vectors |

On Windows/Linux the modifier is spelled `Ctrl` (`Ctrl+V` / `Ctrl+C` /
`Ctrl+S`, `Ctrl+Z` / `Ctrl+Shift+Z`) and View ▸ Reload is `F5`, so `Ctrl+R`
is redo on every platform.

## Config files

Settings and palettes live in `~/.config/hlit/` (`settings.json` +
`themes/`) on every platform — on Windows that resolves to
`C:\Users\<you>\.config\hlit` — written debounced ~150 ms after a change;
if the config directory is unwritable the app keeps running with
in-memory values. `XDG_CONFIG_HOME` still wins when set to an absolute
path. `settings.json` is
`{ "version": 3, "theme": "<id>", "groups": [5 × {profile,sign}] }` — the
palette itself is not stored there.

## Undo/redo

Undo/redo covers adding, deleting, and reassigning/flipping rectangles and
groups; it does not cover profile vector edits made in the popup slider or
theme loads — those apply immediately and directly, without an undo step.

Theme and palette file details are in [themes.md](themes.md).
