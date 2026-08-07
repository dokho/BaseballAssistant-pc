function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
}

function lampSet(value, max, type) {
  return Array.from(
    { length: max },
    (_, index) => `<i class="count-lamp ${type} ${index < value ? 'on' : ''}"></i>`
  ).join('');
}

function safeColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
}

function teamNameForTheme(team, theme) {
  return theme === 'future'
    ? (team.fullName || team.shortName)
    : (team.shortName || team.fullName);
}

function render(payload) {
  const { game, settings } = payload;
  document.body.className = `mode-${settings.overlayMode || 'green'}`;
  const root = document.querySelector('#scorebug');
  if (!game) { root.innerHTML = '<div class="empty">暂无比赛</div>'; return; }
  const title = String(settings.overlayTitle || '').trim() || game.title || '棒球比赛';
  const theme = window.scorebugTheme.normalizeTheme(settings.overlayTheme);
  const awayName = teamNameForTheme(game.away, theme);
  const homeName = teamNameForTheme(game.home, theme);
  const colors = {
    background: safeColor(settings.overlayBackgroundColor, '#2857a6'),
    away: safeColor(game.away.color, '#3d43c6'),
    home: safeColor(game.home.color, '#19b5e5')
  };

  root.innerHTML = `
    <section class="scoreboard theme-${theme}" data-theme="${theme}" aria-label="棒球直播比分牌" style="--overlay-background:${colors.background};--away-team-background:${colors.away};--home-team-background:${colors.home}">
      <header class="scoreboard-title">${escapeHtml(title)}</header>
      <div class="scoreboard-main">
        <div class="scoreboard-teams">
          <div class="scoreboard-team away ${game.away.logo ? 'has-logo' : ''}">
            <span class="team-logo">${game.away.logo ? `<img src="${game.away.logo}" alt="" />` : ''}</span>
            <span class="scoreboard-team-name">${escapeHtml(awayName)}</span>
            <strong class="scoreboard-score">${game.score.away}</strong>
          </div>
          <div class="scoreboard-team home ${game.home.logo ? 'has-logo' : ''}">
            <span class="team-logo">${game.home.logo ? `<img src="${game.home.logo}" alt="" />` : ''}</span>
            <span class="scoreboard-team-name">${escapeHtml(homeName)}</span>
            <strong class="scoreboard-score">${game.score.home}</strong>
          </div>
        </div>
        <div class="inning-panel" aria-label="当前局数">
          <span class="half-arrow ${game.half === 'top' ? 'active' : 'idle'}">▲</span>
          <strong class="inning-number">${game.currentInning}</strong>
          <span class="half-arrow ${game.half === 'bottom' ? 'active' : 'idle'}">▼</span>
        </div>
        <div class="bases-panel" aria-label="垒上情况">
          <div class="bases-diamond">
            <i class="base base-1 ${game.bases[0] ? 'on' : ''}"></i>
            <i class="base base-2 ${game.bases[1] ? 'on' : ''}"></i>
            <i class="base base-3 ${game.bases[2] ? 'on' : ''}"></i>
          </div>
        </div>
      </div>
      <footer class="count-strip" aria-label="BSO">
        <div class="count-group"><b class="count-label">B</b><span class="count-lamps">${lampSet(game.balls, 3, 'ball')}</span></div>
        <div class="count-group"><b class="count-label">S</b><span class="count-lamps">${lampSet(game.strikes, 2, 'strike')}</span></div>
        <div class="count-group"><b class="count-label">O</b><span class="count-lamps">${lampSet(game.outs, 2, 'out')}</span></div>
      </footer>
    </section>`;
}

window.baseballAPI.onOverlayState(render);
window.baseballAPI.getState().then((state) => {
  const game = state.games.find((item) => item.id === state.activeGameId);
  render({ game: game?.published || game, settings: state.settings });
});
