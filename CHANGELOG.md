# Changelog

Newest first. Versions are SemVer; `0.x` means the settings and theme file
formats may still change between releases. There is no support for older
versions — run the latest tag, or `main`.

## Unreleased

## 0.2.0 — 2026-09-23

- Mask group (`M`): noise, pixelate, light and dark styles; overlapping
  highlights are tinted.
- Draw group (`D`): outline rectangles and arrows. Annotate group (`A`):
  inline text boxes.
- Resize the image (`R` / `Shift+Cmd+R`), with fewer copies of the pasted
  image buffer.
- Right-click the active-group swatch to open its picker; the help overlay
  now fits the window and scrolls.
- The light/dark flip moved from `o` to `i`.
- Fixed key bindings on Windows: the renderer owns every Ctrl chord, and
  View ▸ Reload sits on F5 so Ctrl+R stays redo.
- The hlit logo is used as the app icon (dock, window, taskbar).
- The help footer links to the GitHub repo, opened in the system browser.
- Settings files from 0.1.0 are migrated on load (settings format v2 → v5).

## 0.1.0

- Initial release: paste, highlight groups with RGB shift profiles, theme
  files, profile picker and editor, copy and save PNG. Never tagged; this
  entry exists so the history is complete.
