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
so by default there is no Spotlight or Start-menu entry and no standalone
dock icon. Every launch goes through one of the commands above, unless you
set up the Windows shortcut described below.

## Platform notes

macOS is the primary development platform. The Windows and Linux code paths
differ deliberately: the menu bar starts with *File* rather than the app
menu, *View ▸ Reload* is bound to `F5` so that `Ctrl+R` stays redo, and
shortcut labels are spelled `Ctrl+…` instead of using `⌘`/`⌃`/`⇧` glyphs.
Config lives in `~/.config/hlit` on every platform — on Windows that
resolves to `C:\Users\<you>\.config\hlit`.

### Windows: Start Menu shortcut + global hotkey

Requires `npm install` to have already been run, so
`node_modules\electron\dist\electron.exe` exists. `pwsh` (PowerShell 7) isn't
installed by default and the default execution policy blocks `.ps1` files,
so run it with Windows PowerShell instead, from the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\create-shortcut.ps1
```

This creates a Start Menu `.lnk` that points directly at the repo's bundled
Electron binary (`node_modules\electron\dist\electron.exe`) — no background
process, no service, nothing running between launches. The script derives
the repo path from its own location, so it works from any clone without
editing.

What it sets up:

| Property | Value |
|---|---|
| Shortcut path | `%APPDATA%\Microsoft\Windows\Start Menu\Programs\hlit.lnk` |
| Target | `<repo>\node_modules\electron\dist\electron.exe` |
| Arguments | `.` |
| Working directory | `<repo>` |
| Hotkey | `Ctrl+Alt+H` |

How it's launched:

- **Start search**: press <kbd>Win</kbd>, type `hlit`, hit Enter. Resolves
  the shortcut above.
- **Global hotkey**: <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>H</kbd> from
  anywhere. `explorer.exe` owns Windows shortcut-key hotkeys and launches
  `electron.exe .` fresh on each press — no listener process to keep alive,
  no autostart entry. The app exits normally when its window is closed
  (`main/main.js` `window-all-closed`).

Windows shell hotkeys registered via a shortcut's `Hotkey` property must use
a `Ctrl+Alt` or `Ctrl+Shift` base; a bare `Alt+<letter>` cannot be
registered this way — hence `Ctrl+Alt+H` rather than a single-modifier
binding.

Rerunning the script is only needed if the repo is ever moved — the target
path (`node_modules\electron\dist\electron.exe`) stays put across `npm
install` upgrades, so an Electron version bump doesn't need a rerun.

To remove both the Start-search entry and the hotkey, delete:

```
%APPDATA%\Microsoft\Windows\Start Menu\Programs\hlit.lnk
```

