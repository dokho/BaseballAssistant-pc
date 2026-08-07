const fs = require('node:fs');
const path = require('node:path');
const { createGame } = require('./domain/game');

const DEFAULT_SETTINGS = {
  overlayMode: 'green',
  overlayTheme: 'default',
  overlayAlwaysOnTop: true,
  clickThrough: false,
  overlayBackgroundColor: '#2857a6',
  awayTeamBackgroundColor: '#3d43c6',
  homeTeamBackgroundColor: '#19b5e5',
  overlayTitle: ''
};

class LocalStore {
  constructor(userDataPath) {
    this.file = path.join(userDataPath, 'baseball-assistant-data.json');
    this.data = this.load();
  }

  load() {
    try {
      const value = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (Array.isArray(value.games)) return value;
    } catch (_) {}
    const game = createGame();
    return {
      schemaVersion: 1,
      activeGameId: game.id,
      settings: { ...DEFAULT_SETTINGS },
      games: [game]
    };
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(this.data, null, 2), 'utf8');
    fs.renameSync(temp, this.file);
  }

  activeGame() {
    return this.data.games.find((game) => game.id === this.data.activeGameId) || this.data.games[0];
  }
}

module.exports = { LocalStore, DEFAULT_SETTINGS };
