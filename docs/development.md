# Development

```
npm run check
```

Runs `scripts/check-effect.mjs`, a headless assertion suite over the pixel
kernel (`renderer/effect.js`) and document state (`renderer/state.js`) —
no Electron window required.

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
- `renderer/colors.js` — shift-vector swatch previews shared by the status
  bar, pickers, and profile editor.
- `renderer/statusbar.js` — group/direction buttons and image/rect/
  selection counters.
- `renderer/picker.js` — the profile picker (2×5 grid, light/dark rows).
- `renderer/theme-picker.js` — the theme picker (one column per theme).
- `renderer/themes.js` — theme file format, validation, and fork naming.
- `renderer/profile-editor.js` — the profile-picker's RGB vector popup.
- `renderer/help.js` — the keyboard help overlay.
- `renderer/keylabels.js` — `keyLabels(platform)`, the single table of
  user-visible shortcut spellings (`⌘`/`⌃`/`⇧` glyphs on macOS, `Ctrl+…`
  everywhere else). Imported by `help.js` and `main.js`.
- `renderer/main.js` — bootstraps the above and wires pointer/keyboard
  input and menu commands.
- `themes/default.json` — the shipped seed theme, copied into
  `~/.config/hlit/themes/` at every launch.
- `scripts/check-effect.mjs` — headless kernel/state assertions (`npm run check`).
- `scripts/release-notes.mjs` — release gate and CHANGELOG extractor, run by
  `.github/workflows/release.yml` on a `v*` tag push (see
  [docs/releasing.md](releasing.md)).
- `renderer/package.json` — `{ "type": "module" }`, which is what lets
  `renderer/` use ES modules while `main/` stays CommonJS.
