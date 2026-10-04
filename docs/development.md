# Development

```
npm run check
```

Runs `scripts/check-effect.mjs`, a headless assertion suite over the pixel
kernel (`renderer/effect.js`) and document state (`renderer/state.js`) —
no Electron window required.

## Regenerate the README demo

From the repo root, install dependencies and `ffmpeg`, then run `npm run demo`.
The Electron tape runner replays `docs/demo/hlit_demo.tape` against the real app
using `docs/demo/hlit_demo_base.png`, and overwrites `docs/demo/hlit_demo.gif`.
It captures the app window (not the desktop); the tape's paths are relative to
the working directory. It uses an isolated temporary config and image-backed
clipboard handler, leaving your settings and clipboard untouched. Keep the
window focused while recording, especially while the annotation editor is open.
The tape supports timed `Sleep`, `Type`, keys, `MoveTo`, `Click`, and `Drag`
steps; positions are image pixels (`x,y`) or quoted CSS selectors.
`Set PlaybackSpeed 1.25` makes the encoded GIF play 25% faster than the
capture; the help pause is 1.25 seconds in the tape to remain 1 second
in the GIF.

## macOS Dock icon

`assets/hlit_logo.png` is the original artwork. To regenerate the Dock/window
icon after changing it, run `swift scripts/make-macos-icon.swift` on macOS.
This produces `assets/hlit_icon.png` (1024 × 1024) with an inset rounded
plate, transparent outer canvas, and a soft shadow. Commit the generated PNG;
running the app does not require Swift. Electron loads the PNG directly when
launched from the repo, so Xcode's automatic app-icon mask does not apply.
The [Apple app icon templates](https://developer.apple.com/design/resources/)
are the reference for future artwork changes. The Spotlight launcher embeds
a generated `.icns` in its local copy of Electron.app; any future
distributable app bundle would also need an icon.

## Layout

- `main/main.js` — Electron main process: registers the `app://` scheme
  (serving `renderer/` so ES modules work), builds the menu, seeds shipped
  themes into `~/.config/hlit/themes/`, and bridges clipboard read/write,
  PNG save, and settings/theme file I/O over IPC.
- `main/menu.js` — the application menu. `buildMenuTemplate(platform, send)`
  is pure data, so the per-platform menu shape can be asserted without
  booting Electron; `applyMenu(send)` installs it.
- `main/preload.js` — exposes that bridge to the renderer as `window.hl`.
- `renderer/effect.js` — pure pixel kernel (no DOM): builds the per-group
  shift table from profiles + group bindings, stamps a mode map from the
  rectangle list, and applies the shift. Imported directly by the check
  script as well as the renderer.
- `renderer/state.js` — document state (image buffers, profiles, groups,
  rectangles, selection, undo/redo, active theme) and its mutators.
- `renderer/commands.js` — the single control plane: every user gesture
  routes through one command here, each owning the mutate → repaint →
  refresh sequence.
- `renderer/view.js` — canvas sizing, dirty-rect repainting, hover/drag/
  selection overlay, PNG export.
- `renderer/colors.js` — shift-vector swatch previews and D/A colour
  conversion shared by the status bar, pickers, and editors.
- `renderer/statusbar.js` — group/direction buttons and image/rect/
  selection counters.
- `renderer/picker.js` — the binding (2×5), mask, draw (shape + colour)
  and text (colour) pickers.
- `renderer/theme-picker.js` — the theme picker (one column per theme).
- `renderer/themes.js` — theme file format, validation, and fork naming.
- `renderer/profile-editor.js` — the profile-picker's RGB vector popup.
- `renderer/draw-color-editor.js` — RGB popup for one theme D/A colour slot.
- `renderer/help.js` — the keyboard help overlay.
- `renderer/keylabels.js` — `keyLabels(platform)`, the single table of
  user-visible shortcut spellings (`⌘`/`⌃`/`⇧` glyphs on macOS, `Ctrl+…`
  everywhere else). Imported by `help.js` and `main.js`.
- `renderer/main.js` — bootstraps the above and wires pointer/keyboard
  input and menu commands.
- `themes/default.json` — the shipped seed theme, copied into
  `~/.config/hlit/themes/` at every launch.
- `scripts/check-effect.mjs` — headless kernel/state assertions (`npm run check`).
- `scripts/record-demo.cjs` — replays the demo tape in Electron and captures
  frames for GIF encoding with ffmpeg.
- `docs/demo/hlit_demo.tape` — scripted README demo; its source screenshot is
  `docs/demo/hlit_demo_base.png`.
- `scripts/release-notes.mjs` — release gate and CHANGELOG extractor, run by
  `.github/workflows/release.yml` on a `v*` tag push (see
  [docs/releasing.md](releasing.md)).
- `renderer/package.json` — `{ "type": "module" }`, which is what lets
  `renderer/` use ES modules while `main/` stays CommonJS.
