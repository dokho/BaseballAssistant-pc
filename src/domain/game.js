const crypto = require('node:crypto');

const clone = (value) => JSON.parse(JSON.stringify(value));
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();

function blankTeam(side) {
  return {
    id: id(),
    fullName: side === 'away' ? '客队' : '主队',
    shortName: side === 'away' ? 'AWAY' : 'HOME',
    logo: null,
    color: side === 'away' ? '#3b82f6' : '#ef4444'
  };
}

function createGame(input = {}) {
  const createdAt = now();
  const game = {
    id: id(),
    title: input.title || `新比赛 ${new Date().toLocaleDateString('zh-CN')}`,
    status: 'live',
    scheduledInnings: Number(input.scheduledInnings) || 9,
    away: input.away ? { ...blankTeam('away'), ...input.away } : blankTeam('away'),
    home: input.home ? { ...blankTeam('home'), ...input.home } : blankTeam('home'),
    currentInning: 1,
    half: 'top',
    balls: 0,
    strikes: 0,
    outs: 0,
    bases: [false, false, false],
    innings: [{ number: 1, away: 0, home: 0 }],
    events: [],
    createdAt,
    updatedAt: createdAt,
    syncPaused: false,
    published: null,
    undoStack: [],
    redoStack: []
  };
  game.published = viewOf(game);
  return game;
}

function currentOffense(game) {
  return game.half === 'top' ? 'away' : 'home';
}

function ensureInning(game, number = game.currentInning) {
  let inning = game.innings.find((item) => item.number === number);
  if (!inning) {
    inning = { number, away: 0, home: 0 };
    game.innings.push(inning);
    game.innings.sort((a, b) => a.number - b.number);
  }
  return inning;
}

function totals(game) {
  return game.innings.reduce(
    (sum, inning) => ({ away: sum.away + inning.away, home: sum.home + inning.home }),
    { away: 0, home: 0 }
  );
}

function viewOf(game) {
  const score = totals(game);
  return {
    id: game.id,
    title: game.title,
    away: clone(game.away),
    home: clone(game.home),
    score,
    currentInning: game.currentInning,
    half: game.half,
    balls: game.balls,
    strikes: game.strikes,
    outs: game.outs,
    bases: [...game.bases],
    innings: clone(game.innings),
    scheduledInnings: game.scheduledInnings,
    status: game.status,
    updatedAt: game.updatedAt
  };
}

function snapshot(game) {
  const copy = clone(game);
  delete copy.undoStack;
  delete copy.redoStack;
  delete copy.published;
  return copy;
}

function restoreSnapshot(game, saved) {
  const undoStack = game.undoStack;
  const redoStack = game.redoStack;
  const published = game.published;
  Object.keys(game).forEach((key) => delete game[key]);
  Object.assign(game, clone(saved), { undoStack, redoStack, published });
}

function describe(action, game) {
  const side = action.side === 'home' ? game.home.shortName : game.away.shortName;
  const labels = {
    BALL: '坏球', STRIKE: '好球', FOUL: '界外球', STRIKEOUT: '三振出局',
    WALK: '四坏保送', OUT: '出局', END_HALF: '半局结束', SET_BASE: '调整垒包',
    CLEAR_BASES: '清空垒包', ADJUST_RUN: `${side} 调整得分`, APPLY_HIT: action.label || '安打',
    LOG_EVENT: action.label || '比赛事件', SET_COUNT: '修正 BSO', SET_INNING: '修正局数',
    SET_TEAM: '修改球队资料', SET_TITLE: '修改比赛名称', SET_STATUS: '修改比赛状态'
  };
  return labels[action.type] || '比赛数据调整';
}

function addRuns(game, side, delta) {
  const inning = ensureInning(game);
  inning[side] = Math.max(0, inning[side] + delta);
}

function applyWalk(game) {
  const [first, second, third] = game.bases;
  if (first && second && third) addRuns(game, currentOffense(game), 1);
  game.bases = [true, first || second, (first && second) || third];
  game.balls = 0;
  game.strikes = 0;
}

function advanceForHit(game, bases) {
  const next = [false, false, false];
  let runs = 0;
  game.bases.forEach((occupied, index) => {
    if (!occupied) return;
    const destination = index + bases;
    if (destination >= 3) runs += 1;
    else next[destination] = true;
  });
  if (bases >= 4) runs += 1;
  else next[bases - 1] = true;
  if (runs) addRuns(game, currentOffense(game), runs);
  game.bases = next;
  game.balls = 0;
  game.strikes = 0;
}

function endHalf(game) {
  game.balls = 0;
  game.strikes = 0;
  game.outs = 0;
  game.bases = [false, false, false];
  if (game.half === 'top') {
    game.half = 'bottom';
  } else {
    game.half = 'top';
    game.currentInning += 1;
    ensureInning(game);
  }
}

function reduceGame(game, action, options = {}) {
  const eventPosition = { inning: game.currentInning, half: game.half };
  const mutating = !['UNDO', 'REDO', 'PUBLISH', 'PAUSE_SYNC', 'DISCARD_DRAFT'].includes(action.type);
  if (mutating) {
    game.undoStack.push(snapshot(game));
    if (game.undoStack.length > 100) game.undoStack.shift();
    game.redoStack = [];
  }

  switch (action.type) {
    case 'BALL':
      game.balls = Math.min(3, game.balls + 1);
      break;
    case 'STRIKE':
      game.strikes = Math.min(2, game.strikes + 1);
      break;
    case 'FOUL':
      if (game.strikes < 2) game.strikes += 1;
      break;
    case 'STRIKEOUT':
      game.balls = 0;
      game.strikes = 0;
      if (game.outs >= 2) endHalf(game);
      else game.outs += 1;
      break;
    case 'WALK':
      applyWalk(game);
      break;
    case 'OUT':
      game.balls = 0;
      game.strikes = 0;
      if (game.outs >= 2 && action.advanceHalf !== false) endHalf(game);
      else game.outs = Math.min(2, game.outs + 1);
      break;
    case 'END_HALF':
      endHalf(game);
      break;
    case 'SET_BASE':
      game.bases[action.index] = Boolean(action.value);
      break;
    case 'CLEAR_BASES':
      game.bases = [false, false, false];
      break;
    case 'ADJUST_RUN':
      addRuns(game, action.side, Number(action.delta) || 0);
      break;
    case 'APPLY_HIT':
      advanceForHit(game, Number(action.bases));
      break;
    case 'LOG_EVENT':
      break;
    case 'SET_COUNT':
      if (action.field === 'balls') game.balls = Math.max(0, Math.min(3, Number(action.value)));
      if (action.field === 'strikes') game.strikes = Math.max(0, Math.min(2, Number(action.value)));
      if (action.field === 'outs') game.outs = Math.max(0, Math.min(2, Number(action.value)));
      break;
    case 'SET_INNING':
      game.currentInning = Math.max(1, Number(action.inning) || 1);
      game.half = action.half === 'bottom' ? 'bottom' : 'top';
      ensureInning(game);
      break;
    case 'SET_TEAM':
      game[action.side] = { ...game[action.side], ...action.team };
      break;
    case 'SET_TITLE':
      game.title = String(action.title || game.title).trim() || game.title;
      break;
    case 'SET_SCHEDULED_INNINGS':
      game.scheduledInnings = Math.max(1, Math.min(99, Number(action.value) || 9));
      break;
    case 'SET_STATUS':
      game.status = action.status === 'finished' ? 'finished' : 'live';
      break;
    case 'PAUSE_SYNC':
      game.syncPaused = true;
      break;
    case 'PUBLISH':
      game.syncPaused = false;
      game.published = viewOf(game);
      break;
    case 'DISCARD_DRAFT': {
      if (!game.published) break;
      const live = clone(game.published);
      game.away = live.away;
      game.home = live.home;
      game.currentInning = live.currentInning;
      game.half = live.half;
      game.balls = live.balls;
      game.strikes = live.strikes;
      game.outs = live.outs;
      game.bases = live.bases;
      game.innings = live.innings;
      game.scheduledInnings = live.scheduledInnings;
      game.status = live.status;
      game.syncPaused = false;
      break;
    }
    case 'UNDO': {
      const saved = game.undoStack.pop();
      if (!saved) return game;
      game.redoStack.push(snapshot(game));
      restoreSnapshot(game, saved);
      break;
    }
    case 'REDO': {
      const saved = game.redoStack.pop();
      if (!saved) return game;
      game.undoStack.push(snapshot(game));
      restoreSnapshot(game, saved);
      break;
    }
    default:
      return game;
  }

  game.updatedAt = now();
  if (mutating) {
    game.events.unshift({
      id: id(),
      at: game.updatedAt,
      inning: eventPosition.inning,
      half: eventPosition.half,
      label: options.label || describe(action, game)
    });
    if (game.events.length > 500) game.events.length = 500;
  }
  if (!game.syncPaused && !['UNDO', 'REDO'].includes(action.type)) game.published = viewOf(game);
  if (!game.syncPaused && ['UNDO', 'REDO'].includes(action.type)) game.published = viewOf(game);
  return game;
}

module.exports = { createGame, reduceGame, totals, viewOf, currentOffense, clone };
