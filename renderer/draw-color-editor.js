// Shift+click popup: RGB sliders and numeric inputs for a theme's D/A colour slot.

import { state } from './state.js'
import * as cmd from './commands.js'
import { hexToRgb, rgbToHex } from './colors.js'

const CHANNELS = ['r', 'g', 'b']
const LABELS = { r: 'R', g: 'G', b: 'B' }

let panelEl = null
let titleEl = null
let sliders = { r: null, g: null, b: null }
let nums = { r: null, g: null, b: null }
let swatchEl = null
let hexEl = null
let openIndex = -1
let outsideListener = null

function buildPanel() {
  panelEl = document.createElement('div')
  panelEl.className = 'profile-editor'
  panelEl.style.display = 'none'

  titleEl = document.createElement('div')
  titleEl.className = 'pe-title'
  panelEl.appendChild(titleEl)

  for (const ch of CHANNELS) {
    const row = document.createElement('div')
    row.className = 'pe-row'

    const label = document.createElement('span')
    label.className = 'pe-label'
    label.textContent = LABELS[ch]

    const slider = document.createElement('input')
    slider.type = 'range'
    slider.className = 'pe-slider'
    slider.min = '0'
    slider.max = '255'
    slider.step = '1'

    const num = document.createElement('input')
    num.type = 'number'
    num.className = 'pe-num'
    num.min = '0'
    num.max = '255'
    num.step = '1'

    slider.addEventListener('input', () => onChannelInput(ch, slider.value))
    num.addEventListener('input', () => onChannelInput(ch, num.value))

    row.appendChild(label)
    row.appendChild(slider)
    row.appendChild(num)
    panelEl.appendChild(row)
    sliders[ch] = slider
    nums[ch] = num
  }

  const footer = document.createElement('div')
  footer.className = 'pe-row pe-footer'

  swatchEl = document.createElement('span')
  swatchEl.className = 'pe-swatch'

  hexEl = document.createElement('span')
  hexEl.className = 'pe-label'
  hexEl.style.width = 'auto'

  const resetBtn = document.createElement('button')
  resetBtn.type = 'button'
  resetBtn.className = 'pe-reset'
  resetBtn.textContent = 'Reset'
  resetBtn.addEventListener('click', () => {
    cmd.resetDrawPaletteColor(openIndex)
    populate()
  })

  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'pe-close'
  closeBtn.textContent = 'Close'
  closeBtn.addEventListener('click', closeDrawColorEditor)

  footer.appendChild(swatchEl)
  footer.appendChild(hexEl)
  footer.appendChild(resetBtn)
  footer.appendChild(closeBtn)
  panelEl.appendChild(footer)
  document.body.appendChild(panelEl)
}

function onChannelInput(ch, raw) {
  if (raw.trim() === '') return
  const value = Math.round(Number(raw))
  if (Number.isNaN(value)) return
  const rgb = hexToRgb(state.drawColors[openIndex])
  rgb[ch] = Math.max(0, Math.min(255, value))
  cmd.setDrawPaletteColor(openIndex, rgbToHex(rgb))
  populate()
}

function populate() {
  const hex = state.drawColors[openIndex]
  const rgb = hexToRgb(hex)
  for (const ch of CHANNELS) {
    sliders[ch].value = String(rgb[ch])
    nums[ch].value = String(rgb[ch])
  }
  swatchEl.style.background = hex
  hexEl.textContent = hex
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
  if (panelEl && !panelEl.contains(e.target)) closeDrawColorEditor()
}

export function openDrawColorEditor(index, anchorEl) {
  if (!panelEl) buildPanel()
  openIndex = index
  titleEl.textContent = `Colour ${index + 1}`
  populate()
  positionPanel(anchorEl)

  if (outsideListener) document.removeEventListener('mousedown', outsideListener, true)
  outsideListener = onOutsideMouseDown
  setTimeout(() => document.addEventListener('mousedown', outsideListener, true), 0)
}

export function closeDrawColorEditor() {
  if (!panelEl) return
  panelEl.style.display = 'none'
  openIndex = -1
  if (outsideListener) {
    document.removeEventListener('mousedown', outsideListener, true)
    outsideListener = null
  }
}

export function isDrawColorEditorOpen() {
  return openIndex !== -1
}
