import React, { useEffect, useState } from "react";
import api from "../api/api";
import socket from "../socket";
import { useNavigate } from "react-router-dom";

export default function GamePage() {
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const currentUserId = localStorage.getItem("userId");

  useEffect(() => {
    socket.on("game:update", (g) => {
      if (g && (!game || String(g.id) === String(game.id))) setGame(g);
    });
    socket.on("game:finished", (g) => {
      if (g && String(g.id) === String(game?.id)) setGame(g);
    });
    socket.on("games:list", () => {});
    return () => {
      socket.off("game:update");
      socket.off("game:finished");
      socket.off("games:list");
    };
  }, [game]);

  async function createGame() {
    if (!currentUserId) return alert("Defina seu usuário (localStorage.userId).");
    setLoading(true);
    try {
      const res = await api.post("/games", { hostId: currentUserId, status: "waiting" });
      setGame(res.data);
      socket.emit("join", { gameId: res.data.id, playerId: currentUserId });
    } catch (err) {
      console.error(err);
      alert("Erro ao criar partida");
    } finally {
      setLoading(false);
    }
  }

  async function joinGame(gameId) {
    if (!currentUserId) return alert("Defina seu usuário.");
    setLoading(true);
    try {
      await api.patch(`/games/${gameId}`, { opponentId: currentUserId, status: "playing" });
      const res = await api.get(`/games/${gameId}`);
      setGame(res.data);
      socket.emit("join", { gameId: res.data.id, playerId: currentUserId });
    } catch (err) {
      console.error(err);
      alert("Erro ao entrar na partida");
    } finally {
      setLoading(false);
    }
  }

  function attack() {
    if (!game || !currentUserId) return;
    socket.emit("attack", { gameId: game.id, playerId: currentUserId });
  }

  if (!currentUserId) {
    return (
      <div className="container">
        <main className="card" style={{ gridColumn: "1 / -1" }}>
          <p>Defina seu usuário antes de jogar. Vá para cadastro ou faça login.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => navigate("/cadastro")} className="btn-secondary">Cadastrar</button>
            <button onClick={() => navigate("/")} className="btn-secondary">Login</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header"><h1>Matchmaking (Socket.IO)</h1></header>
      <main className="card" style={{ gridColumn: "1 / -1" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button onClick={createGame} disabled={loading} className="btn-primary">Criar partida</button>
          <button onClick={() => navigate("/profile")} className="btn-secondary">Perfil</button>
        </div>

        {game ? (
          <>
            <h3>Partida #{game.id} — {game.status}</h3>
            <p>Host: {game.hostId} — HP: {game.hostHP}</p>
            <p>Oponente: {game.opponentId || "Aguardando..."} — HP: {game.opponentHP}</p>
            {game.status === "playing" && <button onClick={attack} className="btn-primary">Atacar</button>}
            {game.status === "finished" && <p>Vencedor: {game.winnerId}</p>}
          </>
        ) : (
          <p>Nenhuma partida criada por você.</p>
        )}
      </main>
    </div>
  );
}