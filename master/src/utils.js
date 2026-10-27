'use strict';

const { WebSocket } = require('ws');

const isOpen = (ws) => !!ws && ws.readyState === WebSocket.OPEN;
const shortId = (id) => (id ? String(id).slice(0, 8) : '--------');
const label = (node) => (node ? `${node.name || 'node'} [${shortId(node.id)}]` : 'unknown');

function send(ws, obj) {
  if (!isOpen(ws)) return false;
  try {
    ws.send(JSON.stringify(obj));
    return true;
  } catch {
    return false;
  }
}

function liveWorkerCount(nodes) {
  if (!nodes || typeof nodes.values !== 'function') return 0;
  let n = 0;
  for (const node of nodes.values()) {
    if (node && isOpen(node.ws)) n++;
  }
  return n;
}

module.exports = { isOpen, shortId, label, send, liveWorkerCount };
