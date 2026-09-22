// Application menu. `buildMenuTemplate` is pure data and takes the platform as an
// argument, so the per-platform shape can be inspected without booting Electron.

/**
 * @param platform a `process.platform` value
 * @param send (name: string) => void — forwards a command to the focused window
 */
function buildMenuTemplate (platform, send) {
  const isMac = platform === 'darwin'

  // Off macOS the renderer owns every Ctrl chord (see renderer/main.js), so
  // these accelerators are displayed but not registered: Windows/Linux never
  // gets two handlers for one keystroke, and a Chromium-reserved chord the
  // menu would never receive still reaches the page. `registerAccelerator` is
  // a Windows/Linux-only option; macOS always registers, which is what keeps
  // Cmd+V/C/S/Z working there.
  const imageMenu = {
    label: 'Image',
    submenu: [
      { label: 'Paste Screenshot', accelerator: 'CmdOrCtrl+V', registerAccelerator: isMac, click: () => send('paste') },
      { label: 'Copy Highlighted Image', accelerator: 'CmdOrCtrl+C', registerAccelerator: isMac, click: () => send('copy') },
      { label: 'Save PNG\u2026', accelerator: 'CmdOrCtrl+S', registerAccelerator: isMac, click: () => send('save') },
      { label: 'Resize Image\u2026', accelerator: 'Shift+CmdOrCtrl+R', registerAccelerator: isMac, click: () => send('resize') },
      { type: 'separator' },
      { label: 'Undo', accelerator: 'CmdOrCtrl+Z', registerAccelerator: isMac, click: () => send('undo') },
      { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', registerAccelerator: isMac, click: () => send('redo') }
    ]
  }

  // Off macOS the renderer owns Ctrl+R (redo), so reload takes F5 instead; on
  // macOS the role keeps its default Cmd+R, which collides with nothing.
  const viewMenu = {
    label: 'View',
    submenu: [
      isMac ? { role: 'reload' } : { role: 'reload', accelerator: 'F5' },
      { role: 'toggleDevTools' }
    ]
  }

  // `appMenu` is a macOS-only role; Windows/Linux menu bars start with File.
  return isMac
    ? [{ role: 'appMenu' }, imageMenu, viewMenu]
    : [{ label: 'File', submenu: [{ role: 'quit' }] }, imageMenu, viewMenu]
}

function applyMenu (send) {
  const { Menu } = require('electron')
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildMenuTemplate(process.platform, send)))
}

module.exports = { buildMenuTemplate, applyMenu }
