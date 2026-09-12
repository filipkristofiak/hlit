# Running hlit

Requires Node.js. Electron arrives as a devDependency, so there is nothing
else to install.

```
npm install
```

## From the repo

```
npm start
```

## From anywhere

`npm --prefix` runs the repo's `start` script no matter the current
directory:

```
npm --prefix ~/projects/tools/hlit start
```

As an alias in `~/.zshrc` or `~/.bashrc`:

```sh
alias hlit='npm --prefix ~/projects/tools/hlit start'
```

That alias keeps the terminal attached — the app exits when the shell does,
and the terminal is blocked meanwhile. For a detached launch, use a function
instead:

```sh
hlit() { (npm --prefix ~/projects/tools/hlit start >/dev/null 2>&1 &) }
```

## Skipping npm

`npm start` is just `electron .`, so invoking the bundled binary directly is
equivalent and avoids the npm startup cost:

```sh
~/projects/tools/hlit/node_modules/.bin/electron ~/projects/tools/hlit
```

The app is not packaged — there is no `.app`, `.exe`, or `.AppImage` bundle,
so there is no Spotlight or Start-menu entry and no standalone dock icon.
Every launch goes through one of the commands above.

## Platform notes

macOS is the only platform this has been run on. The Windows and Linux code
paths differ deliberately: the menu bar starts with *File* rather than the
app menu, *View ▸ Reload* is bound to `F5` so that `Ctrl+R` stays redo, and
shortcut labels are spelled `Ctrl+…` instead of using `⌘`/`⌃`/`⇧` glyphs.
Config lives in `~/.config/hlit` on every platform — on Windows that
resolves to `C:\Users\<you>\.config\hlit`.
