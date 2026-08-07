(function exposeScorebugThemes(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.scorebugTheme = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const themes = Object.freeze([
    Object.freeze({ id: 'default', label: '默认专业', description: '简洁高对比', overlay: Object.freeze({ width: 680, height: 280, minWidth: 510, minHeight: 210 }) }),
    Object.freeze({ id: 'broadcast', label: '现代转播', description: '电视赛事质感', overlay: Object.freeze({ width: 680, height: 280, minWidth: 510, minHeight: 210 }) }),
    Object.freeze({ id: 'heritage', label: '复古球场', description: '经典手动记分牌', overlay: Object.freeze({ width: 680, height: 280, minWidth: 510, minHeight: 210 }) }),
    Object.freeze({ id: 'future', label: 'BSO 聚焦', description: '长队名 · 状态塔', overlay: Object.freeze({ width: 840, height: 280, minWidth: 600, minHeight: 200 }) })
  ]);
  const themeIds = new Set(themes.map((theme) => theme.id));
  const isTheme = (value) => themeIds.has(value);
  const normalizeTheme = (value) => (isTheme(value) ? value : 'default');
  const getOverlayPresentation = (value) => ({ ...themes.find((theme) => theme.id === normalizeTheme(value)).overlay });

  return { themes, isTheme, normalizeTheme, getOverlayPresentation };
}));
