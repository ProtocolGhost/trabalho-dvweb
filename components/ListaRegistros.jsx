import React from "react";

export default function ListaRegistros({ registros = [] }) {
  if (!registros || registros.length === 0) {
    return <div className="empty">Nenhum usuário cadastrado ainda.</div>;
  }

  return (
    <div className="lista-registros">
      <ul>
        {registros.map((item) => (
          <li key={item.id}>
            <div className="reg-info">
              <div className="field">
                <span className="label">Nome:</span>
                <div className="value">{item.nome}</div>
              </div>

              <div className="field" style={{ marginTop: 8 }}>
                <span className="label">E-mail:</span>
                <div className="value">{item.email}</div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}