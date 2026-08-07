const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const logger = require('./logger');
const { LocalStore, DEFAULT_SETTINGS } = require('./storage');
const { createGame, reduceGame, viewOf, clone } = require('./domain/game');
const { isTheme, normalizeTheme, getOverlayPresentation } = require('./renderer/theme');

let controllerWindow;
let overlayWindow;
let store;
let controllerCloseApproved = false;

app.setName('棒球比赛助手电脑版');

let fatalErrorHandled = false;

process.on('uncaughtException', (error) => {
  logger.error('Unhandled main-process exception', error);
  if (fatalErrorHandled) return;
  fatalErrorHandled = true;
  if (app.isReady()) {
    dialog.showErrorBox('程序发生错误', '程序需要关闭。重启后可在“打开诊断日志”中找到日志文件并提供给技术支持。');
  }
  setTimeout(() => app.exit(1), 50).unref();
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled main-process promise rejection', reason);
});

app.on('render-process-gone', (_event, webContents, details) => {
  logger.write('error', 'Renderer process gone', { window: webContents.getTitle(), details });
});

app.on('child-process-gone', (_event, details) => {
  logger.write('error', 'Child process gone', details);
});

function createControllerWindow() {
  controllerCloseApproved = false;
  controllerWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 720,
    backgroundColor: '#07111f',
    title: '棒球比赛助手电脑版',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  controllerWindow.loadFile(path.join(__dirname, 'renderer', 'controller.html'));
  controllerWindow.on('close', async (event) => {
    if (controllerCloseApproved) return;
    event.preventDefault();
    const result = await dialog.showMessageBox(controllerWindow, {
      type: 'question',
      buttons: ['关闭记录端和比分牌', '取消'],
      defaultId: 1,
      cancelId: 1,
      title: '确认关闭程序',
      message: '确定关闭记录端吗？',
      detail: '关闭记录端会同时关闭直播比分牌窗口。'
    });
    if (result.response !== 0) {
      logger.write('info', 'Controller close cancelled by user');
      return;
    }
    controllerCloseApproved = true;
    logger.write('info', 'Controller close confirmed by user');
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.close();
    if (controllerWindow && !controllerWindow.isDestroyed()) controllerWindow.close();
  });
  controllerWindow.on('closed', () => { controllerWindow = null; });
}

function createOverlayWindow() {
  const settings = store.data.settings;
  const presentation = getOverlayPresentation(settings.overlayTheme);
  overlayWindow = new BrowserWindow({
    width: presentation.width,
    height: presentation.height,
    minWidth: presentation.minWidth,
    minHeight: presentation.minHeight,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: true,
    alwaysOnTop: settings.overlayAlwaysOnTop !== false,
    skipTaskbar: false,
    show: false,
    title: '棒球比分牌输出',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  overlayWindow.setAspectRatio(presentation.width / presentation.height);
  overlayWindow.setIgnoreMouseEvents(Boolean(settings.clickThrough), { forward: true });
  overlayWindow.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));
  overlayWindow.once('ready-to-show', () => {
    overlayWindow.showInactive();
    sendOverlayState();
  });
  overlayWindow.on('closed', () => { overlayWindow = null; });
}

function applyOverlayPresentation() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const presentation = getOverlayPresentation(store.data.settings.overlayTheme);
  overlayWindow.setMinimumSize(presentation.minWidth, presentation.minHeight);
  overlayWindow.setAspectRatio(presentation.width / presentation.height);
  overlayWindow.setBounds({ width: presentation.width, height: presentation.height });
}

function stateForRenderer() {
  return {
    activeGameId: store.data.activeGameId,
    settings: clone(store.data.settings),
    games: store.data.games.map((game) => ({
      ...clone(game),
      score: game.innings.reduce((sum, inning) => ({
        away: sum.away + inning.away,
        home: sum.home + inning.home
      }), { away: 0, home: 0 })
    }))
  };
}

function sendOverlayState() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const game = store.activeGame();
  overlayWindow.webContents.send('overlay:state', {
    game: game ? (game.published || viewOf(game)) : null,
    settings: store.data.settings
  });
}

function broadcast() {
  const state = stateForRenderer();
  if (controllerWindow && !controllerWindow.isDestroyed()) {
    controllerWindow.webContents.send('app:state', state);
  }
  sendOverlayState();
}

function persistAndBroadcast() {
  store.save();
  broadcast();
}

function hydrateGame(game) {
  game.undoStack ||= [];
  game.redoStack ||= [];
  game.events ||= [];
  game.innings ||= [{ number: 1, away: 0, home: 0 }];
  game.bases ||= [false, false, false];
  game.published ||= viewOf(game);
  return game;
}

function registerIpc() {
  const handle = (channel, handler) => ipcMain.handle(channel, async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      logger.error(`IPC handler failed: ${channel}`, error);
      throw error;
    }
  });

  ipcMain.on('diagnostics:renderer-error', (_event, payload = {}) => {
    logger.write('error', 'Renderer error', {
      kind: String(payload.kind || 'unknown').slice(0, 80),
      message: String(payload.message || '').slice(0, 8000),
      filename: String(payload.filename || '').slice(0, 1000),
      line: Number(payload.line) || undefined,
      column: Number(payload.column) || undefined,
      stack: typeof payload.stack === 'string' ? payload.stack.slice(0, 8000) : undefined
    });
  });

  handle('app:get-state', () => stateForRenderer());

  handle('game:dispatch', (_event, action) => {
    const game = store.activeGame();
    if (!game) return stateForRenderer();
    reduceGame(game, action);
    persistAndBroadcast();
    return stateForRenderer();
  });

  handle('game:new', (_event, input) => {
    const game = createGame(input || {});
    store.data.games.unshift(game);
    store.data.activeGameId = game.id;
    persistAndBroadcast();
    return stateForRenderer();
  });

  handle('game:activate', (_event, gameId) => {
    if (store.data.games.some((game) => game.id === gameId)) {
      store.data.activeGameId = gameId;
      persistAndBroadcast();
    }
    return stateForRenderer();
  });

  handle('game:duplicate', (_event, gameId) => {
    const source = store.data.games.find((game) => game.id === gameId);
    if (!source) return stateForRenderer();
    const game = createGame({
      title: `${source.title}（副本）`,
      scheduledInnings: source.scheduledInnings,
      away: clone(source.away),
      home: clone(source.home)
    });
    store.data.games.unshift(game);
    store.data.activeGameId = game.id;
    persistAndBroadcast();
    return stateForRenderer();
  });

  handle('game:delete', (_event, gameId) => {
    if (store.data.games.length <= 1) return { ok: false, message: '至少保留一场比赛。' };
    store.data.games = store.data.games.filter((game) => game.id !== gameId);
    if (store.data.activeGameId === gameId) store.data.activeGameId = store.data.games[0].id;
    persistAndBroadcast();
    return { ok: true, state: stateForRenderer() };
  });

  handle('data:export', async () => {
    const result = await dialog.showSaveDialog(controllerWindow, {
      title: '导出比赛数据备份',
      defaultPath: `棒球比赛助手备份-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON 备份', extensions: ['json'] }]
    });
    if (result.canceled || !result.filePath) return { ok: false };
    fs.writeFileSync(result.filePath, JSON.stringify(store.data, null, 2), 'utf8');
    return { ok: true, filePath: result.filePath };
  });

  handle('data:import', async () => {
    const result = await dialog.showOpenDialog(controllerWindow, {
      title: '导入比赛数据备份',
      properties: ['openFile'],
      filters: [{ name: 'JSON 备份', extensions: ['json'] }]
    });
    if (result.canceled || !result.filePaths[0]) return { ok: false };
    try {
      const imported = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'));
      if (!Array.isArray(imported.games) || !imported.games.length) throw new Error('备份中没有比赛数据');
      imported.games.forEach(hydrateGame);
      store.data = imported;
      if (!store.activeGame()) store.data.activeGameId = store.data.games[0].id;
      persistAndBroadcast();
      return { ok: true };
    } catch (error) {
      return { ok: false, message: `无法导入：${error.message}` };
    }
  });

  handle('overlay:command', (_event, command) => {
    if (!overlayWindow || overlayWindow.isDestroyed()) createOverlayWindow();
    if (command.type === 'show') overlayWindow.showInactive();
    if (command.type === 'focus') { overlayWindow.setIgnoreMouseEvents(false); overlayWindow.show(); overlayWindow.focus(); }
    if (command.type === 'reset-size') applyOverlayPresentation();
    if (command.type === 'mode') store.data.settings.overlayMode = command.value;
    if (command.type === 'settings') {
      const next = command.value || {};
      const validColor = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
      if (validColor(next.overlayBackgroundColor)) store.data.settings.overlayBackgroundColor = next.overlayBackgroundColor;
      const themeChanged = isTheme(next.overlayTheme) && next.overlayTheme !== store.data.settings.overlayTheme;
      if (themeChanged) store.data.settings.overlayTheme = next.overlayTheme;
      if (validColor(next.awayTeamBackgroundColor)) store.data.settings.awayTeamBackgroundColor = next.awayTeamBackgroundColor;
      if (validColor(next.homeTeamBackgroundColor)) store.data.settings.homeTeamBackgroundColor = next.homeTeamBackgroundColor;
      if (typeof next.overlayTitle === 'string') store.data.settings.overlayTitle = next.overlayTitle.slice(0, 60);
      if (themeChanged) applyOverlayPresentation();
    }
    if (command.type === 'always-on-top') {
      store.data.settings.overlayAlwaysOnTop = Boolean(command.value);
      overlayWindow.setAlwaysOnTop(Boolean(command.value));
    }
    if (command.type === 'click-through') {
      store.data.settings.clickThrough = Boolean(command.value);
      overlayWindow.setIgnoreMouseEvents(Boolean(command.value), { forward: true });
    }
    store.save();
    broadcast();
    return stateForRenderer();
  });

  handle('system:open-data-folder', () => shell.openPath(path.dirname(store.file)));
  handle('system:open-log-folder', () => {
    fs.mkdirSync(logger.directory(), { recursive: true });
    logger.write('info', 'Diagnostic log folder opened');
    return shell.openPath(logger.directory());
  });
}

app.whenReady().then(() => {
  logger.start();
  store = new LocalStore(app.getPath('userData'));
  store.data.settings = { ...DEFAULT_SETTINGS, ...(store.data.settings || {}) };
  store.data.settings.overlayTheme = normalizeTheme(store.data.settings.overlayTheme);
  store.data.games.forEach(hydrateGame);
  registerIpc();
  createControllerWindow();
  createOverlayWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createControllerWindow();
      createOverlayWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => logger.write('info', 'Application session ended'));
