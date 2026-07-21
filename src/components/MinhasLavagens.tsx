"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { LavagemMaxwel } from "@/lib/types";
import ChatMinhasLavagens from "@/components/ChatMinhasLavagens";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Lookup de exibição (inclui "rodotrem" por causa de registros legados)
const TIPOS = [
  { v: "bau", l: "Baú" },
  { v: "sider", l: "Sider" },
  { v: "rodotrem", l: "Rodotrem" },
  { v: "outro", l: "Outro" },
] as const;

// Opções oferecidas no modal de edição
const TIPOS_EDICAO = [
  { v: "sider", l: "Sider" },
  { v: "bau", l: "Baú" },
  { v: "outro", l: "Outro" },
] as const;

// Escopo -> valor fixo automático
const ESCOPOS = [
  { v: "cavalo", l: "Cavalo", valor: 30 },
  { v: "carreta", l: "Carreta", valor: 30 },
  { v: "truck", l: "Truck", valor: 30 },
  { v: "ambos", l: "Ambos (Cavalo + Carreta)", valor: 30 },
  { v: "rodotrem", l: "Rodotrem (cavalo + carreta + 2ª carreta)", valor: 60 },
] as const;

type CampoPlaca = "cavalo" | "carreta" | "carreta2";

// Quais campos de placa aparecem para cada escopo
function camposDoEscopo(escopo: string): CampoPlaca[] {
  if (escopo === "cavalo" || escopo === "truck") return ["cavalo"];
  if (escopo === "carreta") return ["carreta"];
  if (escopo === "ambos") return ["cavalo", "carreta"];
  if (escopo === "rodotrem") return ["cavalo", "carreta", "carreta2"];
  return ["cavalo", "carreta", "carreta2"]; // escopo vazio/legado: mostra tudo
}

function valorDoEscopo(escopo: string): number | null {
  return ESCOPOS.find(e => e.v === escopo)?.valor ?? null;
}

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

// Texto das placas na lista.
// Rodotrem: mostra sempre os 3 lugares (cavalo / carreta / 2ª carreta), com "—" onde
// faltar — ex.: rodotrem cujo cavalo ainda não foi lavado aparece "— / carreta / 2ª".
// Demais escopos: junta só as placas que existem (placa única, ambos, etc.).
function placasLista(l: LavagemMaxwel): string {
  if (l.escopo === "rodotrem") {
    return [l.placa_cavalo || "—", l.placa_carreta || "—", l.placa_carreta_2 || "—"].join(" / ");
  }
  return [l.placa_cavalo, l.placa_carreta, l.placa_carreta_2].filter(Boolean).join(" / ") || "—";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function MinhasLavagens({ userId, recarregarSinal }: { userId: string; recarregarSinal?: number }) {
  const [mesSelecionado, setMesSelecionado] = useState(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  });
  const [lavagens, setLavagens] = useState<LavagemMaxwel[]>([]);
  const [carregando, setCarregando] = useState(true);

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
      .select("id, data, placa_cavalo, placa_carreta, placa_carreta_2, tipo, escopo, valor, observacao, created_at")
      .gte("data", inicio).lt("data", fim).eq("excluido", false)
      .order("created_at", { ascending: false });
    setLavagens((rows as LavagemMaxwel[]) ?? []);
    setCarregando(false);
  }, [mesSelecionado]);

  useEffect(() => { carregar(); }, [carregar]);

  // Recarrega ao receber sinal do botão de refresh do painel (pula o 1º render)
  const primeiroRender = useRef(true);
  useEffect(() => {
    if (primeiroRender.current) { primeiroRender.current = false; return; }
    carregar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recarregarSinal]);

  async function excluir(id: string) {
    if (!confirm("Excluir esta lavagem?")) return;
    const supabase = createClient();
    await supabase.from("lavagens_maxwel")
      .update({ excluido: true, excluido_em: new Date().toISOString() })
      .eq("id", id);
    carregar();
  }

  // ── Edição ──
  const [editando, setEditando] = useState<LavagemMaxwel | null>(null);
  const [fCavalo, setFCavalo] = useState("");
  const [fCarreta, setFCarreta] = useState("");
  const [fCarreta2, setFCarreta2] = useState("");
  const [fData, setFData] = useState("");
  const [fEscopo, setFEscopo] = useState("");
  const [fTipo, setFTipo] = useState("");
  const [fValor, setFValor] = useState("");
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  function abrirEdicao(l: LavagemMaxwel) {
    setEditando(l);
    const campos = camposDoEscopo(l.escopo ?? "");
    if (campos.length === 1) {
      // Escopo de placa única (cavalo/carreta/truck): pré-preenche o único campo com a
      // placa que existir, mesmo que dados legados a tenham salvo em outra coluna.
      // Ao salvar, ela é gravada na coluna correta do escopo (as demais viram NULL).
      const unica = l.placa_cavalo ?? l.placa_carreta ?? l.placa_carreta_2 ?? "";
      setFCavalo(campos[0] === "cavalo" ? unica : "");
      setFCarreta(campos[0] === "carreta" ? unica : "");
      setFCarreta2("");
    } else {
      setFCavalo(l.placa_cavalo ?? "");
      setFCarreta(l.placa_carreta ?? "");
      setFCarreta2(l.placa_carreta_2 ?? "");
    }
    setFData(l.data);
    setFEscopo(l.escopo ?? "");
    setFTipo(l.tipo ?? "");
    setFValor(String(l.valor));
  }

  // Trocar o escopo recalcula o valor automaticamente (mas o campo segue editável)
  function trocarEscopo(v: string) {
    setFEscopo(v);
    const auto = valorDoEscopo(v);
    if (auto !== null) setFValor(String(auto));
  }

  async function salvarEdicao() {
    if (!editando) return;
    setSalvandoEdicao(true);
    const campos = camposDoEscopo(fEscopo);
    const norm = (s: string) => s.trim().toUpperCase() || null;
    const valorNum = parseFloat(fValor.replace(",", "."));

    const supabase = createClient();
    await supabase.from("lavagens_maxwel").update({
      data: fData,
      // só persiste as placas aplicáveis ao escopo escolhido
      placa_cavalo: campos.includes("cavalo") ? norm(fCavalo) : null,
      placa_carreta: campos.includes("carreta") ? norm(fCarreta) : null,
      placa_carreta_2: campos.includes("carreta2") ? norm(fCarreta2) : null,
      escopo: fEscopo || null,
      tipo: fTipo || null,
      valor: isNaN(valorNum) || valorNum < 0 ? Number(editando.valor) : valorNum,
    }).eq("id", editando.id); // mantém o mesmo id; não toca em excluido/excluido_em

    setSalvandoEdicao(false);
    setEditando(null);
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
      // 2ª carreta entra na mesma célula: "ABC1D23 / DEF4G56"
      [l.placa_carreta, l.placa_carreta_2].filter(Boolean).join(" / ") || "-",
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

      {/* Adicionar via chat (texto) */}
      <div className="card space-y-3">
        <p className="section-label">Adicionar Lavagem</p>
        <p className="text-xs text-mx-muted">Registre por um chat rápido — escolha o escopo e digite as placas. Valor automático: R$ 30 (rodotrem R$ 60).</p>
        <ChatMinhasLavagens onRegistrado={carregar} />
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
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-3 text-white text-xs font-bold" style={{ background: "#6D5CF5" }}>
            <span>PLACAS / DATA</span>
            <span>TIPO</span>
            <span>VALOR</span>
            <span className="sr-only">EDITAR</span>
            <span className="sr-only">EXCLUIR</span>
          </div>
          {lavagens.map((l, i) => (
            <div
              key={l.id}
              className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-3 items-center"
              style={{ background: i % 2 === 0 ? "#0D0D12" : "#0F0F16", borderTop: "1px solid #1D1D26" }}
            >
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-white text-sm">
                    {placasLista(l)}
                  </span>
                </div>
                <p className="text-xs text-mx-muted mt-0.5">{formatarDataBR(l.data)}</p>
                {l.observacao && <p className="text-xs text-mx-soft mt-0.5">{l.observacao}</p>}
              </div>
              <span className="badge-roxo">{rotuloTipo(l.tipo)}</span>
              <span className="text-sm text-white">{formatarValor(Number(l.valor))}</span>
              <button
                onClick={() => abrirEdicao(l)}
                className="text-[#8B7CF8] hover:text-white transition-colors px-1"
                aria-label="Editar lavagem"
                title="Editar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
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

      {/* Modal de edição */}
      {editando && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setEditando(null)}
        >
          <div
            className="card w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="section-label">Editar Lavagem</p>
              <button
                onClick={() => setEditando(null)}
                className="text-mx-muted hover:text-white transition-colors"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            {/* Placas — até 3 campos lado a lado, conforme o escopo */}
            <div>
              <label className="block text-xs text-mx-muted mb-1">PLACAS</label>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${camposDoEscopo(fEscopo).length}, minmax(0, 1fr))` }}>
                {camposDoEscopo(fEscopo).includes("cavalo") && (
                  <input
                    type="text"
                    value={fCavalo}
                    onChange={e => setFCavalo(e.target.value.toUpperCase())}
                    maxLength={8}
                    placeholder="CAVALO"
                    className="input-field text-sm font-mono uppercase px-3"
                  />
                )}
                {camposDoEscopo(fEscopo).includes("carreta") && (
                  <input
                    type="text"
                    value={fCarreta}
                    onChange={e => setFCarreta(e.target.value.toUpperCase())}
                    maxLength={8}
                    placeholder="CARRETA"
                    className="input-field text-sm font-mono uppercase px-3"
                  />
                )}
                {camposDoEscopo(fEscopo).includes("carreta2") && (
                  <input
                    type="text"
                    value={fCarreta2}
                    onChange={e => setFCarreta2(e.target.value.toUpperCase())}
                    maxLength={8}
                    placeholder="2ª CARRETA"
                    className="input-field text-sm font-mono uppercase px-3"
                  />
                )}
              </div>
              <p className="text-[11px] text-mx-muted mt-1">Qualquer campo pode ficar em branco.</p>
            </div>

            {/* Data */}
            <div>
              <label className="block text-xs text-mx-muted mb-1">DATA</label>
              <input
                type="date"
                value={fData}
                onChange={e => setFData(e.target.value)}
                className="input-field text-sm"
              />
            </div>

            {/* Escopo */}
            <div>
              <label className="block text-xs text-mx-muted mb-1">ESCOPO</label>
              <select
                value={fEscopo}
                onChange={e => trocarEscopo(e.target.value)}
                className="input-field text-sm"
              >
                <option value="" className="bg-[#0D0D12]">— sem escopo —</option>
                {ESCOPOS.map(e => (
                  <option key={e.v} value={e.v} className="bg-[#0D0D12]">
                    {e.l} — R${e.valor}
                  </option>
                ))}
              </select>
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-xs text-mx-muted mb-1">TIPO</label>
              <select
                value={fTipo}
                onChange={e => setFTipo(e.target.value)}
                className="input-field text-sm"
              >
                <option value="" className="bg-[#0D0D12]">— sem tipo —</option>
                {TIPOS_EDICAO.map(t => (
                  <option key={t.v} value={t.v} className="bg-[#0D0D12]">{t.l}</option>
                ))}
              </select>
            </div>

            {/* Valor */}
            <div>
              <label className="block text-xs text-mx-muted mb-1">VALOR (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={fValor}
                onChange={e => setFValor(e.target.value)}
                className="input-field text-sm"
              />
              <p className="text-[11px] text-mx-muted mt-1">Preenchido automático pelo escopo, mas pode ajustar à mão.</p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setEditando(null)}
                className="btn-secondary flex-1 py-2.5 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={salvarEdicao}
                disabled={salvandoEdicao}
                className="btn-primary flex-1 py-2.5 text-sm"
              >
                {salvandoEdicao ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
