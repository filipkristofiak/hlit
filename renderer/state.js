// Document state: image buffers, profiles, group bindings, rectangles, undo/redo.
//
// Rect: { x, y, w, h, group }       integer image-space pixels, w>=1, h>=1
// Profile: { pos:{r,g,b}, neg:{r,g,b}, linked }
//   pos/neg each integers -255..255; linked true means neg is kept at -pos
// GroupBinding: { profile, sign }   profile 0..PROFILE_COUNT-1; sign 1 | -1
// Op: { t:'add', rect } | { t:'del', rect, index }
//   | { t:'group', group, from: GroupBinding, to: GroupBinding }
//   | { t:'assign', entries: [{ rect, from, to }] }   bulk rect.group reassignment
// Theme: { id, name, locked, builtin, profiles }   palette of PROFILE_COUNT profiles; id = theme filename stem

import { GROUP_COUNT, PROFILE_COUNT, DEFAULT_SHIFT, buildShiftTable } from './effect.js'
import { THEME_VERSION, isValidProfile, copyProfiles, normalizeTheme, nextForkId, nextForkName } from './themes.js'

const UNDO_CAP = 100
const SETTINGS_VERSION = 3
const DEFAULT_THEME_ID = 'default'
const SAVE_DEBOUNCE_MS = 150

function negate(v) { return { r: -v.r || 0, g: -v.g || 0, b: -v.b || 0 } }
function vectorsEqual(a, b) { return a.r === b.r && a.g === b.g && a.b === b.b }

function defaultProfile() {
  return { pos: { ...DEFAULT_SHIFT }, neg: negate(DEFAULT_SHIFT), linked: true }
}

function defaultProfiles() {
  return Array.from({ length: PROFILE_COUNT }, defaultProfile)
}

function defaultGroups() {
  return Array.from({ length: GROUP_COUNT }, (_v, i) => ({ profile: i, sign: 1 }))
}

export const state = {
  imageW: 0,
  imageH: 0,
  base: null,   // ImageData
  out: null,    // ImageData
  modeMap: null, // Uint8Array(w*h)
  rects: [],
  selected: new Set(), // Set<rect>, currently selected for bulk group reassignment
  profiles: defaultProfiles(),
  groups: defaultGroups(),
  // Palette provenance: `themes` is every theme the main process found, `theme`
  // is the one `profiles` was loaded from. Editing a locked theme forks first.
  themes: [],
  theme: { id: DEFAULT_THEME_ID, name: 'Default', locked: true, builtin: true },
  shiftTable: new Int16Array((GROUP_COUNT + 1) * 3),
  // The active group is the target of every group-level command (o/p, profile
  // buttons); it follows the most recently selected rect.
  active: 0,
  undo: [],
  redo: []
}

function rectContains(r, x, y) {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h
}

function rectBBox(r) {
  return { x: r.x, y: r.y, w: r.w, h: r.h }
}

function unionBBox(rects) {
  if (rects.length === 0) return null
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const r of rects) {
    if (r.x < x0) x0 = r.x
    if (r.y < y0) y0 = r.y
    if (r.x + r.w > x1) x1 = r.x + r.w
    if (r.y + r.h > y1) y1 = r.y + r.h
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

function pushUndo(op) {
  state.undo.push(op)
  if (state.undo.length > UNDO_CAP) state.undo.shift()
  state.redo = []
}

function removeRectRef(rect) {
  const idx = state.rects.indexOf(rect)
  if (idx !== -1) state.rects.splice(idx, 1)
}

function syncShiftTable() {
  buildShiftTable(state.profiles, state.groups, state.shiftTable)
}

function rectsUsingProfile(profileIndex) {
  return state.rects.filter((r) => state.groups[r.group].profile === profileIndex)
}

function isValidGroup(g) {
  return g && typeof g === 'object' &&
    Number.isInteger(g.profile) && g.profile >= 0 && g.profile < PROFILE_COUNT &&
    (g.sign === 1 || g.sign === -1)
}

let notify = () => {}

/** Set once from the bootstrap in main.js; receives user-facing one-liners
 * (theme forks, unreadable theme files). */
export function setThemeNotifier(cb) {
  notify = cb
}

export function setThemeList(rawThemes) {
  state.themes = (Array.isArray(rawThemes) ? rawThemes : [])
    .map(normalizeTheme)
    .filter((t) => t !== null)
}

function themeById(id) {
  return state.themes.find((t) => t.id === id) || null
}

/** Loads `id`'s palette into the document. Returns the dirty bbox (every rect
 * can change colour) or null when the id is unknown or already active. */
export function applyTheme(id) {
  const theme = themeById(id)
  if (!theme || theme.id === state.theme.id) return null
  state.profiles = copyProfiles(theme.profiles)
  state.theme = { id: theme.id, name: theme.name, locked: theme.locked, builtin: theme.builtin }
  syncShiftTable()
  saveSettings()
  return unionBBox(state.rects)
}

/** A locked theme is never written to: the first real edit copies it to a new
 * unlocked theme, which becomes active and receives this and later edits. */
function ensureUnlockedTheme() {
  if (!state.theme.locked) return
  const id = nextForkId(state.theme.id, new Set(state.themes.map((t) => t.id)))
  const name = nextForkName(state.theme.name, new Set(state.themes.map((t) => t.name)))
  const fork = { id, name, locked: false, builtin: false, profiles: copyProfiles(state.profiles) }
  state.themes.push(fork)
  state.theme = { id, name, locked: false, builtin: false }
  saveSettings()
  notify(`Forked theme to \u201c${name}\u201d`)
}

let saveTimer = null

function settingsSnapshot() {
  return {
    version: SETTINGS_VERSION,
    theme: state.theme.id,
    groups: state.groups.map((g) => ({ profile: g.profile, sign: g.sign }))
  }
}

/** Debounced so a slider drag produces one write, not one per input event. */
function saveSettings() {
  const bridge = globalThis.hl
  if (!bridge || typeof bridge.saveSettings !== 'function') return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    bridge.saveSettings(settingsSnapshot())
  }, SAVE_DEBOUNCE_MS)
}

let themeSaveTimer = null

/** Debounced on its own timer so a palette edit and a group change do not
 * cancel each other. Keeps `state.themes`'s cached entry in step with
 * `state.profiles` so the theme picker's dots repaint immediately. */
function saveActiveTheme() {
  const entry = themeById(state.theme.id)
  if (entry) entry.profiles = copyProfiles(state.profiles)
  const bridge = globalThis.hl
  if (!bridge || typeof bridge.saveTheme !== 'function') return
  if (state.theme.locked) return          // unreachable after ensureUnlockedTheme; cheap belt and braces
  const id = state.theme.id
  const payload = {
    version: THEME_VERSION,
    name: state.theme.name,
    locked: false,
    profiles: copyProfiles(state.profiles)
  }
  clearTimeout(themeSaveTimer)
  themeSaveTimer = setTimeout(() => {
    themeSaveTimer = null
    bridge.saveTheme(id, payload)
  }, SAVE_DEBOUNCE_MS)
}

/** Version-2 settings stored the palette inline. If it matches the default
 * theme, just point at it; otherwise write it out as an unlocked user theme so
 * the hand-tuned vectors survive the format change. Returns the theme id. */
async function migrateInlineProfiles(profiles) {
  const fallback = themeById(DEFAULT_THEME_ID)
  if (fallback && profilesEqual(fallback.profiles, profiles)) return DEFAULT_THEME_ID

  const takenIds = new Set(state.themes.map((t) => t.id))
  let id = 'palette'
  for (let n = 2; takenIds.has(id); n++) id = `palette-${n}`
  const takenNames = new Set(state.themes.map((t) => t.name))
  let name = 'Palette'
  for (let n = 2; takenNames.has(name); n++) name = `Palette ${n}`

  const theme = { id, name, locked: false, builtin: false, profiles: copyProfiles(profiles) }
  const bridge = globalThis.hl
  if (bridge && typeof bridge.saveTheme === 'function') {
    const res = await bridge.saveTheme(id, { version: THEME_VERSION, name, locked: false, profiles: theme.profiles })
    if (!res || !res.ok) {
      notify('Could not save the migrated palette')
      return DEFAULT_THEME_ID
    }
  }
  state.themes.push(theme)
  notify(`Imported your palette as \u201c${name}\u201d`)
  return id
}

function profilesEqual(a, b) {
  return a.length === b.length && a.every((p, i) =>
    p.linked === b[i].linked && vectorsEqual(p.pos, b[i].pos) && vectorsEqual(p.neg, b[i].neg))
}

/** Applies a settings object read from disk. Groups and the palette pointer are
 * validated independently: a bad pointer falls back to the default theme, bad
 * groups fall back to default bindings. `setThemeList` must run first.
 * Version 2 settings carried the palette inline; those profiles are migrated
 * into a theme file so nothing hand-tuned is lost. */
export async function applySettings(raw) {
  const groups = raw && raw.groups
  state.groups = Array.isArray(groups) && groups.length === GROUP_COUNT && groups.every(isValidGroup)
    ? groups.map((g) => ({ profile: g.profile, sign: g.sign }))
    : defaultGroups()

  let targetId = DEFAULT_THEME_ID
  if (raw && raw.version === SETTINGS_VERSION && typeof raw.theme === 'string' && themeById(raw.theme)) {
    targetId = raw.theme
  } else if (raw && raw.version === 2 && Array.isArray(raw.profiles) &&
             raw.profiles.length === PROFILE_COUNT && raw.profiles.every(isValidProfile)) {
    targetId = await migrateInlineProfiles(raw.profiles)
  }

  const theme = themeById(targetId) || themeById(DEFAULT_THEME_ID)
  if (theme) {
    state.profiles = copyProfiles(theme.profiles)
    state.theme = { id: theme.id, name: theme.name, locked: theme.locked, builtin: theme.builtin }
  } else {
    // No readable theme at all: keep the built-in vectors so the app still works.
    state.profiles = defaultProfiles()
    state.theme = { id: DEFAULT_THEME_ID, name: 'Default', locked: true, builtin: true }
    notify('No theme files found \u2014 using built-in vectors')
  }
  syncShiftTable()
  saveSettings()
}

// state.profiles/groups start from defaults, so the module is usable before
// settings arrive (and under plain Node, e.g. scripts/check-effect.mjs).
syncShiftTable()

export function loadImage(imageData) {
  state.imageW = imageData.width
  state.imageH = imageData.height
  state.base = imageData
  state.out = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height)
  state.modeMap = new Uint8Array(imageData.width * imageData.height)
  state.rects = []
  state.selected = new Set()
  state.active = 0
  state.undo = []
  state.redo = []
  return { x: 0, y: 0, w: imageData.width, h: imageData.height }
}

export function addRect(rect) {
  state.rects.push(rect)
  pushUndo({ t: 'add', rect })
  return rectBBox(rect)
}

export function deleteAt(x, y) {
  for (let i = state.rects.length - 1; i >= 0; i--) {
    const r = state.rects[i]
    if (rectContains(r, x, y)) {
      state.rects.splice(i, 1)
      state.selected.delete(r)
      pushUndo({ t: 'del', rect: r, index: i })
      return rectBBox(r)
    }
  }
  return null
}

/**
 * Reassigns every currently-selected rect to `groupIndex`, as one undo step.
 * Rects already in that group are excluded from the op. Returns the dirty
 * bbox covering only the rects that actually changed, or null if none did.
 */
export function assignSelectedGroup(groupIndex) {
  state.active = groupIndex
  const entries = []
  for (const rect of state.selected) {
    if (rect.group !== groupIndex) entries.push({ rect, from: rect.group, to: groupIndex })
  }
  if (entries.length === 0) return null
  for (const e of entries) e.rect.group = e.to
  pushUndo({ t: 'assign', entries })
  return unionBBox(entries.map((e) => e.rect))
}

/** The single group-binding mutator: profile and sign move together in one undo step. */
export function setGroupBinding(group, profileIndex, sign) {
  const g = state.groups[group]
  if (g.profile === profileIndex && g.sign === sign) return null
  const from = { ...g }
  g.profile = profileIndex
  g.sign = sign
  pushUndo({ t: 'group', group, from, to: { ...g } })
  syncShiftTable()
  saveSettings()
  return unionBBox(state.rects.filter((r) => r.group === group))
}

export function setGroupProfile(group, profileIndex) {
  return setGroupBinding(group, profileIndex, state.groups[group].sign)
}

export function setGroupSign(group, sign) {
  return setGroupBinding(group, state.groups[group].profile, sign)
}

export function toggleActiveSign() {
  const g = state.active
  return setGroupSign(g, state.groups[g].sign === 1 ? -1 : 1)
}

export function setProfileChannel(profileIndex, side, channel, value) {
  if (typeof value === 'string' && value.trim() === '') return null
  const v = Math.round(Number(value))
  if (Number.isNaN(v)) return null
  const clamped = v < -255 ? -255 : v > 255 ? 255 : v
  const p = state.profiles[profileIndex]
  const mirror = side === 'pos' && p.linked
  const changed = p[side][channel] !== clamped || (mirror && p.neg[channel] !== -clamped)
  if (!changed) return null
  ensureUnlockedTheme()
  p[side][channel] = clamped
  if (mirror) p.neg[channel] = -clamped || 0
  syncShiftTable()
  saveActiveTheme()
  return unionBBox(rectsUsingProfile(profileIndex))
}

/** Turning mirroring on re-derives neg from pos; turning it off keeps the current neg. */
export function setProfileLinked(profileIndex, linked) {
  const p = state.profiles[profileIndex]
  const mirrored = negate(p.pos)
  const negChanges = linked && !vectorsEqual(p.neg, mirrored)
  if (p.linked === linked && !negChanges) return null
  ensureUnlockedTheme()
  p.linked = linked
  if (linked) p.neg = mirrored
  syncShiftTable()
  saveActiveTheme()
  return negChanges ? unionBBox(rectsUsingProfile(profileIndex)) : null
}

export function resetProfile(profileIndex) {
  const p = state.profiles[profileIndex]
  const fresh = defaultProfile()
  if (p.linked === fresh.linked && vectorsEqual(p.pos, fresh.pos) && vectorsEqual(p.neg, fresh.neg)) return null
  ensureUnlockedTheme()
  state.profiles[profileIndex] = fresh
  syncShiftTable()
  saveActiveTheme()
  return unionBBox(rectsUsingProfile(profileIndex))
}

function undoOp(op) {
  switch (op.t) {
    case 'add':
      removeRectRef(op.rect)
      state.selected.delete(op.rect)
      return rectBBox(op.rect)
    case 'del':
      state.rects.splice(op.index, 0, op.rect)
      return rectBBox(op.rect)
    case 'group':
      state.groups[op.group] = { ...op.from }
      syncShiftTable()
      saveSettings()
      return unionBBox(state.rects.filter((r) => r.group === op.group))
    case 'assign':
      for (const e of op.entries) e.rect.group = e.from
      return unionBBox(op.entries.map((e) => e.rect))
    default:
      return null
  }
}

function redoOp(op) {
  switch (op.t) {
    case 'add':
      state.rects.push(op.rect)
      return rectBBox(op.rect)
    case 'del':
      removeRectRef(op.rect)
      state.selected.delete(op.rect)
      return rectBBox(op.rect)
    case 'group':
      state.groups[op.group] = { ...op.to }
      syncShiftTable()
      saveSettings()
      return unionBBox(state.rects.filter((r) => r.group === op.group))
    case 'assign':
      for (const e of op.entries) e.rect.group = e.to
      return unionBBox(op.entries.map((e) => e.rect))
    default:
      return null
  }
}

export function undo() {
  const op = state.undo.pop()
  if (!op) return null
  const dirty = undoOp(op)
  state.redo.push(op)
  return dirty
}

export function redo() {
  const op = state.redo.pop()
  if (!op) return null
  const dirty = redoOp(op)
  state.undo.push(op)
  return dirty
}

export function setActive(group) {
  state.active = group
}

/** Replaces the selection with just `rect` (or clears it, when `rect` is null). */
export function selectOnly(rect) {
  state.selected.clear()
  if (rect) {
    state.selected.add(rect)
    state.active = rect.group
  }
}

/** Adds `rect` to the selection, or removes it if already selected. */
export function toggleSelect(rect) {
  if (state.selected.has(rect)) {
    state.selected.delete(rect)
  } else {
    state.selected.add(rect)
    state.active = rect.group
  }
}

export function clearSelection() {
  state.selected.clear()
}
