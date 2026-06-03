import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '..', 'dist');

// ─── MIME 类型映射 ─────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.stl': 'model/stl',
  '.dae': 'model/vnd.collada+xml',
  '.obj': 'model/obj',
};

// ─── 静态文件服务 ──────────────────────────────────────────────────────
function serveStatic(res, filePath) {
  try {
    const stat = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(filePath).pipe(res);
  } catch {
    return false;
  }
  return true;
}

function serveIndex(res) {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(indexPath).pipe(res);
    return true;
  }
  return false;
}

const PORT = parseInt(process.env.PORT || '8091', 10);

// ─── In-memory state ────────────────────────────────────────────────
const joints = {};
const model = { name: '', jointCount: 0, linkCount: 0 };
const wsClients = new Set();

// ─── Broadcast to all connected WebSocket clients ────────────────────
function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const ws of wsClients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

// ─── JSON helpers ────────────────────────────────────────────────────
function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve(null);
      }
    });
  });
}

// ─── HTTP server (REST API) ──────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const urlPath = url.pathname;

  // GET /v1/viewer/joints
  if (req.method === 'GET' && urlPath === '/v1/viewer/joints') {
    return sendJSON(res, 200, joints);
  }

  // POST /v1/viewer/joints
  if (req.method === 'POST' && urlPath === '/v1/viewer/joints') {
    const body = await readBody(req);
    if (!body || typeof body !== 'object') {
      return sendJSON(res, 400, { error: 'invalid body' });
    }
    // Merge new angles into stored state
    Object.assign(joints, body);
    // Broadcast to all WebSocket clients
    broadcast(joints);
    return sendJSON(res, 200, joints);
  }

  // GET /v1/viewer/model
  if (req.method === 'GET' && urlPath === '/v1/viewer/model') {
    return sendJSON(res, 200, model);
  }

  // POST /v1/viewer/model
  if (req.method === 'POST' && urlPath === '/v1/viewer/model') {
    const body = await readBody(req);
    if (body && typeof body === 'object') {
      Object.assign(model, body);
    }
    return sendJSON(res, 200, model);
  }

  // ── Static files + SPA fallback (GET only) ──────────────────────
  if (req.method === 'GET') {
    const filePath = path.join(DIST_DIR, urlPath === '/' ? 'index.html' : urlPath);
    if (serveStatic(res, filePath)) return;
    // SPA fallback: serve index.html for client-side routing
    if (serveIndex(res)) return;
  }

  // 404
  sendJSON(res, 404, { error: 'not found' });
});

// ─── WebSocket server at /ws/viewer ──────────────────────────────────
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://localhost:${PORT}`);
  if (url.pathname === '/ws/viewer') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws) => {
  wsClients.add(ws);
  // Send current state immediately on connect
  ws.send(JSON.stringify(joints));

  ws.on('close', () => wsClients.delete(ws));
  ws.on('error', () => wsClients.delete(ws));
});

// ─── Start ───────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Robot backend running on http://0.0.0.0:${PORT}`);
  console.log(`  REST API: /v1/viewer/joints`);
  console.log(`  WebSocket: ws://0.0.0.0:${PORT}/ws/viewer`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Kill the existing process and retry.`);
  } else {
    console.error('Server error:', err.message);
  }
  process.exit(1);
});
