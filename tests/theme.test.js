const test = require('node:test');
const assert = require('node:assert/strict');

const { DEFAULT_SETTINGS } = require('../src/storage');
const { themes, isTheme, normalizeTheme, getOverlayPresentation } = require('../src/renderer/theme');

test('scoreboard exposes the default theme and three selectable designs', () => {
  assert.deepEqual(themes.map((theme) => theme.id), [
    'default',
    'broadcast',
    'heritage',
    'future'
  ]);
  assert.deepEqual(themes.find((theme) => theme.id === 'future'), {
    id: 'future',
    label: 'BSO 聚焦',
    description: '长队名 · 状态塔',
    overlay: { width: 840, height: 280, minWidth: 600, minHeight: 200 }
  });
  assert.deepEqual(getOverlayPresentation('future'), { width: 840, height: 280, minWidth: 600, minHeight: 200 });
  assert.deepEqual(getOverlayPresentation('unknown'), { width: 680, height: 280, minWidth: 510, minHeight: 210 });
  assert.equal(DEFAULT_SETTINGS.overlayTheme, 'default');
});

test('theme values are validated before they are persisted or rendered', () => {
  for (const theme of themes) {
    assert.equal(isTheme(theme.id), true);
    assert.equal(normalizeTheme(theme.id), theme.id);
  }
  assert.equal(isTheme('unknown'), false);
  assert.equal(normalizeTheme('unknown'), 'default');
  assert.equal(normalizeTheme(undefined), 'default');
});
