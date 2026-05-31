"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { LavagemComPerfil } from "@/lib/types";
import ChatLavagem from "@/components/ChatLavagem";

interface Lavador {
  id: string;
  nome: string;
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mesParaLabel(valor: string) {
  const [ano, mes] = valor.split("-");
  const d = new Date(Number(ano), Number(mes) - 1, 1);
  return d.toLocaleString("pt-BR", { month: "long", year: "numeric" });
}

export default function PainelPage() {
  const router = useRouter();
  const [lavagens, setLavagens] = useState<LavagemComPerfil[]>([]);
  const [lavadores, setLavadores] = useState<Lavador[]>([]);
  const [mesSelecionado, setMesSelecionado] = useState(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  });
  const [lavadorSelecionado, setLavadorSelecionado] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [nomeGestor, setNomeGestor] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.replace("/");
        return;
      }
      const { data: perfil } = await supabase
        .from("perfis")
        .select("papel, nome")
        .eq("id", data.session.user.id)
        .single();
      if (perfil?.papel !== "gestor") {
        router.replace("/registrar");
        return;
      }
      setNomeGestor(perfil.nome ?? "Gestor");
    });
  }, [router]);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    const supabase = createClient();

    const [ano, mes] = mesSelecionado.split("-").map(Number);
    const inicio = new Date(ano, mes - 1, 1).toISOString();
    const fim = new Date(ano, mes, 1).toISOString();

    let query = supabase
      .from("lavagens")
      .select("*, perfis(nome)")
      .gte("data_hora", inicio)
      .lt("data_hora", fim)
      .order("data_hora", { ascending: false });

    if (lavadorSelecionado) {
      query = query.eq("registrado_por", lavadorSelecionado);
    }

    const { data } = await query;
    setLavagens((data as LavagemComPerfil[]) ?? []);

    const { data: lavadoresData } = await supabase
      .from("perfis")
      .select("id, nome")
      .eq("papel", "lavador")
      .order("nome");
    setLavadores(lavadoresData ?? []);

    setCarregando(false);
  }, [mesSelecionado, lavadorSelecionado]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  function exportarCSV() {
    const linhas = [
      ["Data/Hora", "Placa Cavalo", "Placa Carreta", "Tipo", "Lavador"],
      ...lavagens.map(l => [
        formatarData(l.data_hora),
        l.placa_cavalo,
        l.placa_carreta,
        l.tipo === "bau" ? "Baú" : "Sider",
        l.perfis?.nome ?? "",
      ]),
    ];
    const csv = linhas.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lavagens-${mesSelecionado}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
  }

  const totalMes = lavagens.length;
  const totalBau = lavagens.filter(l => l.tipo === "bau").length;
  const totalSider = lavagens.filter(l => l.tipo === "sider").length;

  const mesesOpcoes = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-600 text-white px-4 py-4 flex items-center justify-between shadow">
        <div>
          <h1 className="font-bold text-lg">Painel do Gestor</h1>
          {nomeGestor && <p className="text-blue-200 text-xs">{nomeGestor}</p>}
        </div>
        <button onClick={sair} className="text-blue-200 text-sm underline">Sair</button>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Filtros */}
        <div className="bg-white rounded-2xl p-4 shadow space-y-3">
          <h2 className="font-semibold text-gray-700 text-sm">Filtros</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Mês</label>
              <select
                value={mesSelecionado}
                onChange={e => setMesSelecionado(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {mesesOpcoes.map(m => (
                  <option key={m} value={m}>{mesParaLabel(m)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Lavador</label>
              <select
                value={lavadorSelecionado}
                onChange={e => setLavadorSelecionado(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos os lavadores</option>
                {lavadores.map(l => (
                  <option key={l.id} value={l.id}>{l.nome}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow text-center">
            <p className="text-3xl font-bold text-blue-600">{totalMes}</p>
            <p className="text-xs text-gray-500 mt-1">Total</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow text-center">
            <p className="text-3xl font-bold text-indigo-600">{totalBau}</p>
            <p className="text-xs text-gray-500 mt-1">Baú</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow text-center">
            <p className="text-3xl font-bold text-purple-600">{totalSider}</p>
            <p className="text-xs text-gray-500 mt-1">Sider</p>
          </div>
        </div>

        {/* Exportar */}
        <button
          onClick={exportarCSV}
          disabled={lavagens.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-semibold py-3 rounded-2xl shadow disabled:opacity-50 active:bg-green-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Exportar CSV
        </button>

        {/* Lista */}
        {carregando ? (
          <div className="text-center py-12 text-gray-400">Carregando...</div>
        ) : lavagens.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            Nenhuma lavagem registrada neste período.
          </div>
        ) : (
          <div className="space-y-3">
            {lavagens.map(l => (
              <div key={l.id} className="bg-white rounded-2xl p-4 shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-gray-800">{l.placa_cavalo}</span>
                      <span className="text-gray-400">/</span>
                      <span className="font-mono font-bold text-gray-800">{l.placa_carreta}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{formatarData(l.data_hora)}</p>
                    <p className="text-xs text-gray-500">{l.perfis?.nome ?? "—"}</p>
                  </div>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${l.tipo === "bau" ? "bg-indigo-100 text-indigo-700" : "bg-purple-100 text-purple-700"}`}>
                    {l.tipo === "bau" ? "Baú" : "Sider"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <ChatLavagem onLavagemSalva={carregarDados} />
    </div>
  );
}
