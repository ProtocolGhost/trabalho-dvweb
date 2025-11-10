import React from "react";
import { Link } from "react-router-dom";
import FormCadastro from "../../components/FormCadastro";

export default function CadastroPage({ onAdd }) {
  return (
    <div className="container">
      <header className="header">
        <h1>Cadastro de Usuários</h1>
      </header>

      <main className="card" style={{ gridColumn: "1 / -1" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Cadastrar</h2>

          <div style={{ display: "flex", gap: 8 }}>
            <Link to="/" className="btn-secondary">Fazer login</Link>
          </div>
        </div>

        <FormCadastro onAdd={onAdd} />
      </main>
    </div>
  );
}