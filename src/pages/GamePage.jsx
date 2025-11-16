import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import socket from "../socket";

export default function GamePage() {
  const navigate = useNavigate();
  const currentUserId = localStorage.getItem("userId");
  const [gamesList, setGamesList] = useState([]);
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const countdownRef = useRef(null);

  useEffect(() => {
    if (!currentUserId) {
      navigate("/profile");
      return;
    }

    // load initial games
    async function load() {
      try {
        const res = await api.get("/games");
        setGamesList(res.data || []);
      } catch (err) {
        console.error("Erro ao carregar salas:", err);
      }
    }
    load();

    // realtime updates
    socket.on("games:list", (all) => setGamesList(all || []));
    socket.on("game:update", (g) => {
      if (!g) return;
      setGamesList((prev) => {
        const idx = prev.findIndex((p) => String(p.id) === String(g.id));
        if (idx === -1) return [g, ...prev];
        const copy = [...prev];
        copy[idx] = g;
        return copy;
      });
      if (game && String(g.id) === String(game.id)) setGame(g);
      // if update concerns current joined game, handle countdown start/stop
      if (game && String(g.id) === String(game.id)) {
        handleStartingState(g);
      }
    });

    return () => {
      socket.off("games:list");
      socket.off("game:update");
      clearInterval(countdownRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, game]);

  function handleStartingState(g) {
    // start countdown when server marks status 'starting' and provides startAt
    clearInterval(countdownRef.current);
    setCountdown(null);
    if (g.status === "starting" && g.startAt) {
      const tick = () => {
        const remainingMs = g.startAt - Date.now();
        const sec = Math.ceil(remainingMs / 1000);
        setCountdown(sec > 0 ? sec : 0);
        if (remainingMs <= 0) {
          clearInterval(countdownRef.current);
          setCountdown(null);
        }
      };
      tick();
      countdownRef.current = setInterval(tick, 100);
    } else {
      setCountdown(null);
    }
  }

  async function createRoom() {
    if (!currentUserId) return alert("Defina seu usuário no perfil.");
    setLoading(true);
    try {
      const res = await api.post("/games", {
        hostId: currentUserId,
        opponentId: null,
        status: "waiting",
        hostHP: 50,
        opponentHP: 50,
        winnerId: null,
        hostReady: false,
        opponentReady: false,
      });
      const newGame = res.data;
      setGame(newGame);
      // host joins the socket room so it will receive updates
      socket.emit("join", { gameId: newGame.id, playerId: currentUserId });
    } catch (err) {
      console.error("Erro ao criar sala:", err);
      alert("Erro ao criar sala.");
    } finally {
      setLoading(false);
    }
  }

  function enterRoom(roomId) {
    if (!currentUserId) return alert("Defina seu usuário no perfil.");
    setLoading(true);
    socket.emit("join_game", { gameId: roomId, playerId: currentUserId }, (resp) => {
      setLoading(false);
      if (resp && resp.ok) {
        setGame(resp.game);
        handleStartingState(resp.game);
        // already joined by server; client will start receiving updates via 'game:update'
      } else {
        const err = resp && resp.error ? resp.error : "unknown";
        alert("Não foi possível entrar na sala: " + err);
      }
    });
  }

  function attack() {
    if (!game) return;
    socket.emit("attack", { gameId: game.id, playerId: currentUserId });
  }

  function isCurrentHost() {
    return game && String(game.hostId) === String(currentUserId);
  }
  function isCurrentOpponent() {
    return game && String(game.opponentId) === String(currentUserId);
  }

  function toggleReady() {
    if (!game) return;
    const amHost = isCurrentHost();
    const currentReady = amHost ? !!game.hostReady : !!game.opponentReady;
    socket.emit("player_ready", { gameId: game.id, playerId: currentUserId, ready: !currentReady });
  }

  // UI helpers
  return (
    <div className="container">
      <header className="header">
        <h1>Salas de Jogo (Online)</h1>
      </header>

      <main className="card" style={{ gridColumn: "1 / -1" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button className="btn-primary" onClick={createRoom} disabled={loading}>
            Criar Sala
          </button>
          <button className="btn-secondary" onClick={() => navigate("/profile")}>Perfil</button>
        </div>

        <section style={{ marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>Salas Abertas</h3>
          {gamesList.length === 0 && <div>Nenhuma sala criada ainda.</div>}

          {gamesList.map((g) => {
            const isFull = !!g.opponentId && !!g.hostId;
            return (
              <div key={g.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: 8, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                <div style={{ flex: 1 }}>
                  <div><strong>Sala #{g.id}</strong> — Host: {g.hostId}</div>
                  <div style={{ color: "var(--muted)", fontSize: 13 }}>
                    Status: {g.status} {isFull ? "• (2 jogadores)" : ""}
                  </div>
                </div>

                {isFull ? (
                  <div style={{ color: "var(--muted)" }}>Sala Cheia</div>
                ) : (
                  <button className="btn-secondary" onClick={() => enterRoom(g.id)} disabled={loading}>
                    Entrar na Sala
                  </button>
                )}
              </div>
            );
          })}
        </section>

        {game && (
          <section>
            <h3>Partida Ativa — Sala #{game.id}</h3>

            <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 8 }}>
              <div>
                <div><strong>Host:</strong> {game.hostId}</div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>
                  HP: {game.hostHP} • Ready:{" "}
                  <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 6, background: game.hostReady ? "green" : "red", marginLeft: 6 }} />
                </div>
              </div>

              <div>
                <div><strong>Opponent:</strong> {game.opponentId || "Aguardando..."}</div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>
                  HP: {game.opponentHP} • Ready:{" "}
                  <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 6, background: game.opponentReady ? "green" : "red", marginLeft: 6 }} />
                </div>
              </div>
            </div>

            {/* Ready button only visible to participants */}
            {(isCurrentHost() || isCurrentOpponent()) && (
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <button
                  className="btn-secondary"
                  onClick={toggleReady}
                  style={{
                    background: (isCurrentHost() ? game.hostReady : game.opponentReady) ? "green" : "red",
                    color: "white",
                  }}
                >
                  {(isCurrentHost() ? (game.hostReady ? "Pronto (Você)" : "Não Pronto (Você)") : (game.opponentReady ? "Pronto (Você)" : "Não Pronto (Você)"))}
                </button>
                <div style={{ alignSelf: "center", color: "var(--muted)" }}>
                  Clique para alternar seu estado Pronto/Não pronto
                </div>
              </div>
            )}

            {/* Countdown visual when starting */}
            {game.status === "starting" && game.startAt && (
              <div style={{ fontSize: 32, fontWeight: 700, textAlign: "center", margin: "12px 0" }}>
                Iniciando em {countdown ?? 3}...
              </div>
            )}

            {game.status === "playing" ? (
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="btn-primary" onClick={attack}>Atacar</button>
              </div>
            ) : (
              <div style={{ color: "var(--muted)", marginTop: 8 }}>Aguardando jogador / ambos prontos...</div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}