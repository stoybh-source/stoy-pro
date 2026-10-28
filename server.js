// Stoy server: static files + WebSocket (chat + WebRTC signaling)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const MAX_USERS = 10;
const PASSWORD = process.env.ROOM_PASSWORD || '1234';
const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/health') { res.writeHead(200); return res.end('ok'); }
  const file = path.join(PUBLIC, path.normalize(url === '/' ? '/index.html' : url));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });
const users = new Map(); // name -> ws
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
if (process.env.TURN_URL) {
  ICE_SERVERS.push({
    urls: process.env.TURN_URL.split(',').map((u) => u.trim()),
    username: process.env.TURN_USER,
    credential: process.env.TURN_PASS,
  });
}

function loadHistory() {
  try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')).slice(-100); } catch { return []; }
}
function saveNow() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(HISTORY_FILE + '.tmp', JSON.stringify(history));
    fs.renameSync(HISTORY_FILE + '.tmp', HISTORY_FILE);
  } catch (e) { console.error('Could not save history:', e.message); }
}
let saveTimer = null;
const saveHistory = () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 500); };
['SIGTERM', 'SIGINT'].forEach((sig) => process.on(sig, () => { saveNow(); process.exit(0); }));

const history = loadHistory(); // last 100 public messages, persisted to DATA_DIR

const send = (ws, msg) => ws.readyState === 1 && ws.send(JSON.stringify(msg));
const broadcast = (msg) => users.forEach((ws) => send(ws, msg));
const sendUsers = () => broadcast({ type: 'users', users: [...users.keys()] });

wss.on('connection', (ws) => {
  let name = null;
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }

    if (m.type === 'join') {
      const n = String(m.name || '').trim().slice(0, 20);
      if (name) return;
      if (!n) return send(ws, { type: 'error', text: 'اكتب اسماً صحيحاً' });
      if (m.password !== PASSWORD) return send(ws, { type: 'error', text: 'كلمة السر غير صحيحة' });
      if (users.has(n)) return send(ws, { type: 'error', text: 'الاسم مستخدم بالفعل' });
      if (users.size >= MAX_USERS) return send(ws, { type: 'error', text: 'الغرفة ممتلئة (الحد 10)' });
      name = n;
      users.set(name, ws);
      send(ws, { type: 'joined', name, history, iceServers: ICE_SERVERS });
      sendUsers();
      return;
    }
    if (!name) return;

    if (m.type === 'chat') {
      const text = String(m.text || '').slice(0, 2000);
      if (!text) return;
      const msg = { type: 'chat', from: name, text, time: Date.now() };
      history.push(msg);
      if (history.length > 100) history.shift();
      saveHistory();
      broadcast(msg);
    } else if (m.type === 'dm') {
      const text = String(m.text || '').slice(0, 2000);
      const target = users.get(m.to);
      if (!text || !target) return;
      const msg = { type: 'dm', from: name, to: m.to, text, time: Date.now() };
      send(target, msg);
      send(ws, msg);
    } else if (m.type === 'signal') {
      const target = users.get(m.to);
      if (target) send(target, { type: 'signal', from: name, data: m.data });
    }
  });

  ws.on('close', () => {
    if (name && users.get(name) === ws) { users.delete(name); sendUsers(); }
  });
});

// Drop dead connections
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

server.listen(PORT, () => console.log(`Stoy running on http://localhost:${PORT}`));
