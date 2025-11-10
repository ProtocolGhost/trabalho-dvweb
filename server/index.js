const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '..', 'db.json');

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  } catch (e) {
    return { usuarios: [], games: [] };
  }
}
function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

/* REST — Usuarios */
app.get('/usuarios', (req, res) => {
  const db = readDB();
  res.json(db.usuarios || []);
});
app.post('/usuarios', (req, res) => {
  const db = readDB();
  const novo = { id: uuidv4(), ...req.body };
  db.usuarios = db.usuarios || [];
  db.usuarios.push(novo);
  writeDB(db);
  res.status(201).json(novo);
});
app.put('/usuarios/:id', (req, res) => {
  const db = readDB();
  db.usuarios = db.usuarios || [];
  db.usuarios = db.usuarios.map(u => (u.id === req.params.id ? { ...u, ...req.body } : u));
  writeDB(db);
  const updated = db.usuarios.find(u => u.id === req.params.id);
  res.json(updated);
});
app.delete('/usuarios/:id', (req, res) => {
  const db = readDB();
  db.usuarios = (db.usuarios || []).filter(u => u.id !== req.params.id);
  writeDB(db);
  res.status(204).end();
});

/* REST — Games */
app.get('/games', (req, res) => {
  const db = readDB();
  res.json(db.games || []);
});
app.get('/games/:id', (req, res) => {
  const db = readDB();
  const g = (db.games || []).find(x => String(x.id) === String(req.params.id));
  if (!g) return res.status(404).json({ error: 'Not found' });
  res.json(g);
});
app.post('/games', (req, res) => {
  const db = readDB();
  db.games = db.games || [];
  const game = {
    id: uuidv4(),
    hostId: req.body.hostId || null,
    opponentId: req.body.opponentId || null,
    status: req.body.status || 'waiting', // waiting | ready | playing | finished
    hostHP: 50,
    opponentHP: 50,
    winnerId: null,
    createdAt: Date.now()
  };
  db.games.push(game);
  writeDB(db);
  // emitir lista atualizada e jogo criado
  io.emit('games:list', db.games);
  io.to(`game_${game.id}`).emit('game:update', game);
  res.status(201).json(game);
});
app.patch('/games/:id', (req, res) => {
  const db = readDB();
  db.games = db.games || [];
  const idx = db.games.findIndex(x => String(x.id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.games[idx] = { ...db.games[idx], ...req.body };
  writeDB(db);
  const game = db.games[idx];
  io.emit('games:list', db.games);
  io.to(`game_${game.id}`).emit('game:update', game);
  if (game.status === 'finished') io.to(`game_${game.id}`).emit('game:finished', game);
  res.json(game);
});

/* Socket.IO — realtime */
io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  socket.on('join', ({ gameId, playerId }) => {
    socket.join(`game_${gameId}`);
    // opcional: emitir estado atual
    const db = readDB();
    const game = (db.games || []).find(g => String(g.id) === String(gameId));
    if (game) socket.emit('game:update', game);
  });

  socket.on('attack', async ({ gameId, playerId }) => {
    try {
      const db = readDB();
      const idx = (db.games || []).findIndex(g => String(g.id) === String(gameId));
      if (idx === -1) return;
      const game = db.games[idx];

      const isHost = String(playerId) === String(game.hostId);
      const targetKey = isHost ? 'opponentHP' : 'hostHP';
      game[targetKey] = Math.max(0, (game[targetKey] || 0) - 1);

      if (game.hostHP <= 0) {
        game.status = 'finished';
        game.winnerId = game.opponentId;
      } else if (game.opponentHP <= 0) {
        game.status = 'finished';
        game.winnerId = game.hostId;
      } else {
        game.status = 'playing';
      }

      db.games[idx] = game;
      writeDB(db);

      io.to(`game_${gameId}`).emit('game:update', game);
      if (game.status === 'finished') io.to(`game_${gameId}`).emit('game:finished', game);
      io.emit('games:list', db.games);
    } catch (err) {
      console.error('attack error', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('socket disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));