const test = require('node:test');
const assert = require('node:assert/strict');
const { createGame, reduceGame, totals, buildProfessionalStats } = require('../src/domain/game');

test('四坏保送会处理强迫进垒和满垒得分', () => {
  const game = createGame();
  game.bases = [true, true, true];
  game.balls = 3;
  reduceGame(game, { type: 'WALK' });
  assert.deepEqual(game.bases, [true, true, true]);
  assert.equal(totals(game).away, 1);
  assert.equal(game.balls, 0);
  assert.equal(game.strikes, 0);
});

test('第三个出局自动从上半局切换到下半局并清垒', () => {
  const game = createGame();
  game.outs = 2;
  game.bases = [true, false, true];
  reduceGame(game, { type: 'OUT' });
  assert.equal(game.currentInning, 1);
  assert.equal(game.half, 'bottom');
  assert.equal(game.outs, 0);
  assert.deepEqual(game.bases, [false, false, false]);
});

test('下半局结束后进入下一局上半局', () => {
  const game = createGame();
  game.half = 'bottom';
  game.outs = 2;
  reduceGame(game, { type: 'OUT' });
  assert.equal(game.currentInning, 2);
  assert.equal(game.half, 'top');
  assert.ok(game.innings.some((inning) => inning.number === 2));
});

test('本垒打计算所有垒上跑者与打者得分', () => {
  const game = createGame();
  game.bases = [true, false, true];
  reduceGame(game, { type: 'APPLY_HIT', bases: 4, label: '本垒打' });
  assert.equal(totals(game).away, 3);
  assert.deepEqual(game.bases, [false, false, false]);
});

test('暂停同步时直播状态保持，发布后才更新', () => {
  const game = createGame();
  reduceGame(game, { type: 'PAUSE_SYNC' });
  reduceGame(game, { type: 'ADJUST_RUN', side: 'away', delta: 1 });
  assert.equal(game.published.score.away, 0);
  reduceGame(game, { type: 'PUBLISH' });
  assert.equal(game.published.score.away, 1);
});

test('撤销会恢复比分', () => {
  const game = createGame();
  reduceGame(game, { type: 'ADJUST_RUN', side: 'home', delta: 1 });
  assert.equal(totals(game).home, 1);
  reduceGame(game, { type: 'UNDO' });
  assert.equal(totals(game).home, 0);
});

test('专业模式逐打席记录会更新跑垒、比分与打击投手统计', () => {
  const game = createGame({ mode: 'professional' });
  const firstBatter = game.professional.lineups.away.order[0];
  const secondBatter = game.professional.lineups.away.order[1];
  reduceGame(game, { type: 'RECORD_PRO_PLATE_APPEARANCE', result: '1B' });
  assert.equal(game.professional.baseRunners[0], firstBatter);
  reduceGame(game, { type: 'RECORD_PRO_PLATE_APPEARANCE', result: 'HR' });
  assert.equal(totals(game).away, 2);
  const stats = buildProfessionalStats(game);
  const leadOff = stats.away.batting.find((item) => item.player.id === firstBatter);
  const slugger = stats.away.batting.find((item) => item.player.id === secondBatter);
  assert.deepEqual({ ab: leadOff.ab, h: leadOff.h, r: leadOff.r }, { ab: 1, h: 1, r: 1 });
  assert.deepEqual({ h: slugger.h, hr: slugger.hr, rbi: slugger.rbi, r: slugger.r }, { h: 1, hr: 1, rbi: 2, r: 1 });
  assert.deepEqual(game.professional.baseRunners, [null, null, null]);
});

test('专业模式第三个出局会保存打席局面并清空跑垒员', () => {
  const game = createGame({ mode: 'professional' });
  game.outs = 2;
  game.professional.baseRunners = [game.professional.lineups.away.order[0], null, null];
  game.bases = [true, false, false];
  reduceGame(game, { type: 'RECORD_PRO_PLATE_APPEARANCE', result: 'OUT' });
  const event = game.professional.plateAppearances[0];
  assert.deepEqual({ inning: event.inning, half: event.half, outs: event.before.outs }, { inning: 1, half: 'top', outs: 2 });
  assert.equal(game.half, 'bottom');
  assert.deepEqual(game.professional.baseRunners, [null, null, null]);
});
