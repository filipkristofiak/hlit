// Status bar DOM: group buttons, active-group direction button, image/rect counters.

import { state } from './state.js'
import * as cmd from './commands.js'
import { openProfilePicker } from './picker.js'
import { GROUP_TOTAL, MASK_GROUP } from './effect.js'
import { bindingColor, maskColor } from './colors.js'

const statusEl = document.getElementById('status')

let buttons = []
let modeBtn = null
let info = null

function groupColor(groupIndex) {
  if (groupIndex === MASK_GROUP) return maskColor(state.maskStyle)
  const g = state.groups[groupIndex]
  return bindingColor(state.profiles[g.profile], g.sign)
}

function build() {
  statusEl.innerHTML = ''

  const groupsWrap = document.createElement('div')
  groupsWrap.className = 'groups'
  buttons = []
  for (let i = 0; i < GROUP_TOTAL; i++) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'group-btn'
    btn.textContent = i === MASK_GROUP ? 'M' : String(i + 1)
    btn.addEventListener('click', () => cmd.chooseGroup(i))
    groupsWrap.appendChild(btn)
    buttons.push(btn)
  }
  statusEl.appendChild(groupsWrap)

  const sep1 = document.createElement('div')
  sep1.className = 'sep'
  statusEl.appendChild(sep1)

  modeBtn = document.createElement('button')
  modeBtn.type = 'button'
  modeBtn.className = 'mode-btn'
  modeBtn.title = 'Toggle light/dark (i)'
  modeBtn.addEventListener('click', () => cmd.flipDirection())

  // Mouse twin for p/P: the swatch is the active group's control, so a
  // right-click on it opens that group's picker. Left-click still flips
  // light/dark.
  modeBtn.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    openProfilePicker()
  })
  statusEl.appendChild(modeBtn)

  info = document.createElement('span')
  info.className = 'info'
  statusEl.appendChild(info)
}

export function init() {
  build()
  refresh()
}

export function refresh() {
  for (let i = 0; i < GROUP_TOTAL; i++) {
    const btn = buttons[i]
    const hasRects = state.rects.some((r) => r.group === i)
    btn.classList.toggle('active', state.active === i)
    btn.classList.toggle('reassign', state.selected.size > 0)
    btn.style.borderBottomColor = hasRects ? groupColor(i) : 'transparent'
  }

  const isMask = state.active === MASK_GROUP
  modeBtn.style.background = groupColor(state.active)
  modeBtn.disabled = isMask
  modeBtn.classList.toggle('dark', !isMask && state.groups[state.active].sign === -1)
  modeBtn.classList.toggle('masked', isMask)
  modeBtn.title = isMask ? 'Mask \u2014 press p to pick a style' : 'Toggle light/dark (i)'

  const selSuffix = state.selected.size ? ` \u00b7 ${state.selected.size} selected` : ''
  const scaleSuffix = state.scale !== 1 ? ` \u00b7 ${Math.round(state.scale * 1000) / 10}%` : ''
  info.textContent = state.imageW && state.imageH
    ? `${state.imageW}\u00d7${state.imageH} \u00b7 ${state.rects.length} rects${scaleSuffix}${selSuffix}`
    : ''
}
