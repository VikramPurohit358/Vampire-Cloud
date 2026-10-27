'use strict';

const events = [];

function logEvent(level, message) {
  const e = { ts: Date.now(), level, message };
  events.push(e);
  if (events.length > 50) events.shift();
  process.stdout.write(`[${new Date(e.ts).toISOString()}] [${level.toUpperCase().padEnd(5)}] ${message}\n`);
}

function getEvents(n = 25) {
  return events.slice(-n).reverse();
}

module.exports = { logEvent, getEvents };
