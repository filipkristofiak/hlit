// Inline text entry for the A group: a transparent textarea laid over the
// dragged box, sized and positioned in image space, committing into a rect.

import { state } from './state.js'
import { fontPxFor, LINE_HEIGHT } from './annotations.js'
import { annotColor } from './colors.js'
import { viewScale } from './view.js'
import * as cmd from './commands.js'

let el = null
let target = null
let creating = false

export function isTextEditorOpen() {
  return !!el
}

// Detach the module state before removing the node: removing a focused
// textarea fires `blur` synchronously, and the blur listener below commits
// whatever is still in the field unless `el` is already null by the time it
// runs — so null it out first, then remove the (now-orphaned) node.
function teardown() {
  const node = el
  el = null
  target = null
  creating = false
  if (node) node.remove()
}

/** Opens the editor over `rect` (image-space coords). `isNew` marks a
 *  freshly-dragged box (commit adds it) vs. re-editing an existing one
 *  (commit edits or, if emptied, deletes it). */
export function openTextEditor(rect, { isNew }) {
  if (el) commitTextEditor()
  target = rect
  creating = isNew

  const k = viewScale()
  el = document.createElement('textarea')
  el.className = 'text-editor'
  el.style.left = `${rect.x * k}px`
  el.style.top = `${rect.y * k}px`
  el.style.width = `${rect.w * k}px`
  el.style.height = `${rect.h * k}px`
  el.style.fontSize = `${fontPxFor(state.scale) * k}px`
  el.style.lineHeight = String(LINE_HEIGHT)
  el.style.color = annotColor(rect.color)
  el.value = rect.text || ''

  el.addEventListener('keydown', (e) => {
    // Every key is ours while the editor is open: no global shortcut fires.
    e.stopPropagation()
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      commitTextEditor()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelTextEditor()
    }
  })
  el.addEventListener('blur', () => commitTextEditor())

  document.getElementById('wrap').appendChild(el)
  el.focus()
  if (!isNew) el.select()
}

/** No-op when closed (safe to call from a re-entrant blur after teardown). */
export function commitTextEditor() {
  if (!el) return
  const text = el.value
  const isEmpty = text.trim() === ''
  const rect = target
  const wasCreating = creating
  teardown()

  if (wasCreating) {
    if (!isEmpty) cmd.commitTextRect(rect, text)
    return
  }
  if (isEmpty) {
    cmd.deleteRect(rect)
  } else if (text !== rect.text) {
    cmd.editRectText(rect, text)
  }
}

/** Tears down without committing. A freshly-dragged box was never added, so
 *  the canvas is already correct; an existing rect keeps its prior text. */
export function cancelTextEditor() {
  teardown()
}
