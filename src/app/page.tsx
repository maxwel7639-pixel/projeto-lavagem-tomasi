"use client";

import { useState, FormEvent } from "react";
import { createClient } from "@/lib/supabase";
import LogoMX from "@/components/LogoMX";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const supabase = createClient();

    try {
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({ email, password: senha });

      if (authError) {
        setErro("E-mail ou senha inválidos. Tente novamente.");
        return;
      }

      if (!authData.user) {
        setErro("Erro ao autenticar. Tente novamente.");
        return;
      }

      const { data: perfil, error: perfilError } = await supabase
        .from("perfis")
        .select("papel")
        .eq("id", authData.user.id)
        .single();

      if (perfilError || !perfil) {
        setErro("Perfil não encontrado. Contate o administrador.");
        return;
      }

      // Navegação real (full reload) — garante que o cookie da sessão esteja disponível na próxima página
      if (["gestor","dev","operacional","gestor_leitura","lavador"].includes(perfil.papel)) {
        window.location.href = "/painel";
      } else {
        window.location.href = "/registrar";
      }
    } catch {
      setErro("Erro inesperado. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen bg-mx-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Glow roxo de fundo */}
      <div
        className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px]"
        style={{ background: "radial-gradient(ellipse at center top, rgba(109,92,245,0.18) 0%, transparent 70%)" }}
      />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10 gap-4">
          <LogoMX />
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white">
              Registro de <em className="not-italic text-[#8B7CF8]">Lavagens</em>
            </h1>
            <p className="text-mx-muted mt-1 text-sm">Lava-Jato Tomasi</p>
          </div>
        </div>

        {/* Card de login */}
        <div className="card">
          <p className="section-label mb-6">Acesso ao sistema</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-mx-soft mb-1">
                E-MAIL
              </label>
              <input
                id="email"
                type="email"
                className="input-field"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                inputMode="email"
              />
            </div>

            <div>
              <label htmlFor="senha" className="block text-xs font-medium text-mx-soft mb-1">
                SENHA
              </label>
              <input
                id="senha"
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {erro && (
              <div
                className="text-sm rounded-xl px-4 py-3 text-red-300"
                style={{ background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.3)" }}
              >
                {erro}
              </div>
            )}

            <button type="submit" className="btn-primary w-full mt-2" disabled={carregando}>
              {carregando ? <><Spinner /> Entrando...</> : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
