"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { LavagemComPerfil } from "@/lib/types";
import ChatLavagem from "@/components/ChatLavagem";
import LogoMX from "@/components/LogoMX";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
      if (!data.session) { router.replace("/"); return; }
      const { data: perfil } = await supabase
        .from("perfis").select("papel, nome").eq("id", data.session.user.id).single();
      if (perfil?.papel !== "gestor") { router.replace("/registrar"); return; }
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
      .from("lavagens").select("*, perfis(nome)")
      .gte("data_hora", inicio).lt("data_hora", fim).eq("excluido", false)
      .order("data_hora", { ascending: false });

    if (lavadorSelecionado) query = query.eq("registrado_por", lavadorSelecionado);

    const { data } = await query;
    setLavagens((data as LavagemComPerfil[]) ?? []);

    const { data: lavadoresData } = await supabase
      .from("perfis").select("id, nome").eq("papel", "lavador").order("nome");
    setLavadores(lavadoresData ?? []);
    setCarregando(false);
  }, [mesSelecionado, lavadorSelecionado]);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  function exportarPDF() {
    const lista = lavagens;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const roxo: [number, number, number] = [109, 92, 245];
    const escuro: [number, number, number] = [21, 19, 46];

    // Faixa escura do topo
    doc.setFillColor(escuro[0], escuro[1], escuro[2]);
    doc.rect(0, 0, W, 40, "F");

    // Logo MX (círculo)
    doc.setDrawColor(139, 124, 248);
    doc.setLineWidth(0.5);
    doc.setFillColor(15, 15, 25);
    doc.circle(20, 16, 6, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("MX", 20, 17.5, { align: "center" });

    // Marca
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text("MX DIGITAL", 30, 14);
    doc.setFontSize(7);
    doc.setTextColor(165, 159, 208);
    doc.text("SISTEMA DE LAVAGENS", 30, 19);

    // Título
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("Relatorio de Lavagens", 14, 33);

    // Subtítulo
    const hoje = new Date().toLocaleDateString("pt-BR");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(185, 180, 221);
    doc.text("Emitido em " + hoje + "  ·  Lava-Jato Tomasi", 14, 38);

    // Cards de resumo
    const total = lista.length;
    const nBau = lista.filter((x) => x.tipo === "bau").length;
    const nSider = lista.filter((x) => x.tipo === "sider").length;
    const cardY = 48, cardH = 20, gap = 6;
    const cardW = (W - 28 - gap * 2) / 3;
    const cards: { n: number; l: string; c: [number, number, number] }[] = [
      { n: total, l: "TOTAL DE LAVAGENS", c: roxo },
      { n: nBau, l: "BAU", c: roxo },
      { n: nSider, l: "SIDER", c: [47, 158, 111] },
    ];
    cards.forEach((card, i) => {
      const x = 14 + i * (cardW + gap);
      doc.setDrawColor(230, 228, 242);
      doc.setFillColor(246, 245, 253);
      doc.roundedRect(x, cardY, cardW, cardH, 2.5, 2.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(card.c[0], card.c[1], card.c[2]);
      doc.text(String(card.n), x + 6, cardY + 10);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(108, 108, 122);
      doc.text(card.l, x + 6, cardY + 16);
    });

    // Tabela
    const linhas = lista.map((x) => [
      formatarData(x.data_hora),
      x.placa_cavalo || "-",
      x.placa_carreta || "-",
      x.tipo === "bau" ? "Bau" : "Sider",
      x.perfis?.nome || "-",
    ]);

    autoTable(doc, {
      startY: cardY + cardH + 8,
      head: [["Data / Hora", "Placa Cavalo", "Placa Carreta", "Tipo", "Lavador"]],
      body: linhas,
      theme: "striped",
      headStyles: { fillColor: roxo, textColor: 255, fontStyle: "bold", fontSize: 9 },
      alternateRowStyles: { fillColor: [246, 245, 253] },
      styles: { fontSize: 9, cellPadding: 3, textColor: [42, 42, 53] },
      margin: { left: 14, right: 14 },
    });

    // Rodapé
    // @ts-expect-error jspdf-autotable adds lastAutoTable at runtime
    const fy: number = doc.lastAutoTable.finalY + 10;
    doc.setDrawColor(230, 228, 242);
    doc.line(14, fy, W - 14, fy);
    doc.setFontSize(8);
    doc.setTextColor(108, 108, 122);
    doc.text("Relatorio gerado automaticamente pelo sistema MX Digital", 14, fy + 6);

    doc.save("relatorio-lavagens-" + hoje.replace(/\//g, "-") + ".pdf");
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
    <div className="min-h-screen bg-mx-bg relative">
      {/* Glow roxo de fundo */}
      <div
        className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px]"
        style={{ background: "radial-gradient(ellipse at center top, rgba(109,92,245,0.14) 0%, transparent 70%)" }}
      />

      {/* Header */}
      <header className="relative z-10 px-4 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #1D1D26" }}>
        <LogoMX />
        <div className="flex items-center gap-4">
          {nomeGestor && <span className="text-mx-muted text-sm hidden sm:block">{nomeGestor}</span>}
          <button onClick={sair} className="btn-secondary text-sm py-2 px-4">Sair</button>
        </div>
      </header>

      <main className="relative z-10 max-w-2xl mx-auto p-4 space-y-5">
        <div className="pt-2">
          <h1 className="text-2xl font-bold text-white">
            Painel do <em className="not-italic text-[#8B7CF8]">Gestor</em>
          </h1>
        </div>

        {/* Filtros */}
        <div className="card space-y-3">
          <p className="section-label">Filtros</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-mx-muted mb-1">MÊS</label>
              <select
                value={mesSelecionado}
                onChange={e => setMesSelecionado(e.target.value)}
                className="input-field text-sm"
              >
                {mesesOpcoes.map(m => (
                  <option key={m} value={m} className="bg-[#0D0D12]">{mesParaLabel(m)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-mx-muted mb-1">LAVADOR</label>
              <select
                value={lavadorSelecionado}
                onChange={e => setLavadorSelecionado(e.target.value)}
                className="input-field text-sm"
              >
                <option value="" className="bg-[#0D0D12]">Todos os lavadores</option>
                {lavadores.map(l => (
                  <option key={l.id} value={l.id} className="bg-[#0D0D12]">{l.nome}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { n: totalMes, l: "TOTAL" },
            { n: totalBau, l: "BAÚ" },
            { n: totalSider, l: "SIDER" },
          ].map(({ n, l }) => (
            <div key={l} className="card text-center py-4">
              <p className="text-3xl font-bold text-[#8B7CF8]">{n}</p>
              <p className="section-label mt-1">{l}</p>
            </div>
          ))}
        </div>

        {/* Exportar PDF */}
        <button
          onClick={exportarPDF}
          disabled={lavagens.length === 0}
          className="btn-primary w-full"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Exportar PDF
        </button>

        {/* Lista */}
        {carregando ? (
          <div className="text-center py-12 text-mx-muted">Carregando...</div>
        ) : lavagens.length === 0 ? (
          <div className="text-center py-12 text-mx-muted">
            Nenhuma lavagem registrada neste período.
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            {/* Cabeçalho da tabela */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-3 text-white text-xs font-bold" style={{ background: "#6D5CF5" }}>
              <span>PLACAS / DATA</span>
              <span className="hidden sm:block">LAVADOR</span>
              <span>TIPO</span>
              <span className="sr-only">—</span>
            </div>
            {lavagens.map((l, i) => (
              <div
                key={l.id}
                className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_auto_auto] gap-3 px-4 py-3 items-center transition-colors"
                style={{
                  background: i % 2 === 0 ? "#0D0D12" : "#0F0F16",
                  borderTop: "1px solid #1D1D26",
                }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white text-sm">{l.placa_cavalo}</span>
                    <span className="text-mx-muted">/</span>
                    <span className="font-mono font-bold text-white text-sm">{l.placa_carreta}</span>
                  </div>
                  <p className="text-xs text-mx-muted mt-0.5">{formatarData(l.data_hora)}</p>
                  <p className="text-xs text-mx-muted sm:hidden">{l.perfis?.nome ?? "—"}</p>
                </div>
                <span className="text-xs text-mx-muted hidden sm:block">{l.perfis?.nome ?? "—"}</span>
                <span className={l.tipo === "bau" ? "badge-roxo" : "badge-verde"}>
                  {l.tipo === "bau" ? "Baú" : "Sider"}
                </span>
                <button
                  onClick={async () => {
                    if (!confirm("Excluir esta lavagem?")) return;
                    const supabase = createClient();
                    await supabase.from("lavagens").update({ excluido: true, excluido_em: new Date().toISOString() }).eq("id", l.id);
                    carregarDados();
                  }}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors px-2"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      <ChatLavagem onLavagemSalva={carregarDados} />
    </div>
  );
}
