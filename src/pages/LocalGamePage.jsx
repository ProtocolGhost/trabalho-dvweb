import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { toast } from "react-toastify";

export default function LocalGamePage() {
  const navigate = useNavigate();
  const userId = localStorage.getItem("userId");
  const [user, setUser] = useState(null);

  const [playerHP, setPlayerHP] = useState(50);
  const [aiHP, setAiHP] = useState(50);
  const [playing, setPlaying] = useState(true);
  const aiInterval = useRef(null);

  useEffect(() => {
    if (!userId) {
      navigate("/");
      return;
    }
    async function fetchUser() {
      try {
        const res = await api.get(`/usuarios/${userId}`);
        setUser(res.data);
      } catch (err) {
        console.error(err);
        toast.error("Erro ao carregar usuário.");
      }
    }
    fetchUser();
    return () => {
      clearInterval(aiInterval.current);
    };
  }, [userId, navigate]);

  useEffect(() => {
    clearInterval(aiInterval.current);
    if (playing) {
      aiInterval.current = setInterval(() => {
        setPlayerHP((hp) => {
          const next = Math.max(0, hp - 1);
          if (next <= 0) {
            endGame("loss");
          }
          return next;
        });
      }, 300);
    }
    return () => clearInterval(aiInterval.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  useEffect(() => {
    if (playerHP <= 0 && playing) endGame("loss");
    if (aiHP <= 0 && playing) endGame("win");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerHP, aiHP]);

  function endGame(result) {
    if (!playing) return;
    setPlaying(false);
    clearInterval(aiInterval.current);

    if (result === "win") {
      toast.success("Você venceu (jogo local). Resultado NÃO conta no seu recorde.");
    } else {
      toast.info("Você perdeu (jogo local). Resultado NÃO conta no seu recorde.");
    }
    // NÃO atualizar wins/losses no back-end para modo local
  }

  function playerAttack() {
    if (!playing) return;
    setAiHP((hp) => {
      const next = Math.max(0, hp - 1);
      if (next <= 0) {
        endGame("win");
      }
      return next;
    });
  }

  function resetGame() {
    clearInterval(aiInterval.current);
    setPlayerHP(50);
    setAiHP(50);
    setPlaying(true);
  }

  return (
    <div className="container">
      <header className="header"><h1>Jogar vs Computador</h1></header>
      <main className="card" style={{ gridColumn: "1 / -1" }}>
        {user ? (
          <>
            <h2>{user.nome}</h2>
            <p>Seu HP: <strong>{playerHP}</strong></p>
            <p>AI HP: <strong>{aiHP}</strong></p>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="btn-primary" onClick={playerAttack} disabled={!playing}>Atacar</button>

              {/* Reiniciar aparece somente após a partida terminar */}
              {!playing && (
                <button className="btn-secondary" onClick={resetGame}>Reiniciar</button>
              )}

              <button className="btn-secondary" onClick={() => navigate("/profile")}>Voltar ao perfil</button>
            </div>

            {!playing && <p style={{ marginTop: 12 }}>Partida encerrada. Resultado não afetou seu recorde.</p>}
          </>
        ) : (
          <p>Carregando...</p>
        )}
      </main>
    </div>
  );
}