const { app, BrowserWindow, protocol, net, ipcMain, clipboard, nativeImage, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { pathToFileURL } = require('url')
const { applyMenu } = require('./menu')

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

const RENDERER = path.join(__dirname, '..', 'renderer')
const APP_ICON = path.join(__dirname, '..', 'assets', 'hlit_logo.png')

let win = null

function registerAppProtocol() {
  protocol.handle('app', async (req) => {
    const { pathname } = new URL(req.url)
    const rel = pathname === '/' ? 'index.html' : pathname.slice(1)
    const target = path.resolve(RENDERER, rel)
    const inside = path.relative(RENDERER, target)
    if (!inside || inside.startsWith('..') || path.isAbsolute(inside)) {
      return new Response('bad', { status: 400 })
    }
    const res = await net.fetch(pathToFileURL(target).toString())
    const type = target.endsWith('.js') ? 'text/javascript'
      : target.endsWith('.css') ? 'text/css'
      : target.endsWith('.html') ? 'text/html' : 'application/octet-stream'
    return new Response(res.body, { headers: { 'content-type': type } })
  })
}

function pad(n) { return String(n).padStart(2, '0') }

function timestamp() {
  const d = new Date()
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

function settingsPath() {
  const xdg = process.env.XDG_CONFIG_HOME
  const base = xdg && path.isAbsolute(xdg) ? xdg : path.join(app.getPath('home'), '.config')
  return path.join(base, 'hlit', 'settings.json')
}

const SEED_THEMES = path.join(__dirname, '..', 'themes')
const THEME_ID_RE = /^[a-z0-9][a-z0-9_-]*$/   // mirrors renderer/themes.js; a renderer ES module cannot be required here

/** The one directory the renderer ever sees: ~/.config/hlit/themes. */
function themesDir() {
  return path.join(path.dirname(settingsPath()), 'themes')
}

/** Ids shipped with the app. Reserved: re-seeded every launch, never writable. */
async function seedIds() {
  try {
    const names = await fs.promises.readdir(SEED_THEMES)
    return new Set(names
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -5))
      .filter((id) => THEME_ID_RE.test(id)))
  } catch {
    return new Set()
  }
}

/** Copies every shipped theme into the config dir, overwriting what is there.
 * Runs before the window loads, so a tampered default.json is restored and the
 * renderer has a single directory to list. */
async function seedThemes() {
  let names
  try {
    names = await fs.promises.readdir(SEED_THEMES)
  } catch {
    return                       // no shipped themes dir: nothing to seed
  }
  const dir = themesDir()
  try {
    await fs.promises.mkdir(dir, { recursive: true })
  } catch {
    return
  }
  for (const file of names) {
    if (!file.endsWith('.json') || !THEME_ID_RE.test(file.slice(0, -5))) continue
    try {
      await fs.promises.copyFile(path.join(SEED_THEMES, file), path.join(dir, file))
    } catch {
      continue                   // an unwritable seed target is not fatal
    }
  }
}

function registerIpc() {
  ipcMain.handle('clipboard:read-image', () => {
    const img = clipboard.readImage()
    if (img.isEmpty()) return { ok: false, reason: 'empty' }
    const { width, height } = img.getSize()
    return { ok: true, png: img.toPNG(), width, height }
  })

  ipcMain.handle('clipboard:write-image', (_e, png) => {
    clipboard.writeImage(nativeImage.createFromBuffer(Buffer.from(png)))
    return { ok: true }
  })

  ipcMain.handle('file:save-png', async (_e, png) => {
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: path.join(app.getPath('downloads'), `hlit-${timestamp()}.png`),
      filters: [{ name: 'PNG', extensions: ['png'] }]
    })
    if (canceled || !filePath) return { ok: false, reason: 'canceled' }
    await fs.promises.writeFile(filePath, Buffer.from(png))
    return { ok: true, path: filePath }
  })

  ipcMain.handle('settings:load', async () => {
    try {
      const text = await fs.promises.readFile(settingsPath(), 'utf8')
      return { ok: true, data: JSON.parse(text) }
    } catch {
      return { ok: false }
    }
  })

  ipcMain.handle('settings:save', async (_e, data) => {
    const target = settingsPath()
    try {
      await fs.promises.mkdir(path.dirname(target), { recursive: true })
      const tmp = target + '.tmp'
      await fs.promises.writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8')
      await fs.promises.rename(tmp, target)
      return { ok: true }
    } catch (err) {
      return { ok: false, reason: String(err) }
    }
  })

  ipcMain.handle('themes:list', async () => {
    const dir = themesDir()
    const reserved = await seedIds()
    const themes = []
    let names
    try {
      names = await fs.promises.readdir(dir)
    } catch {
      return { ok: true, themes }      // dir missing (seeding failed): renderer falls back to built-in vectors
    }
    for (const file of names.sort()) {
      if (!file.endsWith('.json')) continue
      const id = file.slice(0, -5)
      if (!THEME_ID_RE.test(id)) continue
      try {
        const data = JSON.parse(await fs.promises.readFile(path.join(dir, file), 'utf8'))
        themes.push({ ...data, id, builtin: reserved.has(id) })
      } catch {
        continue                       // unreadable or non-JSON file is skipped, never fatal
      }
    }
    return { ok: true, themes }
  })

  ipcMain.handle('themes:save', async (_e, id, theme) => {
    if (typeof id !== 'string' || !THEME_ID_RE.test(id)) return { ok: false, reason: 'bad-id' }
    if ((await seedIds()).has(id)) return { ok: false, reason: 'reserved' }
    const target = path.join(themesDir(), `${id}.json`)
    try {
      await fs.promises.mkdir(path.dirname(target), { recursive: true })
      const tmp = target + '.tmp'
      await fs.promises.writeFile(tmp, JSON.stringify(theme, null, 2) + '\n', 'utf8')
      await fs.promises.rename(tmp, target)
      return { ok: true, path: target }
    } catch (err) {
      return { ok: false, reason: String(err) }
    }
  })
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    backgroundColor: '#161616',
    icon: APP_ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.loadURL('app://hl/')
}

app.whenReady().then(async () => {
  // macOS takes the dock tile from the bundle when packaged; running `electron .`
  // there is no bundle of ours, so set it explicitly. `app.dock` is undefined off macOS.
  const icon = nativeImage.createFromPath(APP_ICON)
  if (app.dock && !icon.isEmpty()) app.dock.setIcon(icon)
  registerAppProtocol()
  applyMenu((name) => { if (win) win.webContents.send('command', name) })
  registerIpc()
  await seedThemes()          // restores shipped themes before the renderer lists them
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
