// Headless pixel proof over renderer/effect.js.
// Plain node:assert; throws (non-zero exit) on failure.

import assert from 'node:assert'
import { GROUP_COUNT, PROFILE_COUNT, buildShiftTable, stampModeMap, applyEffect } from '../renderer/effect.js'
import {
  state, addRect, deleteAt, setGroupProfile, setGroupSign, setGroupBinding, setProfileChannel, setProfileLinked, resetProfile,
  undo, redo, selectOnly, toggleSelect, clearSelection, assignSelectedGroup, setThemeList, applyTheme, resizeTo, setSource
} from '../renderer/state.js'

const W = 8
const H = 4

function makeBuffer() {
  const buf = new Uint8ClampedArray(W * H * 4)
  for (let i = 0; i < W * H; i++) {
    const o = i * 4
    buf[o] = 1
    buf[o + 1] = 2
    buf[o + 2] = 3
    buf[o + 3] = 255
  }
  return buf
}

function setPixel(buf, x, y, rgba) {
  const o = (y * W + x) * 4
  buf[o] = rgba[0]
  buf[o + 1] = rgba[1]
  buf[o + 2] = rgba[2]
  buf[o + 3] = rgba[3]
}

function getPixel(buf, x, y) {
  const o = (y * W + x) * 4
  return [buf[o], buf[o + 1], buf[o + 2], buf[o + 3]]
}

/** Builds a profile fixture. Passing only `pos` mirrors it (`linked: true`, matching
 * today's default); passing `neg` too makes it independent (`linked: false`). */
function mk(pos, neg) {
  return { pos, neg: neg || { r: -pos.r || 0, g: -pos.g || 0, b: -pos.b || 0 }, linked: !neg }
}

const base = makeBuffer()
setPixel(base, 0, 0, [255, 255, 255, 255]) // white, profile (0,0,-160) sign +1
setPixel(base, 1, 0, [0, 0, 0, 255])       // black, profile (0,0,-160) sign -1
setPixel(base, 2, 0, [10, 10, 100, 255])   // clamp-low case
setPixel(base, 3, 0, [10, 10, 200, 255])   // clamp-high case
setPixel(base, 4, 0, [100, 100, 100, 255]) // full 3-channel shift, sign +1
setPixel(base, 5, 0, [100, 100, 100, 255]) // same profile, sign -1 (exact negation)
setPixel(base, 6, 0, [50, 60, 70, 255])    // outside every rect
setPixel(base, 7, 0, [10, 20, 50, 255])    // overlap case: group 0 then group 1

const out = new Uint8ClampedArray(base.length)
const modeMap = new Uint8Array(W * H)
const shiftTable = new Int16Array((GROUP_COUNT + 1) * 3)

// Profiles: 0 = (0,0,-160) default yellow, 1 = (0,0,255) extreme blue, 2 = (30,-40,200)
const profiles = [mk({ r: 0, g: 0, b: -160 }), mk({ r: 0, g: 0, b: 255 }), mk({ r: 30, g: -40, b: 200 })]

// Groups: 0 -> profile0 sign+1, 1 -> profile0 sign-1, 2 -> profile1 sign+1,
//         3 -> profile2 sign+1, 4 -> profile2 sign-1
const groups = [
  { profile: 0, sign: 1 },
  { profile: 0, sign: -1 },
  { profile: 1, sign: 1 },
  { profile: 2, sign: 1 },
  { profile: 2, sign: -1 }
]

buildShiftTable(profiles, groups, shiftTable)

const rects = [
  { x: 0, y: 0, w: 1, h: 1, group: 0 }, // white, profile0 sign+1
  { x: 1, y: 0, w: 1, h: 1, group: 1 }, // black, profile0 sign-1
  { x: 2, y: 0, w: 1, h: 1, group: 0 }, // clamp low, profile0 sign+1
  { x: 3, y: 0, w: 1, h: 1, group: 2 }, // clamp high, profile1 sign+1
  { x: 4, y: 0, w: 1, h: 1, group: 3 }, // full shift, profile2 sign+1
  { x: 5, y: 0, w: 1, h: 1, group: 4 }, // full shift, profile2 sign-1
  { x: 7, y: 0, w: 1, h: 1, group: 0 }, // overlap: group 0 added first
  { x: 7, y: 0, w: 1, h: 1, group: 1 }  // overlap: group 1 added later -> wins
]

const FULL = { x: 0, y: 0, w: W, h: H }
stampModeMap(modeMap, W, rects, FULL)
applyEffect(base, out, modeMap, W, shiftTable, FULL)

assert.deepStrictEqual(getPixel(out, 0, 0), [255, 255, 95, 255], 'white, profile(0,0,-160) sign+1 -> B-160')
assert.deepStrictEqual(getPixel(out, 1, 0), [0, 0, 160, 255], 'black, profile(0,0,-160) sign-1 -> B+160')
assert.deepStrictEqual(getPixel(out, 2, 0), [10, 10, 0, 255], 'shift clamps at 0, not wraps')
assert.deepStrictEqual(getPixel(out, 3, 0), [10, 10, 255, 255], 'shift clamps at 255, not wraps')
assert.deepStrictEqual(getPixel(out, 4, 0), [130, 60, 255, 255], 'all three channels shift, B clamped')
assert.deepStrictEqual(getPixel(out, 5, 0), [70, 140, 0, 255], 'same profile, sign-1 -> exact negation, B clamped')
assert.deepStrictEqual(getPixel(out, 6, 0), getPixel(base, 6, 0), 'pixel outside every rect is byte-identical to base')
assert.deepStrictEqual(getPixel(out, 7, 0), [10, 20, 210, 255], 'a later overlapping rect wins; shift applied exactly once')

// Mutual negation: two equal base pixels, groups on the same profile with opposite signs.
// Uses a small unclamped profile so the negation is exact, not clamp-saturated.
const negProfiles = [...profiles, mk({ r: 20, g: -30, b: 50 })]
const negGroups = [
  { profile: 0, sign: 1 },
  { profile: 0, sign: 1 },
  { profile: 0, sign: 1 },
  { profile: 3, sign: 1 },
  { profile: 3, sign: -1 }
]
const negShiftTable = new Int16Array((GROUP_COUNT + 1) * 3)
buildShiftTable(negProfiles, negGroups, negShiftTable)

const negBase = makeBuffer()
setPixel(negBase, 0, 0, [128, 128, 128, 255])
setPixel(negBase, 1, 0, [128, 128, 128, 255])
const negOut = new Uint8ClampedArray(negBase.length)
const negRects = [
  { x: 0, y: 0, w: 1, h: 1, group: 3 }, // profile3 sign+1
  { x: 1, y: 0, w: 1, h: 1, group: 4 }  // profile3 sign-1
]
stampModeMap(modeMap, W, negRects, FULL)
applyEffect(negBase, negOut, modeMap, W, negShiftTable, FULL)
const p0 = getPixel(negOut, 0, 0)
const p1 = getPixel(negOut, 1, 0)
const baseVal = getPixel(negBase, 0, 0)
assert.deepStrictEqual(
  [p0[0] - baseVal[0], p0[1] - baseVal[1], p0[2] - baseVal[2]],
  [-(p1[0] - baseVal[0]), -(p1[1] - baseVal[1]), -(p1[2] - baseVal[2])],
  'opposite-sign groups on the same profile produce mutually negated shifts'
)

// An independent (unlinked) opposite vector is used verbatim, not derived by negation.
const indepProfiles = [mk({ r: 20, g: -30, b: 50 }, { r: 5, g: 5, b: 5 })]
const indepGroups = Array.from({ length: GROUP_COUNT }, () => ({ profile: 0, sign: -1 }))
const indepShiftTable = new Int16Array((GROUP_COUNT + 1) * 3)
buildShiftTable(indepProfiles, indepGroups, indepShiftTable)

const indepBase = makeBuffer()
setPixel(indepBase, 0, 0, [100, 100, 100, 255])
const indepOut = new Uint8ClampedArray(indepBase.length)
const indepRects = [{ x: 0, y: 0, w: 1, h: 1, group: 0 }]
stampModeMap(modeMap, W, indepRects, FULL)
applyEffect(indepBase, indepOut, modeMap, W, indepShiftTable, FULL)
assert.deepStrictEqual(
  getPixel(indepOut, 0, 0),
  [105, 105, 105, 255],
  'an independently-configured opposite vector applies its own vector, not the negation'
)

console.log('kernel: OK')

// --- State-level checks (renderer/state.js) ---------------------------------

const sBase = makeBuffer()
setPixel(sBase, 0, 0, [150, 150, 150, 255]) // group 0, profile 0
setPixel(sBase, 1, 0, [150, 150, 150, 255]) // group 1, profile 0 (opposite sign)
setPixel(sBase, 2, 0, [77, 88, 99, 255])    // group 2, profile 1 (delete target)

const sOut = new Uint8ClampedArray(sBase.length)
const sModeMap = new Uint8Array(W * H)

function sRepaint(dirty) {
  stampModeMap(sModeMap, W, state.rects, dirty)
  const scratch = new Uint8ClampedArray(dirty.w * dirty.h * 4)
  applyEffect(sBase, scratch, sModeMap, W, state.shiftTable, dirty)
  for (let y = 0; y < dirty.h; y++) {
    for (let x = 0; x < dirty.w; x++) {
      const s = (y * dirty.w + x) * 4
      const d = ((dirty.y + y) * W + (dirty.x + x)) * 4
      sOut[d] = scratch[s]
      sOut[d + 1] = scratch[s + 1]
      sOut[d + 2] = scratch[s + 2]
      sOut[d + 3] = scratch[s + 3]
    }
  }
}

state.imageW = W
state.imageH = H
state.rects = []
state.active = 0
state.undo = []
state.redo = []
state.profiles = Array.from({ length: PROFILE_COUNT }, () => mk({ r: 0, g: 0, b: -160 }))
state.profiles[1] = mk({ r: 50, g: 0, b: 0 })
state.groups = Array.from({ length: GROUP_COUNT }, () => ({ profile: 0, sign: 1 }))
state.groups[1] = { profile: 0, sign: -1 }
state.groups[2] = { profile: 1, sign: 1 }
buildShiftTable(state.profiles, state.groups, state.shiftTable)

addRect({ x: 0, y: 0, w: 1, h: 1, group: 0 })
addRect({ x: 1, y: 0, w: 1, h: 1, group: 1 })
addRect({ x: 2, y: 0, w: 1, h: 1, group: 2 })

sRepaint(FULL)
const pC0 = getPixel(sOut, 2, 0)

// setProfileChannel repaints every group sharing the profile, each at its own sign
const dirty1 = setProfileChannel(0, 'pos', 'r', -200)
assert.ok(dirty1, 'setProfileChannel must return a dirty bbox when the profile has rects')
assert.deepStrictEqual(dirty1, { x: 0, y: 0, w: 2, h: 1 }, 'dirty bbox covers both groups sharing profile 0')
sRepaint(dirty1)
assert.strictEqual(state.profiles[0].neg.r, 200, 'a mirrored profile keeps neg as the negation of pos')
assert.deepStrictEqual(getPixel(sOut, 0, 0), [0, 150, 0, 255], 'sign+1 group: R reduced by 200, clamped at 0')
assert.deepStrictEqual(getPixel(sOut, 1, 0), [255, 150, 255, 255], 'sign-1 group: R increased by 200, clamped at 255')
assert.deepStrictEqual(getPixel(sOut, 2, 0), pC0, 'a group on a different profile is untouched')

console.log('setProfileChannel: OK')

// setGroupSign flips only the active group's pixels
const beforeSign = getPixel(sOut, 1, 0)
const dirty2 = setGroupSign(0, -1)
assert.ok(dirty2, 'setGroupSign must return a dirty bbox')
sRepaint(dirty2)
assert.deepStrictEqual(getPixel(sOut, 0, 0), [255, 150, 255, 255], 'group 0 flips to the exact negation of its shift')
assert.deepStrictEqual(getPixel(sOut, 1, 0), beforeSign, 'a sibling group on the same profile is byte-unchanged')

console.log('setGroupSign: OK')

// setGroupProfile reassigns the vector but keeps the group's current sign
const dirty3 = setGroupProfile(0, 1)
assert.ok(dirty3, 'setGroupProfile must return a dirty bbox')
sRepaint(dirty3)
assert.deepStrictEqual(getPixel(sOut, 0, 0), [100, 150, 150, 255], 'group 0 adopts profile 1 at its current (negative) sign')

console.log('setGroupProfile: OK')

// undo/redo restore and reapply the full binding (profile and sign together)
const afterAssign = getPixel(sOut, 0, 0)
const dirtyUndo = undo()
assert.ok(dirtyUndo, 'undo must return a dirty bbox')
sRepaint(dirtyUndo)
assert.deepStrictEqual(getPixel(sOut, 0, 0), [255, 150, 255, 255], 'undo restores the previous profile+sign binding')

const dirtyRedo = redo()
assert.ok(dirtyRedo, 'redo must return a dirty bbox')
sRepaint(dirtyRedo)
assert.deepStrictEqual(getPixel(sOut, 0, 0), afterAssign, 'redo reapplies the profile reassignment')

console.log('undo/redo group op: OK')

// deleteAt removes the only rect covering a pixel; repaint restores the base byte-for-byte
const delDirty = deleteAt(2, 0)
assert.ok(delDirty, 'deleteAt must locate the rect under the cursor')
sRepaint(delDirty)
assert.deepStrictEqual(getPixel(sOut, 2, 0), getPixel(sBase, 2, 0), 'deleteAt + repaint restores the original pixel')

console.log('deleteAt: OK')

// setProfileChannel with a cleared numeric field is a no-op
const beforeClear = { ...state.profiles[0] }
const dirtyClear = setProfileChannel(0, 'pos', 'g', '')
assert.strictEqual(dirtyClear, null, 'a cleared numeric field returns null')
assert.deepStrictEqual(state.profiles[0], beforeClear, 'a cleared numeric field leaves the vector unchanged')

console.log('setProfileChannel cleared field: OK')

// --- Independent opposite vector: mirror toggle, per-side edits, reset ------

const dirtyUnlink = setProfileLinked(0, false)
assert.strictEqual(dirtyUnlink, null, 'unlinking is a no-op when neg already matches the negation of pos')
assert.strictEqual(state.profiles[0].linked, false, 'profile 0 is now unlinked')

const dirtyNeg = setProfileChannel(0, 'neg', 'r', 10)
assert.ok(dirtyNeg, 'editing the opposite side while unlinked returns a dirty bbox')
sRepaint(dirtyNeg)
assert.strictEqual(state.profiles[0].pos.r, -200, 'editing neg leaves pos untouched')
assert.strictEqual(state.profiles[0].neg.r, 10, 'neg.r updates independently of pos')
assert.deepStrictEqual(getPixel(sOut, 1, 0), [160, 150, 255, 255], 'the sign-1 group repaints using the new independent opposite vector')

const dirtyPosG = setProfileChannel(0, 'pos', 'g', 40)
assert.ok(dirtyPosG, 'editing pos still returns a dirty bbox while unlinked')
assert.strictEqual(state.profiles[0].pos.g, 40, 'pos.g updates')
assert.strictEqual(state.profiles[0].neg.g, 0, 'unlinked profile: editing pos does not touch neg')

console.log('setProfileLinked / independent opposite vector: OK')

// Re-linking re-derives neg from the current pos, discarding the independent value
const dirtyRelink = setProfileLinked(0, true)
assert.ok(dirtyRelink, 'relinking with a mismatched neg returns a dirty bbox')
assert.deepStrictEqual(state.profiles[0].neg, { r: 200, g: -40, b: 160 }, 'relinking re-derives neg as negate(pos)')
sRepaint(dirtyRelink)

console.log('setProfileLinked relink: OK')

// resetProfile restores the factory default, mirrored
const dirtyReset = resetProfile(0)
assert.ok(dirtyReset, 'resetProfile returns a dirty bbox when the profile changed')
assert.deepStrictEqual(
  state.profiles[0],
  { pos: { r: 0, g: 0, b: -160 }, neg: { r: 0, g: 0, b: 160 }, linked: true },
  'resetProfile restores the default forward/opposite vectors and mirroring'
)
sRepaint(dirtyReset)
assert.strictEqual(resetProfile(0), null, 'resetting an already-default profile is a no-op')

console.log('resetProfile: OK')

// --- Selection + bulk group reassignment ------------------------------------

assert.strictEqual(state.selected.size, 0, 'selection starts empty')
const [rA, rB] = state.rects // (0,0) group 0, (1,0) group 1, per earlier setup

selectOnly(rA)
assert.deepStrictEqual([...state.selected], [rA], 'selectOnly replaces the selection with exactly one rect')

toggleSelect(rB)
assert.strictEqual(state.selected.size, 2, 'toggleSelect adds a second rect without clearing the first')
toggleSelect(rB)
assert.deepStrictEqual([...state.selected], [rA], 'toggling an already-selected rect removes it')

selectOnly(null)
assert.strictEqual(state.selected.size, 0, 'selectOnly(null) clears the selection')

selectOnly(rA)
toggleSelect(rB)
const groupsBefore = [rA.group, rB.group]
const dirtyAssign = assignSelectedGroup(2)
assert.ok(dirtyAssign, 'assignSelectedGroup returns a dirty bbox when any selected rect changes group')
assert.deepStrictEqual([rA.group, rB.group], [2, 2], 'both selected rects adopt the new group')
assert.strictEqual(assignSelectedGroup(2), null, 'reassigning to the same group is a no-op')
sRepaint(dirtyAssign)
assert.deepStrictEqual(getPixel(sOut, 0, 0), [200, 150, 150, 255], 'rA repaints under its newly-assigned group (profile1 sign+1)')
assert.deepStrictEqual(getPixel(sOut, 1, 0), [200, 150, 150, 255], 'rB repaints under its newly-assigned group too')

const dirtyAssignUndo = undo()
assert.ok(dirtyAssignUndo, 'undo must return a dirty bbox for the assign op')
assert.deepStrictEqual([rA.group, rB.group], groupsBefore, 'undo restores each rect\u2019s prior group')

const dirtyAssignRedo = redo()
assert.ok(dirtyAssignRedo, 'redo must return a dirty bbox for the assign op')
assert.deepStrictEqual([rA.group, rB.group], [2, 2], 'redo reapplies the bulk reassignment')

console.log('selection + assignSelectedGroup: OK')

// Deleting a selected rect drops it from the selection; a sibling stays selected
const delSelDirty = deleteAt(rA.x, rA.y)
assert.ok(delSelDirty, 'deleteAt must locate the selected rect')
assert.ok(!state.selected.has(rA), 'deleting a selected rect removes it from the selection')
assert.ok(state.selected.has(rB), 'a sibling selection is untouched by an unrelated delete')

clearSelection()
assert.strictEqual(state.selected.size, 0, 'clearSelection empties the selection')

console.log('selection cleanup on delete: OK')

// --- Active-follows-selection (step 4) ---------------------------------------

const rectG2 = { x: 4, y: 1, w: 1, h: 1, group: 2 }
addRect(rectG2)
const rectG3 = { x: 5, y: 1, w: 1, h: 1, group: 3 }
addRect(rectG3)

selectOnly(rectG2)
assert.strictEqual(state.active, 2, 'selectOnly sets the active group to the selected rect\u2019s group')

toggleSelect(rectG3)
assert.strictEqual(state.active, 3, 'toggleSelect(add) sets the active group to the newly selected rect\u2019s group')

toggleSelect(rectG3) // remove it again
assert.strictEqual(state.active, 3, 'toggling a rect off leaves the active group unchanged')

clearSelection()
assert.strictEqual(assignSelectedGroup(4), null, 'assignSelectedGroup on an empty selection is a no-op')
assert.strictEqual(state.active, 4, 'assignSelectedGroup sets the active group even when nothing changed')

console.log('active-follows-selection: OK')

// --- setGroupBinding: profile and sign move together, as one undo step -------

state.active = 4
state.undo = []
state.redo = []
assert.deepStrictEqual({ ...state.groups[4] }, { profile: 0, sign: 1 }, 'group 4 starts forward on profile 0')

setGroupBinding(4, 2, -1)
assert.deepStrictEqual({ ...state.groups[4] }, { profile: 2, sign: -1 }, 'setGroupBinding sets profile and sign together')
assert.strictEqual(state.undo.length, 1, 'a picker choice is a single undo step, not two')

undo()
assert.deepStrictEqual({ ...state.groups[4] }, { profile: 0, sign: 1 }, 'undo restores both fields at once')

assert.strictEqual(setGroupBinding(4, 0, 1), null, 'setting the binding a group already has is a no-op')

console.log('setGroupBinding: OK')

console.log('All effect/state checks passed.')

// --- Themes: activation, fork-on-edit, config pointer ------------------------

const saved = []
globalThis.hl = { saveTheme: (id, theme) => { saved.push({ id, theme }); return { ok: true } } }

setThemeList([
  { version: 1, id: 'default', name: 'Default', locked: true, builtin: true,
    profiles: Array.from({ length: PROFILE_COUNT }, () => mk({ r: 0, g: 0, b: -160 })) },
  { version: 1, id: 'cool', name: 'Cool', locked: false, builtin: false,
    profiles: Array.from({ length: PROFILE_COUNT }, () => mk({ r: -40, g: 0, b: 0 })) }
])

assert.strictEqual(state.themes.length, 2, 'both valid themes are listed')

applyTheme('default')
assert.strictEqual(state.theme.id, 'default', 'applyTheme switches the active theme')
assert.ok(state.theme.locked, 'the built-in theme is locked')
assert.deepStrictEqual(state.profiles[0].pos, { r: 0, g: 0, b: -160 }, 'the palette comes from the theme file')
assert.strictEqual(applyTheme('nope'), null, 'an unknown theme id is a no-op')

// A no-op edit must not fork
setProfileChannel(0, 'pos', 'b', -160)
assert.strictEqual(state.theme.id, 'default', 'an edit that changes nothing does not fork')

// A real edit on a locked theme forks to an unlocked copy and writes only the copy
setProfileChannel(0, 'pos', 'b', -100)
assert.strictEqual(state.theme.id, 'default-copy', 'editing a locked theme forks it')
assert.strictEqual(state.theme.locked, false, 'the fork is unlocked')
assert.strictEqual(state.profiles[0].pos.b, -100, 'the edit is applied to the fork')
assert.deepStrictEqual(
  state.themes.find((t) => t.id === 'default').profiles[0].pos,
  { r: 0, g: 0, b: -160 },
  'the locked theme keeps its original vectors'
)

// A second edit stays in the fork
setProfileChannel(0, 'pos', 'r', -20)
assert.strictEqual(state.theme.id, 'default-copy', 'an unlocked theme is edited in place, not forked again')

// Fork ids escalate rather than collide
applyTheme('default')
setProfileChannel(1, 'pos', 'r', -30)
assert.strictEqual(state.theme.id, 'default-copy-2', 'a taken fork id escalates to -copy-2')

await new Promise((r) => setTimeout(r, 250))   // let the debounced theme write land
assert.ok(saved.length > 0, 'the fork is persisted through the bridge')
assert.ok(saved.every((s) => s.id !== 'default'), 'the locked theme is never written')
assert.ok(saved.every((s) => s.theme.locked === false), 'every written theme is unlocked')
delete globalThis.hl

console.log('themes: OK')

// --- Resize keeps rect geometry drift-free ----------------------------------

setSource(new Uint8Array(0), W, H)
state.rects = []
state.undo = []
state.redo = []
addRect({ x: 2, y: 0, w: 4, h: 2, group: 0 })
const roundTripRect = state.rects[0]
const before = { x: roundTripRect.x, y: roundTripRect.y, w: roundTripRect.w, h: roundTripRect.h }

resizeTo({ width: W / 2, height: H / 2 }, 0.5)
assert.deepStrictEqual(
  { x: roundTripRect.x, y: roundTripRect.y, w: roundTripRect.w, h: roundTripRect.h },
  { x: 1, y: 0, w: 2, h: 1 },
  'resizing to 50% halves rect geometry'
)
assert.strictEqual(state.imageW, W / 2, 'resizeTo installs the new document width')
assert.strictEqual(state.modeMap.length, (W / 2) * (H / 2), 'resizeTo rebuilds modeMap at the new size')

resizeTo({ width: W, height: H }, 1)
assert.deepStrictEqual(
  { x: roundTripRect.x, y: roundTripRect.y, w: roundTripRect.w, h: roundTripRect.h },
  before,
  'scaling back to 100% restores the exact original geometry (no rounding drift)'
)

// A rect that lives only in the undo stack (deleted, not in state.rects) is
// still rescaled by resizeTo, so undoing after a resize reinstates it at the
// correct geometry rather than stale pre-resize coordinates.
state.rects = []
state.undo = []
state.redo = []
addRect({ x: 0, y: 2, w: 4, h: 2, group: 1 })
const deletedRect = state.rects[0]
deleteAt(0, 2)
assert.strictEqual(state.rects.length, 0, 'the rect is removed from state.rects after delete')

resizeTo({ width: W / 2, height: H / 2 }, 0.5)
assert.deepStrictEqual(
  { x: deletedRect.x, y: deletedRect.y, w: deletedRect.w, h: deletedRect.h },
  { x: 0, y: 1, w: 2, h: 1 },
  'resizeTo rescales a rect that only lives in the undo stack'
)

const undoDeleteDirty = undo()
assert.ok(undoDeleteDirty, 'undo must restore the deleted rect')
assert.deepStrictEqual(
  { x: state.rects[0].x, y: state.rects[0].y, w: state.rects[0].w, h: state.rects[0].h },
  { x: 0, y: 1, w: 2, h: 1 },
  'undo reinstates the rect at its already-rescaled geometry, not stale pre-resize coordinates'
)

console.log('resize: OK')
