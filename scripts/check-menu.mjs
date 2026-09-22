// Headless proof over main/menu.js: off macOS the Image accelerators are
// labels only, so renderer/main.js's Ctrl handling is the single path.

import assert from 'node:assert'
import menu from '../main/menu.js'   // main/ is CommonJS: default import, then destructure

const { buildMenuTemplate } = menu

function acceleratedImageItems(platform) {
  const image = buildMenuTemplate(platform, () => {}).find((m) => m.label === 'Image')
  assert.ok(image, `${platform}: Image menu missing`)
  return image.submenu.filter((item) => item.accelerator)
}

for (const platform of ['win32', 'linux']) {
  const items = acceleratedImageItems(platform)
  assert.strictEqual(items.length, 6, `${platform}: expected 6 accelerated Image items`)
  for (const item of items) {
    assert.strictEqual(item.registerAccelerator, false,
      `${platform}: "${item.label}" still registers ${item.accelerator}; the renderer owns that chord`)
  }
}

for (const item of acceleratedImageItems('darwin')) {
  assert.notStrictEqual(item.registerAccelerator, false,
    `darwin: "${item.label}" must keep its real Cmd accelerator`)
}

// Reload must not sit on a Ctrl chord the renderer owns off macOS.
const view = buildMenuTemplate('win32', () => {}).find((m) => m.label === 'View')
assert.strictEqual(view.submenu[0].accelerator, 'F5')

console.log('menu ok')
