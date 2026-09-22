// User-visible key names. macOS spells modifiers with glyphs, Windows and Linux
// spell them out, so every label the UI prints lives here, keyed by platform.

const MAC = {
  paste: '\u2318V',
  copy: '\u2318C',
  save: '\u2318S',
  resize: '\u21e7\u2318R',
  undoRedo: 'u / \u2303R or \u2318Z / \u21e7\u2318Z',
  addToSelection: 'Click / \u2318-click',
  cycleGroup: 'Tab / \u21e7Tab',
  hint: '\u2318V to paste a screenshot \u00b7 ? for shortcuts'
}

const OTHER = {
  paste: 'Ctrl+V',
  copy: 'Ctrl+C',
  save: 'Ctrl+S',
  resize: 'Ctrl+Shift+R',
  undoRedo: 'u / Ctrl+R or Ctrl+Z / Ctrl+Shift+Z',
  addToSelection: 'Click / Ctrl+click',
  cycleGroup: 'Tab / Shift+Tab',
  hint: 'Ctrl+V to paste a screenshot \u00b7 ? for shortcuts'
}

/** `platform` is a `process.platform` value; anything other than 'darwin' gets
 * spelled-out modifiers, so a missing bridge degrades to the Ctrl spelling. */
export function keyLabels(platform) {
  return platform === 'darwin' ? MAC : OTHER
}
