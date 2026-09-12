// Keyboard help overlay, toggled with ?. Built lazily on first open.

import { keyLabels } from './keylabels.js'

const K = keyLabels(window.hl && window.hl.platform)

const SHORTCUTS = [
  [K.paste, 'Paste a screenshot'],
  [K.copy, 'Copy the highlighted image'],
  [K.save, 'Save a PNG'],
  [K.undoRedo, 'Undo / redo'],
  ['Drag', 'New highlight in the active group'],
  [K.addToSelection, 'Select a rectangle / add to the selection'],
  ['1 \u2013 5', 'Move the selection to that group, or make it active'],
  [K.cycleGroup, 'Next / previous active group'],
  ['O', 'Flip the active group between light and dark'],
  ['x / Delete', 'Remove the rectangle under the cursor'],
  ['Esc', 'Clear the selection, or cancel a drag'],
  ['P', 'Open the profile picker'],
  ['in picker: 1 \u2013 5', 'Pick that profile in the highlighted row'],
  ['in picker: h l \u2190 \u2192', 'Move between profiles'],
  ['in picker: j k \u2191 \u2193', 'Switch the light / dark row'],
  ['in picker: g / G', 'First / last profile'],
  ['in picker: Enter', 'Apply the highlighted cell'],
  ['in picker: E / shift-click', 'Edit that profile\u2019s vectors'],
  ['T', 'Open the theme picker'],
  ['in themes: 1 \u2013 9', 'Load that theme directly'],
  ['in themes: j k \u2191 \u2193', 'Move between themes'],
  ['in themes: g / G', 'First / last theme'],
  ['in themes: Enter', 'Load the highlighted palette'],
  ['in editor: Esc', 'Close the vectors panel, back to the picker'],
  ['q / Esc', 'Close any popup'],
  ['?', 'Toggle this help']
]

const THEME_NOTES = [
  'A theme is a palette file in ~/.config/hlit/themes/ \u2014 T lists every one found there.',
  'The shipped Default theme is locked: the first profile edit forks it to an unlocked copy, which becomes active.',
  'An unlocked theme is written in place as you edit; settings.json only records which theme is active.'
]

let overlayEl = null

function build() {
  overlayEl = document.createElement('div')
  overlayEl.className = 'help-overlay'
  overlayEl.style.display = 'none'
  overlayEl.addEventListener('mousedown', closeHelp)

  const panel = document.createElement('div')
  panel.className = 'help-panel'
  panel.addEventListener('mousedown', (e) => e.stopPropagation())

  const title = document.createElement('div')
  title.className = 'help-title'
  title.textContent = 'Shortcuts'
  panel.appendChild(title)

  for (const [keys, desc] of SHORTCUTS) {
    const row = document.createElement('div')
    row.className = 'help-row'

    const k = document.createElement('span')
    k.className = 'help-keys'
    k.textContent = keys

    const d = document.createElement('span')
    d.className = 'help-desc'
    d.textContent = desc

    row.appendChild(k)
    row.appendChild(d)
    panel.appendChild(row)
  }

  const section = document.createElement('div')
  section.className = 'help-section'
  section.textContent = 'Themes'
  panel.appendChild(section)

  for (const line of THEME_NOTES) {
    const note = document.createElement('div')
    note.className = 'help-note'
    note.textContent = line
    panel.appendChild(note)
  }

  const foot = document.createElement('div')
  foot.className = 'help-foot'
  foot.textContent = '? or q closes'
  panel.appendChild(foot)

  overlayEl.appendChild(panel)
  document.body.appendChild(overlayEl)
}

export function openHelp() {
  if (!overlayEl) build()
  overlayEl.style.display = 'flex'
}

export function closeHelp() {
  if (overlayEl) overlayEl.style.display = 'none'
}

export function isHelpOpen() {
  return !!overlayEl && overlayEl.style.display !== 'none'
}
