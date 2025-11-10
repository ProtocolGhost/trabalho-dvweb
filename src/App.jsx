import React from "react";
import { Routes, Route } from "react-router-dom";
import CadastroPage from "./pages/CadastroPage";
import AboutPage from "./pages/AboutPage";
import GamePage from "./pages/GamePage";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import LocalGamePage from "./pages/LocalGamePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/cadastro" element={<CadastroPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/local" element={<LocalGamePage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/game" element={<GamePage />} />
    </Routes>
  );
}