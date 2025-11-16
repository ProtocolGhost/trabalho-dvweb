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
    status: req.body.status || 'waiting', // waiting | ready | starting | playing | finished
    hostHP: 50,
    opponentHP: 50,
    winnerId: null,
    hostReady: false,
    opponentReady: false,
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
const startTimers = {}; // new: timers per game to move from 'starting' -> 'playing'

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
      db.games = db.games || [];
      const idx = db.games.findIndex(g => String(g.id) === String(gameId));
      if (idx === -1) return;
      const game = db.games[idx];

      const isHost = String(playerId) === String(game.hostId);
      const targetKey = isHost ? 'opponentHP' : 'hostHP';
      game[targetKey] = Math.max(0, (game[targetKey] || 0) - 1);

      // determinar término
      let finished = false;
      if ((game.hostHP || 0) <= 0) {
        game.status = 'finished';
        game.winnerId = game.opponentId;
        finished = true;
      } else if ((game.opponentHP || 0) <= 0) {
        game.status = 'finished';
        game.winnerId = game.hostId;
        finished = true;
      } else {
        game.status = 'playing';
      }

      // salvar jogo
      db.games[idx] = game;

      // se terminou E for uma partida online entre 2 jogadores, atualizar wins/losses
      const isOnlineMatch = game.hostId && game.opponentId;
      if (finished && game.winnerId && isOnlineMatch) {
        const winnerId = String(game.winnerId);
        const loserId = (String(winnerId) === String(game.hostId)) ? String(game.opponentId) : String(game.hostId);

        db.usuarios = db.usuarios || [];
        const winnerIdx = db.usuarios.findIndex(u => String(u.id) === winnerId);
        const loserIdx = db.usuarios.findIndex(u => String(u.id) === loserId);

        if (winnerIdx !== -1) {
          db.usuarios[winnerIdx].wins = (Number(db.usuarios[winnerIdx].wins) || 0) + 1;
        }
        if (loserIdx !== -1) {
          db.usuarios[loserIdx].losses = (Number(db.usuarios[loserIdx].losses) || 0) + 1;
        }
      }

      writeDB(db);

      io.to(`game_${gameId}`).emit('game:update', game);
      if (game.status === 'finished') io.to(`game_${gameId}`).emit('game:finished', game);
      io.emit('games:list', db.games);
    } catch (err) {
      console.error('attack error', err);
    }
  });

  // Join room atomically: assign opponent if slot available
  socket.on('join_game', ({ gameId, playerId }, callback) => {
    try {
      const db = readDB();
      db.games = db.games || [];
      const idx = db.games.findIndex(g => String(g.id) === String(gameId));
      if (idx === -1) {
        if (callback) callback({ ok: false, error: 'not_found' });
        return;
      }
      const game = db.games[idx];

      // If player is host, just join the socket room
      if (String(game.hostId) === String(playerId)) {
        socket.join(`game_${gameId}`);
        if (callback) callback({ ok: true, game });
        return;
      }

      // Prevent joining if full or already has another opponent
      const hasHost = !!game.hostId;
      const hasOpponent = !!game.opponentId;
      if (!hasHost) {
        // No host, set as host
        game.hostId = playerId;
      } else if (!hasOpponent) {
        // Set as opponent
        game.opponentId = playerId;
        // When both present and not playing, mark ready state default and status
        if (game.status === 'waiting') game.status = 'ready';
        if (typeof game.hostReady !== 'boolean') game.hostReady = false;
        if (typeof game.opponentReady !== 'boolean') game.opponentReady = false;
      } else {
        if (callback) callback({ ok: false, error: 'full' });
        return;
      }

      db.games[idx] = game;
      writeDB(db);

      socket.join(`game_${gameId}`);
      io.to(`game_${gameId}`).emit('game:update', game);
      io.emit('games:list', db.games);
      if (callback) callback({ ok: true, game });
    } catch (err) {
      console.error('join_game error', err);
      if (callback) callback({ ok: false, error: 'server_error' });
    }
  });

  // toggle ready from a player; server updates game and broadcasts atomically
  socket.on('player_ready', ({ gameId, playerId, ready }) => {
    try {
      const db = readDB();
      db.games = db.games || [];
      const idx = db.games.findIndex(g => String(g.id) === String(gameId));
      if (idx === -1) return;
      const game = db.games[idx];

      if (String(playerId) === String(game.hostId)) {
        game.hostReady = !!ready;
      } else if (String(playerId) === String(game.opponentId)) {
        game.opponentReady = !!ready;
      } else {
        return; // not part of game
      }

      // if both ready, schedule start (3s) and set startAt; otherwise cancel any pending start
      if (game.hostReady && game.opponentReady) {
        if (!startTimers[gameId]) {
          game.status = 'starting';
          game.startAt = Date.now() + 3000;
          // schedule final transition to 'playing'
          startTimers[gameId] = setTimeout(() => {
            const db2 = readDB();
            const idx2 = db2.games.findIndex(x => String(x.id) === String(gameId));
            if (idx2 !== -1) {
              db2.games[idx2].status = 'playing';
              db2.games[idx2].startAt = null;
              writeDB(db2);
              io.to(`game_${gameId}`).emit('game:update', db2.games[idx2]);
              io.emit('games:list', db2.games);
            }
            clearTimeout(startTimers[gameId]);
            delete startTimers[gameId];
          }, 3000);
        }
      } else {
        // cancel pending start if any
        if (startTimers[gameId]) {
          clearTimeout(startTimers[gameId]);
          delete startTimers[gameId];
        }
        // set status back to waiting/ready depending if opponent exists
        if (!game.opponentId) game.status = 'waiting';
        else game.status = 'ready';
        game.startAt = null;
      }

      db.games[idx] = game;
      writeDB(db);
      io.to(`game_${gameId}`).emit('game:update', game);
      io.emit('games:list', db.games);
    } catch (err) {
      console.error('player_ready error', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('socket disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));