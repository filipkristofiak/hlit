# hlit

A minimalistic Electron app for highlighting screenshots — draw rectangles
over the areas, and each rectangle applies an RGB color shift. Paste a
screenshot, highlight selections, copy or save the result.

**[hlit.app](https://hlit.app)** runs the same demo live — take it over with your own screenshot.

![hlit demo](docs/demo/hlit_demo.gif)

## Platform support

Developed primarily on **macOS**. **Windows** has been tested and improved:
keyboard shortcuts were fixed, and a Start Menu launcher with a global hotkey
was added. **Linux** has had limited manual testing with
`PATH="$HOME/.local/bin:$PATH"`; broader Linux behavior remains unverified.
See [running instructions](docs/running.md) for launch options.

## Run it

Requires Node.js.

```
npm install
npm start
```

To launch it from anywhere, alias the `--prefix` form in `~/.zshrc`:

```sh
alias hlit='npm --prefix ~/projects/tools/hlit start'
```

Detached launches and running the Electron binary directly are in
[docs/running.md](docs/running.md).

## Docs

- [docs/running.md](docs/running.md) — install, and every way to launch it.
- [docs/usage.md](docs/usage.md) — groups, profiles, selection, shortcuts,
  config files.
- [docs/themes.md](docs/themes.md) — palette file format, locking, forking.
- [docs/development.md](docs/development.md) — `npm run check` and the
  module map.
- [docs/releasing.md](docs/releasing.md) — the versioning policy and the
  tag-and-release procedure.

## License

MIT — see [LICENSE](LICENSE).
