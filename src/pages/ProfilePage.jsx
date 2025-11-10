import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { toast } from "react-toastify";

export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const userId = localStorage.getItem("userId");

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
        toast.error("Erro ao carregar perfil.");
      }
    }
    fetchUser();
  }, [userId, navigate]);

  function handleLogout() {
    localStorage.removeItem("userId");
    toast.info("Logout realizado.");
    navigate("/");
  }

  return (
    <div className="container">
      <header className="header"><h1>Perfil</h1></header>

      <main className="card" style={{ gridColumn: "1 / -1" }}>
        {user ? (
          <>
            <h2 style={{ marginTop: 0 }}>{user.nome}</h2>
            <p>Vitórias: <strong>{user.wins ?? 0}</strong></p>
            <p>Derrotas: <strong>{user.losses ?? 0}</strong></p>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="btn-primary" onClick={() => navigate("/game")}>Jogar online</button>
              <button className="btn-secondary" onClick={() => navigate("/local")}>Jogar vs computador</button>
              <button className="btn-secondary" onClick={handleLogout}>Logout</button>
            </div>
          </>
        ) : (
          <p>Carregando perfil...</p>
        )}
      </main>
    </div>
  );
}