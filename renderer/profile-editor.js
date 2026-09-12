// Shift+click popup: per-channel slider + numeric field for one profile's
// light and dark RGB vectors, plus a mirror toggle. Direction lives on
// the group binding, not here — see state.js's setGroupSign/toggleActiveSign.

import { state } from './state.js'
import * as cmd from './commands.js'
import { sideColor } from './colors.js'

const CHANNELS = ['r', 'g', 'b']
const CHANNEL_LABELS = { r: 'R', g: 'G', b: 'B' }

let panelEl = null
let titleEl = null
let sliders = { pos: {}, neg: {} }
let nums = { pos: {}, neg: {} }
let mirrorBox = null
let lightSwatch = null
let darkSwatch = null
let openProfileIndex = -1
let outsideListener = null

function buildPanel() {
  panelEl = document.createElement('div')
  panelEl.className = 'profile-editor'
  panelEl.style.display = 'none'

  titleEl = document.createElement('div')
  titleEl.className = 'pe-title'
  panelEl.appendChild(titleEl)

  sliders = { pos: {}, neg: {} }
  nums = { pos: {}, neg: {} }

  const sides = [['pos', 'Light'], ['neg', 'Dark']]
  for (const [side, sectionLabel] of sides) {
    const section = document.createElement('div')
    section.className = 'pe-section'
    section.textContent = sectionLabel
    panelEl.appendChild(section)

    for (const ch of CHANNELS) {
      const row = document.createElement('div')
      row.className = 'pe-row'

      const labelEl = document.createElement('span')
      labelEl.className = 'pe-label'
      labelEl.textContent = CHANNEL_LABELS[ch]

      const slider = document.createElement('input')
      slider.type = 'range'
      slider.className = 'pe-slider'
      slider.min = '-255'
      slider.max = '255'
      slider.step = '1'

      const num = document.createElement('input')
      num.type = 'number'
      num.className = 'pe-num'
      num.min = '-255'
      num.max = '255'
      num.step = '1'

      slider.addEventListener('input', () => onChannelInput(side, ch, slider.value))
      num.addEventListener('input', () => onChannelInput(side, ch, num.value))

      row.appendChild(labelEl)
      row.appendChild(slider)
      row.appendChild(num)
      panelEl.appendChild(row)

      sliders[side][ch] = slider
      nums[side][ch] = num
    }

    if (side === 'pos') {
      const mirrorLabel = document.createElement('label')
      mirrorLabel.className = 'pe-mirror'

      mirrorBox = document.createElement('input')
      mirrorBox.type = 'checkbox'
      mirrorBox.className = 'pe-mirror-box'
      mirrorBox.addEventListener('change', onMirrorToggle)

      const mirrorText = document.createElement('span')
      mirrorText.textContent = 'Mirror dark side'

      mirrorLabel.appendChild(mirrorBox)
      mirrorLabel.appendChild(mirrorText)
      panelEl.appendChild(mirrorLabel)
    }
  }

  const footer = document.createElement('div')
  footer.className = 'pe-row pe-footer'

  lightSwatch = document.createElement('span')
  lightSwatch.className = 'pe-swatch'
  lightSwatch.title = 'light'

  darkSwatch = document.createElement('span')
  darkSwatch.className = 'pe-swatch'
  darkSwatch.title = 'dark'

  const resetBtn = document.createElement('button')
  resetBtn.type = 'button'
  resetBtn.className = 'pe-reset'
  resetBtn.textContent = 'Reset'
  resetBtn.addEventListener('click', onReset)

  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'pe-close'
  closeBtn.textContent = 'Close'
  closeBtn.addEventListener('click', closeProfileEditor)

  footer.appendChild(lightSwatch)
  footer.appendChild(darkSwatch)
  footer.appendChild(resetBtn)
  footer.appendChild(closeBtn)
  panelEl.appendChild(footer)

  document.body.appendChild(panelEl)
}

function onChannelInput(side, channel, rawValue) {
  if (rawValue.trim() === '') return          // mid-typing empty field: leave it alone
  cmd.setProfileChannel(openProfileIndex, side, channel, rawValue)
  populateInputs()
  refreshSwatches()
}

function onMirrorToggle() {
  cmd.setProfileLinked(openProfileIndex, mirrorBox.checked)
  populateInputs()
  refreshSwatches()
}

function onReset() {
  cmd.resetProfile(openProfileIndex)
  populateInputs()
  refreshSwatches()
}

/** Disabling is what prevents an implicit unlink: while mirrored, the opposite
 * side is display-only and follows `pos` automatically. */
function populateInputs() {
  const p = state.profiles[openProfileIndex]
  for (const side of ['pos', 'neg']) {
    for (const ch of CHANNELS) {
      sliders[side][ch].value = String(p[side][ch])
      nums[side][ch].value = String(p[side][ch])
    }
  }
  mirrorBox.checked = p.linked
  for (const ch of CHANNELS) {
    sliders.neg[ch].disabled = p.linked
    nums.neg[ch].disabled = p.linked
  }
}

function refreshSwatches() {
  const p = state.profiles[openProfileIndex]
  lightSwatch.style.background = sideColor(p.pos, 1)
  darkSwatch.style.background = sideColor(p.neg, -1)
}

function positionPanel(anchorEl) {
  const rect = anchorEl.getBoundingClientRect()
  panelEl.style.display = 'flex'
  const panelWidth = panelEl.offsetWidth
  let left = rect.left
  const maxLeft = window.innerWidth - panelWidth - 8
  if (left > maxLeft) left = maxLeft
  if (left < 8) left = 8
  panelEl.style.left = `${left}px`
  panelEl.style.top = `${rect.bottom + 6}px`
}

function onOutsideMouseDown(e) {
  if (panelEl && !panelEl.contains(e.target)) closeProfileEditor()
}

export function openProfileEditor(profileIndex, anchorEl) {
  if (!panelEl) buildPanel()
  openProfileIndex = profileIndex
  titleEl.textContent = `Profile ${profileIndex + 1}`
  populateInputs()
  refreshSwatches()
  positionPanel(anchorEl)

  if (outsideListener) document.removeEventListener('mousedown', outsideListener, true)
  outsideListener = onOutsideMouseDown
  setTimeout(() => document.addEventListener('mousedown', outsideListener, true), 0)
}

export function closeProfileEditor() {
  if (!panelEl) return
  panelEl.style.display = 'none'
  openProfileIndex = -1
  if (outsideListener) {
    document.removeEventListener('mousedown', outsideListener, true)
    outsideListener = null
  }
}

export function isProfileEditorOpen() {
  return openProfileIndex !== -1
}
