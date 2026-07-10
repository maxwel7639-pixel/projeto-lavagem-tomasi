"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { LavagemMaxwel } from "@/lib/types";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const VALOR_FIXO = 30;

const TIPOS = [
  { v: "bau", l: "Baú" },
  { v: "sider", l: "Sider" },
  { v: "rodotrem", l: "Rodotrem" },
] as const;

const ESCOPOS = [
  { v: "cavalo", l: "Só cavalo" },
  { v: "carreta", l: "Só carreta" },
  { v: "truck", l: "Truck" },
  { v: "ambos", l: "Cavalo + Carreta" },
  { v: "rodotrem", l: "Rodotrem" },
] as const;

function mesParaLabel(valor: string) {
  const [ano, mes] = valor.split("-");
  const d = new Date(Number(ano), Number(mes) - 1, 1);
  return d.toLocaleString("pt-BR", { month: "long", year: "numeric" });
}

function mesNome(valor: string) {
  const [ano, mes] = valor.split("-");
  const d = new Date(Number(ano), Number(mes) - 1, 1);
  return d.toLocaleString("pt-BR", { month: "long" });
}

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatarDataBR(data: string) {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarValor(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function rotuloTipo(tipo: string | null) {
  return TIPOS.find(t => t.v === tipo)?.l ?? "-";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function MinhasLavagens({ userId }: { userId: string }) {
  const [mesSelecionado, setMesSelecionado] = useState(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  });
  const [lavagens, setLavagens] = useState<LavagemMaxwel[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [data, setData] = useState(hojeISO);
  const [placaCavalo, setPlacaCavalo] = useState("");
  const [placaCarreta, setPlacaCarreta] = useState("");
  const [tipo, setTipo] = useState<string>("bau");
  const [escopo, setEscopo] = useState<string>("ambos");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const supabase = createClient();
    const [ano, mes] = mesSelecionado.split("-").map(Number);
    const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const fimAno = mes === 12 ? ano + 1 : ano;
    const fimMes = mes === 12 ? 1 : mes + 1;
    const fim = `${fimAno}-${String(fimMes).padStart(2, "0")}-01`;
    const { data: rows } = await supabase
      .from("lavagens_maxwel")
      .select("id, data, placa_cavalo, placa_carreta, tipo, escopo, valor, observacao")
      .gte("data", inicio).lt("data", fim).eq("excluido", false)
      .order("data", { ascending: false });
    setLavagens((rows as LavagemMaxwel[]) ?? []);
    setCarregando(false);
  }, [mesSelecionado]);

  useEffect(() => { carregar(); }, [carregar]);

  async function adicionar() {
    if (!data) return;
    setSalvando(true);
    const supabase = createClient();
    await supabase.from("lavagens_maxwel").insert({
      data,
      placa_cavalo: placaCavalo.trim().toUpperCase() || null,
      placa_carreta: placaCarreta.trim().toUpperCase() || null,
      tipo,
      escopo,
      valor: VALOR_FIXO,
      observacao: observacao.trim() || null,
    });
    setPlacaCavalo("");
    setPlacaCarreta("");
    setTipo("bau");
    setEscopo("ambos");
    setObservacao("");
    setData(hojeISO());
    setSalvando(false);
    carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta lavagem?")) return;
    const supabase = createClient();
    await supabase.from("lavagens_maxwel")
      .update({ excluido: true, excluido_em: new Date().toISOString() })
      .eq("id", id);
    carregar();
  }

  const totalLavagens = lavagens.length;
  const totalReceber = lavagens.reduce((s, l) => s + Number(l.valor), 0);

  const mesesOpcoes = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  function exportarPDF() {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const roxo: [number, number, number] = [109, 92, 245];
    const escuro: [number, number, number] = [21, 19, 46];

    doc.setFillColor(escuro[0], escuro[1], escuro[2]);
    doc.rect(0, 0, W, 40, "F");
    doc.setDrawColor(139, 124, 248);
    doc.setLineWidth(0.5);
    doc.setFillColor(15, 15, 25);
    doc.circle(20, 16, 6, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("MX", 20, 17.5, { align: "center" });
    doc.setFontSize(12);
    doc.text("MX DIGITAL", 30, 14);
    doc.setFontSize(7);
    doc.setTextColor(165, 159, 208);
    doc.text("SISTEMA DE LAVAGENS", 30, 19);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("Minhas Lavagens", 14, 33);
    const hoje = new Date().toLocaleDateString("pt-BR");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(185, 180, 221);
    doc.text("Emitido em " + hoje + "  ·  " + mesParaLabel(mesSelecionado), 14, 38);

    const cardY = 48, cardH = 20, gap = 4;
    const cardW = (W - 28 - gap) / 2;
    const cards: { n: string; l: string; c: [number, number, number] }[] = [
      { n: String(totalLavagens), l: "TOTAL LAVAGENS", c: roxo },
      { n: formatarValor(totalReceber), l: "TOTAL A RECEBER", c: [47, 158, 111] },
    ];
    cards.forEach((card, i) => {
      const x = 14 + i * (cardW + gap);
      doc.setDrawColor(230, 228, 242);
      doc.setFillColor(246, 245, 253);
      doc.roundedRect(x, cardY, cardW, cardH, 2.5, 2.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(card.c[0], card.c[1], card.c[2]);
      doc.text(String(card.n), x + 5, cardY + 10);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(108, 108, 122);
      doc.text(card.l, x + 5, cardY + 16);
    });

    const linhas = lavagens.map((l) => [
      l.placa_cavalo || "-",
      l.placa_carreta || "-",
      formatarDataBR(l.data),
      rotuloTipo(l.tipo),
      formatarValor(Number(l.valor)),
    ]);

    autoTable(doc, {
      startY: cardY + cardH + 8,
      head: [["Placa Cavalo", "Placa Carreta", "Data", "Tipo", "Valor"]],
      body: linhas,
      theme: "striped",
      headStyles: { fillColor: roxo, textColor: 255, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [246, 245, 253] },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: [42, 42, 53] },
      margin: { left: 14, right: 14 },
    });

    // @ts-expect-error jspdf-autotable adds lastAutoTable at runtime
    const fy: number = doc.lastAutoTable.finalY + 10;
    doc.setDrawColor(230, 228, 242);
    doc.line(14, fy, W - 14, fy);
    doc.setFontSize(8);
    doc.setTextColor(108, 108, 122);
    doc.text("Relatorio gerado automaticamente pelo sistema MX Digital", 14, fy + 6);
    doc.save("minhas-lavagens-" + hoje.replace(/\//g, "-") + ".pdf");
  }

  return (
    <div className="space-y-5">
      {/* Cards de total */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card text-center py-4">
          <p className="text-3xl font-bold text-[#8B7CF8]">{totalLavagens}</p>
          <p className="section-label mt-1">LAVAGENS</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-[#8B7CF8]">{formatarValor(totalReceber)}</p>
          <p className="section-label mt-1">TOTAL A RECEBER</p>
        </div>
      </div>
      <p className="text-center text-sm text-mx-muted -mt-2">
        {totalLavagens} {totalLavagens === 1 ? "lavagem" : "lavagens"} em {mesNome(mesSelecionado)} — {formatarValor(totalReceber)}
      </p>

      {/* Filtro de mês */}
      <div className="card space-y-3">
        <p className="section-label">Filtro</p>
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
      </div>

      {/* Formulário adicionar */}
      <div className="card space-y-3">
        <p className="section-label">Adicionar Lavagem</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-mx-muted mb-1">DATA</label>
            <input
              type="date"
              value={data}
              max={hojeISO()}
              onChange={e => setData(e.target.value)}
              className="input-field text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-mx-muted mb-1">TIPO</label>
            <select
              value={tipo}
              onChange={e => setTipo(e.target.value)}
              className="input-field text-sm"
            >
              {TIPOS.map(t => (
                <option key={t.v} value={t.v} className="bg-[#0D0D12]">{t.l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-mx-muted mb-1">PLACA CAVALO</label>
            <input
              type="text"
              value={placaCavalo}
              onChange={e => setPlacaCavalo(e.target.value.toUpperCase())}
              maxLength={8}
              placeholder="ABC1D23 (opcional)"
              className="input-field text-sm font-mono uppercase"
            />
          </div>
          <div>
            <label className="block text-xs text-mx-muted mb-1">PLACA CARRETA</label>
            <input
              type="text"
              value={placaCarreta}
              onChange={e => setPlacaCarreta(e.target.value.toUpperCase())}
              maxLength={8}
              placeholder="ABC1D23 (opcional)"
              className="input-field text-sm font-mono uppercase"
            />
          </div>
          <div>
            <label className="block text-xs text-mx-muted mb-1">ESCOPO</label>
            <select
              value={escopo}
              onChange={e => setEscopo(e.target.value)}
              className="input-field text-sm"
            >
              {ESCOPOS.map(s => (
                <option key={s.v} value={s.v} className="bg-[#0D0D12]">{s.l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-mx-muted mb-1">VALOR</label>
            <div className="input-field text-sm flex items-center text-mx-soft">
              R$ 30,00 por lavagem
            </div>
          </div>
        </div>
        <div>
          <label className="block text-xs text-mx-muted mb-1">OBSERVAÇÃO (opcional)</label>
          <input
            type="text"
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            placeholder="Anotação livre..."
            className="input-field text-sm"
          />
        </div>
        <button
          onClick={adicionar}
          disabled={salvando || !data}
          className="btn-primary w-full"
        >
          {salvando ? "Adicionando..." : "Adicionar"}
        </button>
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
        <div className="text-center py-12 text-mx-muted">Nenhuma lavagem registrada neste período.</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-3 text-white text-xs font-bold" style={{ background: "#6D5CF5" }}>
            <span>PLACAS / DATA</span>
            <span>TIPO</span>
            <span>VALOR</span>
            <span className="sr-only">AÇÕES</span>
          </div>
          {lavagens.map((l, i) => (
            <div
              key={l.id}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-3 items-center"
              style={{ background: i % 2 === 0 ? "#0D0D12" : "#0F0F16", borderTop: "1px solid #1D1D26" }}
            >
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-white text-sm">{l.placa_cavalo || "—"}</span>
                  {l.placa_carreta && <><span className="text-mx-muted">/</span><span className="font-mono font-bold text-white text-sm">{l.placa_carreta}</span></>}
                </div>
                <p className="text-xs text-mx-muted mt-0.5">{formatarDataBR(l.data)}</p>
                {l.observacao && <p className="text-xs text-mx-soft mt-0.5">{l.observacao}</p>}
              </div>
              <span className="badge-roxo">{rotuloTipo(l.tipo)}</span>
              <span className="text-sm text-white">{formatarValor(Number(l.valor))}</span>
              <button
                onClick={() => excluir(l.id)}
                className="text-sm text-red-400 hover:text-red-300 transition-colors px-1"
                aria-label="Excluir lavagem"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
