import React from "react";
import { Link } from "react-router-dom";

export default function AboutPage() {
  return (
    <div className="container">
      <header className="header">
        <h1>Sobre o projeto</h1>
      </header>

      <main className="card" style={{ gridColumn: "1 / -1" }}>
        <h2 style={{ marginTop: 0 }}>Informações</h2>
        <p style={{ color: "var(--muted)" }}>
          Frase de teste: Esta é a página de informações do projeto.
        </p>

        <div style={{ marginTop: 12 }}>
          <Link to="/" className="btn-secondary">
            Voltar ao cadastro
          </Link>
        </div>
      </main>
    </div>
  );
}