# Themes

- A theme is one JSON file in `~/.config/hlit/themes/`; its id is the
  filename stem (`[a-z0-9][a-z0-9_-]*`), and the format is
  `{ "version": 1, "name": …, "locked": …, "profiles": [5 × {pos,neg,linked}] }`.
- `themes/default.json` in the repo is the shipped seed: it is copied into
  `~/.config/hlit/themes/` at every launch, overwriting what is there, which
  is why the Default theme cannot be overridden — the app also refuses to
  write any shipped id.
- `t` opens the theme picker: `j`/`k`/arrows move, `g`/`G` jump to the ends,
  `1`–`9` load directly, `Enter` loads, `q`/`Esc` closes. Loading a theme
  swaps the whole palette and is not an undo step.
- Editing a profile while a locked theme is active forks it to a new
  unlocked theme (`default` → `default-copy`, then `default-copy-2`, …;
  display name `Default copy`, `Default copy 2`) which becomes active and
  receives that edit; an already-unlocked theme is written in place.
- Hand-authored themes: drop a valid JSON file into `~/.config/hlit/themes/`
  and reload the window (View ▸ Reload); invalid or unreadable files are
  skipped silently.
