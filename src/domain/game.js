const crypto = require('node:crypto');

const clone = (value) => JSON.parse(JSON.stringify(value));
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const PROFESSIONAL_RESULTS = new Set(['1B', '2B', '3B', 'HR', 'BB', 'HBP', 'K', 'OUT']);

function defaultProfessionalPlayers(side) {
  const positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
  const prefix = side === 'away' ? '客队' : '主队';
  return positions.map((position, index) => ({
    id: id(),
    number: String(index + 1),
    name: `${prefix}${index + 1}号`,
    position,
    bats: 'R',
    throws: 'R',
    active: true
  }));
}

function normalizeProfessionalPlayers(players, side) {
  return (Array.isArray(players) ? players : []).map((player, index) => ({
    id: player?.id || id(),
    number: String(player?.number ?? index + 1).slice(0, 8),
    name: String(player?.name || `${side === 'away' ? '客队' : '主队'}${index + 1}号`).trim().slice(0, 40),
    position: String(player?.position || '').trim().slice(0, 12),
    bats: player?.bats === 'L' ? 'L' : 'R',
    throws: player?.throws === 'L' ? 'L' : 'R',
    active: player?.active !== false
  }));
}

function createProfessionalState(game) {
  const lineup = (side) => {
    const players = game[side].players.filter((player) => player.active !== false);
    return {
      order: players.slice(0, 9).map((player) => player.id),
      currentBatterIndex: 0,
      pitcherId: players.find((player) => player.position === 'P')?.id || players[0]?.id || null
    };
  };
  return {
    lineups: { away: lineup('away'), home: lineup('home') },
    baseRunners: [null, null, null],
    plateAppearances: []
  };
}

function ensureProfessionalGame(game) {
  game.mode = game.mode === 'professional' ? 'professional' : 'basic';
  ['away', 'home'].forEach((side) => {
    game[side].players = normalizeProfessionalPlayers(game[side].players, side);
  });
  if (game.mode !== 'professional') return game;
  ['away', 'home'].forEach((side) => {
    if (!game[side].players.length) game[side].players = defaultProfessionalPlayers(side);
  });
  game.professional ||= createProfessionalState(game);
  game.professional.lineups ||= {};
  game.professional.baseRunners = Array.isArray(game.professional.baseRunners)
    ? game.professional.baseRunners.slice(0, 3).map((runner) => runner || null)
    : [null, null, null];
  game.professional.plateAppearances ||= [];
  ['away', 'home'].forEach((side) => {
    const available = game[side].players.filter((player) => player.active !== false).map((player) => player.id);
    const saved = game.professional.lineups[side] || {};
    const order = Array.isArray(saved.order) ? saved.order.filter((playerId) => available.includes(playerId)).slice(0, 9) : [];
    game.professional.lineups[side] = {
      order: order.length ? order : available.slice(0, 9),
      currentBatterIndex: Math.max(0, Number(saved.currentBatterIndex) || 0),
      pitcherId: available.includes(saved.pitcherId)
        ? saved.pitcherId
        : game[side].players.find((player) => player.position === 'P' && available.includes(player.id))?.id || available[0] || null
    };
    const size = game.professional.lineups[side].order.length;
    if (size) game.professional.lineups[side].currentBatterIndex %= size;
  });
  game.bases = game.professional.baseRunners.map(Boolean);
  return game;
}

function blankTeam(side) {
  return {
    id: id(),
    fullName: side === 'away' ? '客队' : '主队',
    shortName: side === 'away' ? 'AWAY' : 'HOME',
    logo: null,
    color: side === 'away' ? '#3b82f6' : '#ef4444',
    players: []
  };
}

function createGame(input = {}) {
  const createdAt = now();
  const game = {
    id: id(),
    title: input.title || `新比赛 ${new Date().toLocaleDateString('zh-CN')}`,
    mode: input.mode === 'professional' ? 'professional' : 'basic',
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
    redoStack: [],
    professional: null
  };
  if (game.mode === 'professional') {
    if (!game.away.players.length) game.away.players = defaultProfessionalPlayers('away');
    if (!game.home.players.length) game.home.players = defaultProfessionalPlayers('home');
    game.professional = createProfessionalState(game);
  }
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
    mode: game.mode,
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
    LOG_EVENT: action.label || '比赛事件', RECORD_PRO_PLATE_APPEARANCE: action.label || '专业打席记录', SET_PROFESSIONAL_ROSTER: '修改专业名单', SET_COUNT: '修正 BSO', SET_INNING: '修正局数',
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

function professionalPlayers(game, side) {
  return new Map(game[side].players.map((player) => [player.id, player]));
}

function setProfessionalRunners(game, runners) {
  game.professional.baseRunners = runners.map((runner) => runner || null);
  game.bases = game.professional.baseRunners.map(Boolean);
}

function professionalHit(game, bases, batterId) {
  const next = [null, null, null];
  const scored = [];
  game.professional.baseRunners.forEach((runnerId, index) => {
    if (!runnerId) return;
    const destination = index + bases;
    if (destination >= 3) scored.push(runnerId);
    else next[destination] = runnerId;
  });
  if (bases >= 4) scored.push(batterId);
  else next[bases - 1] = batterId;
  if (scored.length) addRuns(game, currentOffense(game), scored.length);
  setProfessionalRunners(game, next);
  game.balls = 0;
  game.strikes = 0;
  return scored;
}

function professionalWalk(game, batterId) {
  const [first, second, third] = game.professional.baseRunners;
  const scored = first && second && third ? [third] : [];
  const next = [batterId, first || second || null, first && second ? second : third || null];
  if (scored.length) addRuns(game, currentOffense(game), scored.length);
  setProfessionalRunners(game, next);
  game.balls = 0;
  game.strikes = 0;
  return scored;
}

function professionalOut(game) {
  game.balls = 0;
  game.strikes = 0;
  if (game.outs >= 2) {
    endHalf(game);
    setProfessionalRunners(game, [null, null, null]);
  } else {
    game.outs += 1;
  }
}

function recordProfessionalPlateAppearance(game, action) {
  ensureProfessionalGame(game);
  const result = PROFESSIONAL_RESULTS.has(action.result) ? action.result : 'OUT';
  const offense = currentOffense(game);
  const defense = offense === 'away' ? 'home' : 'away';
  const lineup = game.professional.lineups[offense];
  const availableBatters = professionalPlayers(game, offense);
  const availablePitchers = professionalPlayers(game, defense);
  const batterId = availableBatters.has(action.batterId) ? action.batterId : lineup.order[lineup.currentBatterIndex];
  const pitcherId = availablePitchers.has(action.pitcherId) ? action.pitcherId : game.professional.lineups[defense].pitcherId;
  const before = {
    inning: game.currentInning,
    half: game.half,
    balls: game.balls,
    strikes: game.strikes,
    outs: game.outs,
    bases: [...game.professional.baseRunners]
  };
  let scored = [];
  if (result === '1B') scored = professionalHit(game, 1, batterId);
  if (result === '2B') scored = professionalHit(game, 2, batterId);
  if (result === '3B') scored = professionalHit(game, 3, batterId);
  if (result === 'HR') scored = professionalHit(game, 4, batterId);
  if (result === 'BB' || result === 'HBP') scored = professionalWalk(game, batterId);
  if (result === 'K' || result === 'OUT') professionalOut(game);

  const rbi = ['1B', '2B', '3B', 'HR'].includes(result) ? scored.length : (result === 'BB' || result === 'HBP' ? scored.length : 0);
  const plateAppearance = {
    id: id(),
    at: now(),
    inning: before.inning || game.currentInning,
    half: before.half || (offense === 'away' ? 'top' : 'bottom'),
    offense,
    batterId,
    pitcherId,
    result,
    rbi,
    scoredRunnerIds: scored,
    before,
    after: {
      balls: game.balls,
      strikes: game.strikes,
      outs: game.outs,
      bases: [...game.professional.baseRunners]
    }
  };
  game.professional.plateAppearances.push(plateAppearance);
  if (game.professional.plateAppearances.length > 5000) game.professional.plateAppearances.shift();
  if (lineup.order.length) lineup.currentBatterIndex = (lineup.currentBatterIndex + 1) % lineup.order.length;
  return plateAppearance;
}

function buildProfessionalStats(game) {
  if (game.mode !== 'professional') return null;
  ensureProfessionalGame(game);
  const teamStats = (side) => {
    const batting = new Map(game[side].players.map((player) => [player.id, {
      player,
      pa: 0, ab: 0, r: 0, h: 0, rbi: 0, bb: 0, so: 0, hbp: 0, doubles: 0, triples: 0, hr: 0
    }]));
    const pitching = new Map(game[side].players.map((player) => [player.id, {
      player,
      outs: 0, h: 0, r: 0, er: 0, bb: 0, so: 0, hr: 0
    }]));
    return { batting, pitching };
  };
  const away = teamStats('away');
  const home = teamStats('home');
  game.professional.plateAppearances.forEach((event) => {
    const batting = event.offense === 'away' ? away.batting : home.batting;
    const pitching = event.offense === 'away' ? home.pitching : away.pitching;
    const batter = batting.get(event.batterId);
    const pitcher = pitching.get(event.pitcherId);
    if (batter) {
      batter.pa += 1;
      batter.rbi += Number(event.rbi) || 0;
      if (['1B', '2B', '3B', 'HR', 'K', 'OUT'].includes(event.result)) batter.ab += 1;
      if (['1B', '2B', '3B', 'HR'].includes(event.result)) batter.h += 1;
      if (event.result === '2B') batter.doubles += 1;
      if (event.result === '3B') batter.triples += 1;
      if (event.result === 'HR') batter.hr += 1;
      if (event.result === 'BB') batter.bb += 1;
      if (event.result === 'HBP') batter.hbp += 1;
      if (event.result === 'K') batter.so += 1;
    }
    if (pitcher) {
      if (['1B', '2B', '3B', 'HR'].includes(event.result)) pitcher.h += 1;
      if (event.result === 'BB') pitcher.bb += 1;
      if (event.result === 'K') pitcher.so += 1;
      if (event.result === 'HR') pitcher.hr += 1;
      if (event.result === 'K' || event.result === 'OUT') pitcher.outs += 1;
      event.scoredRunnerIds.forEach(() => { pitcher.r += 1; pitcher.er += 1; });
    }
    event.scoredRunnerIds.forEach((runnerId) => {
      const runner = batting.get(runnerId);
      if (runner) runner.r += 1;
    });
  });
  const formatPitcher = (item) => ({ ...item, ip: `${Math.floor(item.outs / 3)}.${item.outs % 3}` });
  const summarize = (side, values) => ({
    batting: [...values.batting.values()],
    pitching: [...values.pitching.values()].map(formatPitcher),
    totals: {
      runs: totals(game)[side],
      hits: [...values.batting.values()].reduce((sum, item) => sum + item.h, 0),
      rbi: [...values.batting.values()].reduce((sum, item) => sum + item.rbi, 0)
    }
  });
  return { away: summarize('away', away), home: summarize('home', home) };
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
    case 'RECORD_PRO_PLATE_APPEARANCE':
      if (game.mode === 'professional') recordProfessionalPlateAppearance(game, action);
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
    case 'SET_PROFESSIONAL_ROSTER':
      if (game.mode === 'professional' && ['away', 'home'].includes(action.side)) {
        game[action.side].players = normalizeProfessionalPlayers(action.players, action.side);
        ensureProfessionalGame(game);
      }
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

module.exports = { createGame, reduceGame, totals, viewOf, currentOffense, clone, ensureProfessionalGame, buildProfessionalStats };
