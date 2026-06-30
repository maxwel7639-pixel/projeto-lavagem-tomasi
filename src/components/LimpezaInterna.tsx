"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Cabine {
  id: string;
  placa: string;
  data: string;
  valor: number;
}

function mesParaLabel(valor: string) {
  const [ano, mes] = valor.split("-");
  const d = new Date(Number(ano), Number(mes) - 1, 1);
  return d.toLocaleString("pt-BR", { month: "long", year: "numeric" });
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

export default function LimpezaInterna({ userId }: { userId: string }) {
  const [mesSelecionado, setMesSelecionado] = useState(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  });
  const [cabines, setCabines] = useState<Cabine[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [placa, setPlaca] = useState("");
  const [data, setData] = useState(hojeISO);
  const [valor, setValor] = useState("20");
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
      .from("limpezas_internas")
      .select("id, placa, data, valor")
      .gte("data", inicio).lt("data", fim).eq("excluido", false)
      .order("data", { ascending: false });
    setCabines((rows as Cabine[]) ?? []);
    setCarregando(false);
  }, [mesSelecionado]);

  useEffect(() => { carregar(); }, [carregar]);

  async function adicionar() {
    const placaLimpa = placa.trim().toUpperCase();
    const valorNum = parseFloat(valor.replace(",", "."));
    if (!placaLimpa || isNaN(valorNum) || valorNum < 0 || !data) return;
    setSalvando(true);
    const supabase = createClient();
    await supabase.from("limpezas_internas").insert({
      placa: placaLimpa,
      data,
      valor: valorNum,
      registrado_por: userId,
    });
    setPlaca("");
    setValor("20");
    setData(hojeISO());
    setSalvando(false);
    carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta cabine?")) return;
    const supabase = createClient();
    await supabase.from("limpezas_internas")
      .update({ excluido: true, excluido_em: new Date().toISOString() })
      .eq("id", id);
    carregar();
  }

  const totalCabines = cabines.length;
  const totalReceber = cabines.reduce((s, c) => s + Number(c.valor), 0);

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
    doc.text("Limpeza Interna", 14, 33);
    const hoje = new Date().toLocaleDateString("pt-BR");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(185, 180, 221);
    doc.text("Emitido em " + hoje + "  ·  " + mesParaLabel(mesSelecionado), 14, 38);

    const cardY = 48, cardH = 20, gap = 4;
    const cardW = (W - 28 - gap) / 2;
    const cards: { n: string; l: string; c: [number, number, number] }[] = [
      { n: String(totalCabines), l: "TOTAL CABINES", c: roxo },
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

    const linhas = cabines.map((c) => [
      c.placa || "-",
      formatarDataBR(c.data),
      formatarValor(Number(c.valor)),
    ]);

    autoTable(doc, {
      startY: cardY + cardH + 8,
      head: [["Placa", "Data", "Valor"]],
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
    doc.save("limpeza-interna-" + hoje.replace(/\//g, "-") + ".pdf");
  }

  return (
    <div className="space-y-5">
      {/* Cards de total */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card text-center py-4">
          <p className="text-3xl font-bold text-[#8B7CF8]">{totalCabines}</p>
          <p className="section-label mt-1">CABINES</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-[#8B7CF8]">{formatarValor(totalReceber)}</p>
          <p className="section-label mt-1">TOTAL A RECEBER</p>
        </div>
      </div>

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
        <p className="section-label">Adicionar Cabine</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs text-mx-muted mb-1">PLACA</label>
            <input
              type="text"
              value={placa}
              onChange={e => setPlaca(e.target.value.toUpperCase())}
              maxLength={8}
              placeholder="ABC1D23"
              className="input-field text-sm font-mono uppercase"
            />
          </div>
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
            <label className="block text-xs text-mx-muted mb-1">VALOR (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={valor}
              onChange={e => setValor(e.target.value)}
              className="input-field text-sm"
            />
          </div>
        </div>
        <button
          onClick={adicionar}
          disabled={salvando || !placa.trim()}
          className="btn-primary w-full"
        >
          {salvando ? "Adicionando..." : "Adicionar"}
        </button>
      </div>

      {/* Exportar PDF */}
      <button
        onClick={exportarPDF}
        disabled={cabines.length === 0}
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
      ) : cabines.length === 0 ? (
        <div className="text-center py-12 text-mx-muted">Nenhuma cabine registrada neste período.</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-3 text-white text-xs font-bold" style={{ background: "#6D5CF5" }}>
            <span>PLACA</span>
            <span>DATA</span>
            <span>VALOR</span>
            <span className="sr-only">AÇÕES</span>
          </div>
          {cabines.map((c, i) => (
            <div
              key={c.id}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-3 items-center"
              style={{ background: i % 2 === 0 ? "#0D0D12" : "#0F0F16", borderTop: "1px solid #1D1D26" }}
            >
              <span className="font-mono font-bold text-white text-sm">{c.placa}</span>
              <span className="text-xs text-mx-muted">{formatarDataBR(c.data)}</span>
              <span className="text-sm text-white">{formatarValor(Number(c.valor))}</span>
              <button
                onClick={() => excluir(c.id)}
                className="text-sm text-red-400 hover:text-red-300 transition-colors px-1"
                aria-label="Excluir cabine"
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
