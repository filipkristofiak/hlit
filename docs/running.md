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

The repo is not packaged for distribution; the commands above use its
installed Electron binary. On macOS, the Spotlight launcher below creates
a local app bundle. Windows Start search uses the shortcut below.

On macOS, the running app's Dock tile uses `assets/hlit_icon.png`: an inset
rounded icon with transparent corners. The Spotlight launcher has the same
icon in Finder and points to this checkout.

## macOS: launch from Spotlight

After `npm install`, from the repo root:

```sh
./scripts/create-macos-launcher.sh
```

This creates `~/Applications/hlit.app`, registers it with Launch Services,
and gives it the app icon. To launch, press ⌘ Space, type **hlit**, and press
Return. Or run `open -a ~/Applications/hlit.app` from a terminal.
Its macOS bundle ID is `com.kristofiak.hlit`.

The launcher contains a clone of the installed Electron app and starts it
with this repo as its argument — no terminal or background service. App code
changes take effect on the next launch. Rerun the script if you move the
repo, update the icon, or upgrade Electron with `npm install`: the launcher
keeps the Electron version it copied when installed. If Spotlight indexing
is disabled for `~/Applications`, enable it in macOS Spotlight settings;
`open -a ~/Applications/hlit.app` still works.

If you used the v0.3.0 launcher, quit hlit and rerun the script to replace it.
Remove any old Dock pin and pin hlit again; the running app's identity has
changed from Electron to `com.kristofiak.hlit`.

On macOS, **hlit ▸ About hlit** shows the app version, developer credit,
and `https://hlit.app`. The in-app Help panel has a clickable GitHub
repository link.

To remove the launcher, delete `~/Applications/hlit.app`. This does not
delete the repo or your settings.

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

