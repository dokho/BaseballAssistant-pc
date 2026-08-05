const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const MAX_LOG_FILES = 14;

function logDirectory() {
  return path.join(app.getPath('userData'), 'logs');
}

function logFile() {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(logDirectory(), `baseball-assistant-${date}.log`);
}

function errorDetails(error) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

function safeDetails(details) {
  if (!details) return undefined;
  try {
    return JSON.parse(JSON.stringify(details, (_key, value) => {
      if (value instanceof Error) return errorDetails(value);
      if (typeof value === 'string') return value.slice(0, 8000);
      return value;
    }));
  } catch {
    return { message: String(details).slice(0, 8000) };
  }
}

function write(level, message, details) {
  try {
    fs.mkdirSync(logDirectory(), { recursive: true });
    const entry = {
      at: new Date().toISOString(),
      level,
      message,
      details: safeDetails(details)
    };
    fs.appendFileSync(logFile(), `${JSON.stringify(entry)}\n`, 'utf8');
  } catch {
    // Logging must never cause the application itself to fail.
  }
}

function cleanOldLogs() {
  try {
    const files = fs.readdirSync(logDirectory())
      .filter((file) => /^baseball-assistant-\d{4}-\d{2}-\d{2}\.log$/.test(file))
      .sort()
      .reverse();
    files.slice(MAX_LOG_FILES).forEach((file) => fs.rmSync(path.join(logDirectory(), file), { force: true }));
  } catch {
    // The directory will be created by the first write if it does not exist yet.
  }
}

function start() {
  cleanOldLogs();
  write('info', 'Application session started', {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron,
    chrome: process.versions.chrome
  });
}

module.exports = {
  start,
  write,
  error(scope, error, details = {}) {
    write('error', scope, { ...details, error: errorDetails(error) });
  },
  directory: logDirectory
};
