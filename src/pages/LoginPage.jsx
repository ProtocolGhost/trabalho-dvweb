import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/api";
import { toast } from "react-toastify";

export default function LoginPage() {
  const [form, setForm] = useState({ nome: "", senha: "" });
  const navigate = useNavigate();

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const res = await api.get(`/usuarios?nome=${encodeURIComponent(form.nome)}`);
      const users = res.data || [];
      const user = users.find(u => u.nome === form.nome);
      if (!user) {
        toast.error("Usuário não encontrado.");
        return;
      }
      if (user.senha !== form.senha) {
        toast.error("Senha incorreta.");
        return;
      }
      localStorage.setItem("userId", user.id);
      toast.success("Login efetuado.");
      navigate("/profile");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao efetuar login.");
    }
  }

  return (
    <div className="container">
      <header className="header"><h1>Login</h1></header>

      <main className="card" style={{ gridColumn: "1 / -1" }}>
        <form onSubmit={handleSubmit} className="form-cadastro">
          <div className="field">
            <label htmlFor="nome">Nome:</label>
            <input id="nome" name="nome" value={form.nome} onChange={handleChange} required />
          </div>

          <div className="field">
            <label htmlFor="senha">Senha:</label>
            <input id="senha" name="senha" type="password" value={form.senha} onChange={handleChange} required />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="btn-primary">Entrar</button>
            <Link to="/cadastro" className="btn-secondary">Criar conta</Link>
          </div>
        </form>
      </main>
    </div>
  );
}