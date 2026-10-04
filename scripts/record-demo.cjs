// Run the real app and capture a scripted demo without touching the system clipboard/config.
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { app, ipcMain, nativeImage } = require('electron')

const KEY_CODES = {
  Enter: 'Return', Escape: 'Escape', Tab: 'Tab', Backspace: 'Backspace',
  Space: 'Space', Up: 'Up', Down: 'Down', Left: 'Left', Right: 'Right'
}
const MODIFIERS = { Ctrl: 'control', Shift: 'shift', Alt: 'alt', Meta: 'meta' }

function parseTape(text, file) {
  const settings = { Width: 1260, Height: 880, Framerate: 10, PlaybackSpeed: 1, TypingSpeed: 100, MoveDuration: 400, DragDuration: 700 }
  const steps = []
  let output
  const error = (line, message) => { throw new Error(`${file}:${line}: ${message}`) }
  const duration = (value, line) => {
    const match = /^(\d+(?:\.\d+)?)(ms|s)$/.exec(value || '')
    if (!match) error(line, `bad duration "${value}"`)
    return Number(match[1]) * (match[2] === 's' ? 1000 : 1)
  }
  const position = (token, line) => {
    if (token.quoted) return { sel: token.value }
    if (/^\d+,\d+$/.test(token.value)) return { img: token.value.split(',').map(Number) }
    error(line, `bad position "${token.value}"`)
  }
  const countArgs = (args, n, line) => {
    if (args.length !== n) error(line, `expected ${n} argument(s)`)
  }
  const tokenize = (source, line) => {
    const tokens = []
    const pattern = /"(?:\\["\\]|[^"\\])*"|\S+/g
    let match
    while ((match = pattern.exec(source))) {
      const raw = match[0]
      if (raw.startsWith('"')) {
        tokens.push({ value: raw.slice(1, -1).replace(/\\(["\\])/g, '$1'), quoted: true })
      } else {
        tokens.push({ value: raw, quoted: false })
      }
    }
    // Reject unclosed quotes, including those inside a token.
    let open = false
    for (let i = 0; i < source.length; i++) {
      if (source[i] === '"' && (i === 0 || source[i - 1] !== '\\')) open = !open
    }
    if (open) error(line, 'unterminated string')
    return tokens
  }

  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = index + 1
    const source = raw.trim()
    if (!source || source.startsWith('#')) continue
    const [head, ...args] = tokenize(source, line)
    const [command, suffix] = head.value.split('@')
    const ms = suffix === undefined ? undefined : duration(suffix, line)
    if (command === 'Output') {
      countArgs(args, 1, line)
      output = args[0].value
    } else if (command === 'Set') {
      countArgs(args, 2, line)
      const [name, value] = args.map(t => t.value)
      if (name === 'Image') settings.Image = value
      else if (['Width', 'Height', 'Framerate'].includes(name)) {
        if (!/^[1-9]\d*$/.test(value)) error(line, `bad setting "${value}"`)
        settings[name] = Number(value)
      } else if (name === 'PlaybackSpeed') {
        if (!/^\d+(?:\.\d+)?$/.test(value) || Number(value) <= 0) error(line, `bad setting "${value}"`)
        settings.PlaybackSpeed = Number(value)
      } else if (['TypingSpeed', 'MoveDuration', 'DragDuration'].includes(name)) settings[name] = duration(value, line)
      else error(line, `unknown setting "${name}"`)
    } else if (command === 'Sleep') {
      countArgs(args, 1, line)
      steps.push({ kind: 'sleep', ms: duration(args[0].value, line), line })
    } else if (command === 'Type') {
      countArgs(args, 1, line)
      steps.push({ kind: 'type', text: args[0].value, ms: ms ?? settings.TypingSpeed, line, defaultMs: ms === undefined })
    } else if (command === 'MoveTo') {
      countArgs(args, 1, line)
      steps.push({ kind: 'move', to: position(args[0], line), ms: ms ?? settings.MoveDuration, line, defaultMs: ms === undefined })
    } else if (command === 'Drag') {
      countArgs(args, 2, line)
      steps.push({ kind: 'drag', from: position(args[0], line), to: position(args[1], line), ms: ms ?? settings.DragDuration, line, defaultMs: ms === undefined })
    } else if (command === 'Click' || command === 'Meta+Click' || command === 'Ctrl+Click') {
      countArgs(args, 1, line)
      steps.push({ kind: 'click', at: position(args[0], line), mods: command === 'Meta+Click' ? ['meta'] : command === 'Ctrl+Click' ? ['control'] : [], line })
    } else {
      const parts = command.split('+')
      const key = parts.pop()
      if (parts.every(part => MODIFIERS[part]) && (KEY_CODES[key] || /^[a-z\d]$/i.test(key))) {
        if (args.length > 1 || (args.length === 1 && !/^[1-9]\d*$/.test(args[0].value))) error(line, 'expected 1 argument(s)')
        steps.push({ kind: 'key', key: KEY_CODES[key] || key.toLowerCase(), mods: parts.map(part => MODIFIERS[part]), ms: ms ?? settings.TypingSpeed, count: args.length ? Number(args[0].value) : 1, line, defaultMs: ms === undefined })
      } else error(line, `unknown command "${command}"`)
    }
  }
  if (!output) throw new Error(`${file}: missing Output`)
  if (!settings.Image) throw new Error(`${file}: missing Set Image`)
  for (const step of steps) {
    if (step.defaultMs) step.ms = settings[step.kind === 'move' ? 'MoveDuration' : step.kind === 'drag' ? 'DragDuration' : 'TypingSpeed']
    delete step.defaultMs
  }
  return { output, settings, steps }
}

const tapePath = process.argv.find(arg => arg.endsWith('.tape')) || 'docs/demo/hlit_demo.tape'
let tape
try {
  tape = parseTape(fs.readFileSync(tapePath, 'utf8'), tapePath)
} catch (err) {
  console.error(`record-demo: ${err.message}`)
  process.exit(1)
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hlit-demo-'))
process.env.XDG_CONFIG_HOME = path.join(tmp, 'config')
app.setPath('userData', path.join(tmp, 'userData'))

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const { settings, steps } = tape
const W = settings.Width
const H = settings.Height
const F = settings.Framerate
const tick = 1000 / F
const framesDir = path.join(tmp, 'frames')
const imagePath = path.resolve(settings.Image)
const output = path.resolve(tape.output)

function encode() {
  return new Promise((resolve, reject) => {
    const filter = `scale=${W}:${H}:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`
    const proc = spawn('ffmpeg', ['-y', '-v', 'error', '-framerate', String(F * settings.PlaybackSpeed), '-i', path.join(framesDir, '%05d.png'), '-vf', filter, '-loop', '0', output], { stdio: 'inherit' })
    proc.on('error', err => reject(new Error(err.code === 'ENOENT' ? 'ffmpeg not found on PATH (brew install ffmpeg)' : err.message)))
    proc.on('close', code => { if (code === 0) resolve(); else reject(new Error(`ffmpeg exited with ${code}`)) })
  })
}

async function run(win) {
  const wc = win.webContents
  const image = nativeImage.createFromPath(imagePath)
  if (image.isEmpty()) throw new Error(`image not found: ${imagePath}`)
  const { width, height } = image.getSize()
  ipcMain.removeHandler('clipboard:read-image')
  ipcMain.handle('clipboard:read-image', () => ({ ok: true, png: fs.readFileSync(imagePath), width, height }))

  await new Promise((resolve, reject) => {
    wc.once('did-finish-load', resolve)
    wc.once('did-fail-load', (_event, code, description) => reject(new Error(`renderer load failed: ${code} ${description}`)))
  })
  const deadline = Date.now() + 10000
  while (await wc.executeJavaScript("document.querySelectorAll('#status .group-btn').length") !== 8) {
    if (Date.now() > deadline) throw new Error('renderer did not start')
    await sleep(50)
  }
  await sleep(300)
  win.setContentSize(W, H)
  win.center()
  win.setAlwaysOnTop(true)
  win.setIgnoreMouseEvents(true)
  wc.setBackgroundThrottling(false)
  win.focus()
  wc.focus()
  const [actualW, actualH] = win.getContentSize()
  if (actualW !== W || actualH !== H) throw new Error(`window content is ${actualW}x${actualH}, wanted ${W}x${H} — use a larger display or smaller Set Width/Height`)

  await wc.executeJavaScript(`(() => {
    const cursor = document.createElement('div')
    cursor.id = 'demo-cursor'
    cursor.style.position = 'fixed'
    cursor.style.left = '0'
    cursor.style.top = '0'
    cursor.style.width = '24px'
    cursor.style.height = '24px'
    cursor.style.pointerEvents = 'none'
    cursor.style.zIndex = '2147483647'
    const svg = (body) => 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' + body + '</svg>') + '")'
    const crosshair = svg('<path d="M12 1v22M1 12h22" stroke="black" stroke-width="3"/><path d="M12 1v22M1 12h22" stroke="white" stroke-width="1"/>')
    const arrow = svg('<path d="M1 1v19l5-5 4 8 3-2-4-8 8-1z" fill="white" stroke="black" stroke-width="1.5" stroke-linejoin="round"/>')
    document.body.append(cursor)
    window.__demoCursor = (x, y) => {
      const target = document.elementFromPoint(x, y)
      const isCrosshair = target && getComputedStyle(target).cursor === 'crosshair'
      cursor.style.backgroundImage = isCrosshair ? crosshair : arrow
      cursor.style.transform = 'translate(' + (x - (isCrosshair ? 12 : 1)) + 'px,' + (y - (isCrosshair ? 12 : 1)) + 'px)'
    }
  })()`)

  let cursor = { x: W / 2, y: H / 2 }
  await wc.executeJavaScript(`window.__demoCursor(${cursor.x}, ${cursor.y})`)
  fs.mkdirSync(framesDir)
  let nextAt = Date.now()
  let index = 0
  async function frame() {
    const delay = nextAt - Date.now()
    if (delay > 0) await sleep(delay)
    const png = (await wc.capturePage()).toPNG()
    fs.writeFileSync(path.join(framesDir, `${String(index++).padStart(5, '0')}.png`), png)
    nextAt += tick
  }
  async function frames(ms) {
    for (let i = 0, n = Math.max(1, Math.round(ms / tick)); i < n; i++) await frame()
  }
  async function resolvePosition(pos, line) {
    if (pos.img) {
      const result = await wc.executeJavaScript(`(() => {
        const canvas = document.querySelector('#base')
        const rect = canvas.getBoundingClientRect()
        return canvas.width ? [Math.round(rect.left + (${pos.img[0]} + 0.5) * rect.width / canvas.width), Math.round(rect.top + (${pos.img[1]} + 0.5) * rect.height / canvas.height)] : null
      })()`)
      if (!result) throw new Error(`${tapePath}:${line}: image coordinates used before an image is loaded`)
      return { x: result[0], y: result[1] }
    }
    const result = await wc.executeJavaScript(`(() => {
      const element = document.querySelector(${JSON.stringify(pos.sel)})
      if (!element) return null
      const rect = element.getBoundingClientRect()
      return [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)]
    })()`)
    if (!result) throw new Error(`${tapePath}:${line}: no element matches "${pos.sel}"`)
    return { x: result[0], y: result[1] }
  }
  async function move(to, ms, held = false) {
    if (to.x === cursor.x && to.y === cursor.y) return
    const from = cursor
    const n = Math.max(1, Math.round(ms / tick))
    for (let i = 1; i <= n; i++) {
      const t = i / n
      const s = t * t * (3 - 2 * t)
      cursor = { x: Math.round(from.x + (to.x - from.x) * s), y: Math.round(from.y + (to.y - from.y) * s) }
      wc.sendInputEvent({ type: 'mouseMove', ...cursor, ...(held ? { button: 'left', modifiers: ['leftButtonDown'] } : {}) })
      await wc.executeJavaScript(`window.__demoCursor(${cursor.x}, ${cursor.y})`)
      await frame()
    }
  }
  const mouse = (type, mods = []) => wc.sendInputEvent({ type, ...cursor, button: 'left', clickCount: 1, modifiers: mods })
  for (const step of steps) {
    if (step.kind === 'sleep') await frames(step.ms)
    else if (step.kind === 'move') await move(await resolvePosition(step.to, step.line), step.ms)
    else if (step.kind === 'click') {
      await move(await resolvePosition(step.at, step.line), settings.MoveDuration)
      mouse('mouseDown', step.mods)
      mouse('mouseUp', step.mods)
      await frame()
    } else if (step.kind === 'drag') {
      await move(await resolvePosition(step.from, step.line), settings.MoveDuration)
      mouse('mouseDown')
      await frame()
      await move(await resolvePosition(step.to, step.line), step.ms, true)
      mouse('mouseUp')
      await frame()
    } else if (step.kind === 'key') {
      for (let i = 0; i < step.count; i++) {
        wc.sendInputEvent({ type: 'keyDown', keyCode: step.key, modifiers: step.mods })
        wc.sendInputEvent({ type: 'keyUp', keyCode: step.key, modifiers: step.mods })
        await frames(step.ms)
      }
    } else if (step.kind === 'type') {
      for (const char of step.text) {
        wc.sendInputEvent({ type: 'keyDown', keyCode: char })
        wc.sendInputEvent({ type: 'char', keyCode: char })
        wc.sendInputEvent({ type: 'keyUp', keyCode: char })
        await frames(step.ms)
      }
    }
  }
  fs.mkdirSync(path.dirname(output), { recursive: true })
  await encode()
  return index
}

// Chromium's helpers can persist userData after app.exit() starts. Release the
// large frames now; remove late writes only after the Electron parent exits.
function cleanupAfterExit() {
  fs.rmSync(tmp, { recursive: true, force: true })
  const script = `
    const fs = require('node:fs')
    const [dir, parent] = process.argv.slice(1)
    const timer = setInterval(() => {
      try { process.kill(Number(parent), 0); return } catch (err) {
        if (err.code !== 'ESRCH') return
      }
      clearInterval(timer)
      setTimeout(() => fs.rmSync(dir, { recursive: true, force: true }), 1000)
    }, 100)
  `
  spawn(process.execPath, ['-e', script, tmp, String(process.pid)], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    detached: true,
    stdio: 'ignore'
  }).unref()
}

function finish(err, count) {
  if (err) console.error(`record-demo: ${err.message}`)
  cleanupAfterExit()
  if (!err) console.log(`record-demo: wrote ${tape.output} (${count} frames)`)
  app.exit(err ? 1 : 0)
}
app.once('browser-window-created', (_event, win) => {
  run(win).then(count => finish(null, count), err => finish(err))
})
require('../main/main.js')
