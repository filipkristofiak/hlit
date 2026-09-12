// Theme vocabulary: the on-disk palette format, its validation, and the
// fork-naming rules. Pure — no DOM, no fs — so state.js and the headless
// checks share one definition.

import { PROFILE_COUNT } from './effect.js'

export const THEME_VERSION = 1

/** Filename stem of a theme file, and therefore its id. Kept to lowercase
 * ASCII so the id is a safe filename on every platform. Mirrored in
 * main/main.js, which cannot import a renderer ES module. */
export const THEME_ID_RE = /^[a-z0-9][a-z0-9_-]*$/

export function isValidVector(v) {
  return v && typeof v === 'object' &&
    Number.isInteger(v.r) && v.r >= -255 && v.r <= 255 &&
    Number.isInteger(v.g) && v.g >= -255 && v.g <= 255 &&
    Number.isInteger(v.b) && v.b >= -255 && v.b <= 255
}

export function isValidProfile(p) {
  return p && typeof p === 'object' && typeof p.linked === 'boolean' &&
    isValidVector(p.pos) && isValidVector(p.neg)
}

export function copyProfiles(profiles) {
  return profiles.map((p) => ({
    pos: { r: p.pos.r, g: p.pos.g, b: p.pos.b },
    neg: { r: p.neg.r, g: p.neg.g, b: p.neg.b },
    linked: p.linked
  }))
}

/** A theme as it arrives from the main process: `id` stamped from the filename,
 * `builtin` true when that id is one of the app's shipped (reserved) themes. */
export function normalizeTheme(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (raw.version !== THEME_VERSION) return null
  if (typeof raw.id !== 'string' || !THEME_ID_RE.test(raw.id)) return null
  if (typeof raw.name !== 'string' || raw.name.trim() === '') return null
  if (!Array.isArray(raw.profiles) || raw.profiles.length !== PROFILE_COUNT) return null
  if (!raw.profiles.every(isValidProfile)) return null
  const builtin = raw.builtin === true
  return {
    id: raw.id,
    name: raw.name,
    locked: builtin || raw.locked === true,   // a built-in is locked whatever its file claims
    builtin,
    profiles: copyProfiles(raw.profiles)
  }
}

/** First free `<base>-copy`, `<base>-copy-2`, `<base>-copy-3`, … */
export function nextForkId(baseId, takenIds) {
  const stem = `${baseId}-copy`
  if (!takenIds.has(stem)) return stem
  for (let n = 2; ; n++) {
    const candidate = `${stem}-${n}`
    if (!takenIds.has(candidate)) return candidate
  }
}

/** Display name matching the id suffix: `X copy`, `X copy 2`, … */
export function nextForkName(baseName, takenNames) {
  const stem = `${baseName} copy`
  if (!takenNames.has(stem)) return stem
  for (let n = 2; ; n++) {
    const candidate = `${stem} ${n}`
    if (!takenNames.has(candidate)) return candidate
  }
}
