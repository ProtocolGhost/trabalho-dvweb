import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../src/api/api";
import { toast } from "react-toastify";

export default function FormCadastro({ onAdd }) {
  const [form, setForm] = useState({ nome: "", senha: "", confirmar: "" });
  const navigate = useNavigate();

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function validateForm() {
    const nome = (form.nome || "").trim();
    const senha = form.senha || "";
    const confirmar = form.confirmar || "";

    if (nome.length < 3) return { valid: false, msg: "O nome deve ter pelo menos 3 caracteres." };
    if (senha.length < 6) return { valid: false, msg: "A senha deve ter pelo menos 6 caracteres." };
    if (senha !== confirmar) return { valid: false, msg: "As senhas não coincidem." };

    return { valid: true };
  }

  async function isNameUnique(nome) {
    try {
      const res = await api.get(`/usuarios?nome=${encodeURIComponent(nome)}`);
      const matches = res.data || [];
      return matches.length === 0;
    } catch (err) {
      console.error("Erro ao verificar nome:", err);
      return false;
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const v = validateForm();
    if (!v.valid) {
      toast.error(v.msg);
      return;
    }

    const nomeTrim = form.nome.trim();
    const unique = await isNameUnique(nomeTrim);
    if (!unique) {
      toast.error("O nome informado já existe.");
      return;
    }

    try {
      const res = await api.post("/usuarios", {
        nome: nomeTrim,
        senha: form.senha,
        wins: 0,
        losses: 0
      });
      toast.success("Cadastro realizado. Faça login.");
      onAdd && onAdd(res.data);
      setForm({ nome: "", senha: "", confirmar: "" });
      navigate("/"); // redireciona para login
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar. Tente novamente.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="form-cadastro" noValidate>
      <div className="field">
        <label htmlFor="nome">Nome:</label>
        <input
          id="nome"
          type="text"
          name="nome"
          value={form.nome}
          placeholder="Nome de usuário"
          onChange={handleChange}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="senha">Senha:</label>
        <input
          id="senha"
          type="password"
          name="senha"
          value={form.senha}
          placeholder="Senha"
          onChange={handleChange}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="confirmar">Confirmar senha:</label>
        <input
          id="confirmar"
          type="password"
          name="confirmar"
          value={form.confirmar}
          placeholder="Confirme a senha"
          onChange={handleChange}
          required
        />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="btn-primary">Cadastrar</button>
        <button type="button" className="btn-secondary" onClick={() => navigate("/")}>Voltar ao login</button>
      </div>
    </form>
  );
}