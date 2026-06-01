"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { LavagemComPerfil } from "@/lib/types";
import ChatLavagem from "@/components/ChatLavagem";
import LogoMX from "@/components/LogoMX";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const DEV_ID = "6e64e0d6-469e-4d0f-ae39-059c8d80196a";

interface Lavador {
  id: string;
  nome: string;
}

interface PerfilUsuario {
  id: string;
  nome: string;
  papel: string;
  ultimo_acesso?: string | null;
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

function calcularValor(escopo: string | null | undefined, precoCheio: number): number {
  if (!escopo || escopo === "ambos" || escopo === "carreta") return precoCheio;
  if (escopo === "cavalo") return precoCheio / 2;
  return precoCheio;
}

function formatarValor(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusManutencao(): { status: string; cor: string } {
  const hoje = new Date();
  const diaHoje = hoje.getDate();
  // Vence todo dia 1. Considera "atrasado" se passou do dia 5 do mês
  if (diaHoje > 5) return { status: "Atrasado", cor: "#ef4444" };
  return { status: "Em dia", cor: "#2F9E6F" };
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
  const [isDev, setIsDev] = useState(false);
  const [userId, setUserId] = useState("");
  const [autenticado, setAutenticado] = useState(false);

  // Preço
  const [precoCheio, setPrecoCheio] = useState(0);
  const [precoEditando, setPrecoEditando] = useState("");
  const [salvandoPreco, setSalvandoPreco] = useState(false);

  // Seção dev
  const [totalLavagensBanco, setTotalLavagensBanco] = useState(0);
  const [totalUsuarios, setTotalUsuarios] = useState(0);
  const [usuarios, setUsuarios] = useState<PerfilUsuario[]>([]);

  useEffect(() => {
    let cancelado = false;
    async function checar() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelado) return;
      if (!session) { router.replace("/"); return; }
      const { data: perfil } = await supabase
        .from("perfis").select("papel, nome").eq("id", session.user.id).maybeSingle();
      if (cancelado) return;
      if (!perfil || (perfil.papel !== "gestor" && perfil.papel !== "dev")) {
        router.replace("/"); return;
      }
      setUserId(session.user.id);
      setNomeGestor(perfil.nome ?? "Gestor");
      setIsDev(perfil.papel === "dev");
      setAutenticado(true);
    }
    checar();
    return () => { cancelado = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carrega dados dev
  useEffect(() => {
    if (!isDev) return;
    const supabase = createClient();
    supabase.from("lavagens").select("id", { count: "exact", head: true })
      .then(({ count }) => setTotalLavagensBanco(count ?? 0));
    supabase.from("perfis").select("id, nome, papel").order("nome")
      .then(({ data, count }) => {
        setTotalUsuarios(count ?? (data?.length ?? 0));
        setUsuarios((data as PerfilUsuario[]) ?? []);
      });
  }, [isDev]);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    const supabase = createClient();
    const [ano, mes] = mesSelecionado.split("-").map(Number);
    const inicio = new Date(ano, mes - 1, 1).toISOString();
    const fim = new Date(ano, mes, 1).toISOString();

    let query = supabase
      .from("lavagens").select("*, perfis(nome)")
      .gte("data_hora", inicio).lt("data_hora", fim)
      .order("data_hora", { ascending: false });

    if (lavadorSelecionado) query = query.eq("registrado_por", lavadorSelecionado);

    const { data } = await query;
    setLavagens((data as LavagemComPerfil[]) ?? []);

    const { data: lavadoresData } = await supabase
      .from("perfis").select("id, nome").eq("papel", "lavador").order("nome");
    setLavadores(lavadoresData ?? []);

    const { data: configData } = await supabase
      .from("configuracoes").select("preco_cheio").order("atualizado_em", { ascending: false }).limit(1).single();
    if (configData) {
      setPrecoCheio(Number(configData.preco_cheio));
      setPrecoEditando(String(configData.preco_cheio));
    }

    setCarregando(false);
  }, [mesSelecionado, lavadorSelecionado]);

  useEffect(() => { if (autenticado) carregarDados(); }, [autenticado, carregarDados]);

  async function salvarPreco() {
    const valor = parseFloat(precoEditando.replace(",", "."));
    if (isNaN(valor) || valor < 0) return;
    setSalvandoPreco(true);
    const supabase = createClient();
    await supabase.from("configuracoes").update({
      preco_cheio: valor,
      atualizado_por: userId,
      atualizado_em: new Date().toISOString(),
    }).neq("id", "00000000-0000-0000-0000-000000000000");
    setPrecoCheio(valor);
    setSalvandoPreco(false);
  }

  function exportarPDF() {
    const lista = lavagens;
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
    doc.text("Relatorio de Lavagens", 14, 33);
    const hoje = new Date().toLocaleDateString("pt-BR");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(185, 180, 221);
    doc.text("Emitido em " + hoje + "  ·  Lava-Jato Tomasi", 14, 38);

    const total = lista.length;
    const totalReceber = lista.reduce((s, x) => s + calcularValor(x.escopo, precoCheio), 0);
    const nBau = lista.filter((x) => x.tipo === "bau").length;
    const cardY = 48, cardH = 20, gap = 4;
    const cardW = (W - 28 - gap * 3) / 4;
    const cards: { n: string; l: string; c: [number, number, number] }[] = [
      { n: String(total), l: "TOTAL LAVAGENS", c: roxo },
      { n: String(nBau), l: "BAU", c: roxo },
      { n: String(lista.length - nBau), l: "SIDER", c: [47, 158, 111] },
      { n: formatarValor(totalReceber), l: "TOTAL A RECEBER", c: [47, 158, 111] },
    ];
    cards.forEach((card, i) => {
      const x = 14 + i * (cardW + gap);
      doc.setDrawColor(230, 228, 242);
      doc.setFillColor(246, 245, 253);
      doc.roundedRect(x, cardY, cardW, cardH, 2.5, 2.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(card.c[0], card.c[1], card.c[2]);
      doc.text(String(card.n), x + 4, cardY + 10);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(108, 108, 122);
      doc.text(card.l, x + 4, cardY + 16);
    });

    const linhas = lista.map((x) => [
      formatarData(x.data_hora),
      x.placa_cavalo || "-",
      x.placa_carreta || "-",
      x.tipo === "bau" ? "Bau" : "Sider",
      x.escopo === "cavalo" ? "Só cavalo" : x.escopo === "carreta" ? "Só carreta" : "Ambos",
      x.perfis?.nome || "-",
      formatarValor(calcularValor(x.escopo, precoCheio)),
    ]);

    autoTable(doc, {
      startY: cardY + cardH + 8,
      head: [["Data / Hora", "Cavalo", "Carreta", "Tipo", "Escopo", "Lavador", "Valor"]],
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
  const totalReceber = lavagens.reduce((s, l) => s + calcularValor(l.escopo, precoCheio), 0);

  const mesesOpcoes = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const manutencao = statusManutencao();

  if (!autenticado) {
    return <div className="min-h-screen bg-mx-bg" />;
  }

  return (
    <div className="min-h-screen bg-mx-bg relative">
      <div
        className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px]"
        style={{ background: "radial-gradient(ellipse at center top, rgba(109,92,245,0.14) 0%, transparent 70%)" }}
      />

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
            Painel do <em className="not-italic text-[#8B7CF8]">{isDev ? "Dev" : "Gestor"}</em>
          </h1>
        </div>

        {/* Preço por lavagem */}
        <div className="card space-y-3">
          <p className="section-label">Configuração de Preço</p>
          <div className="flex items-center gap-3">
            <label className="text-sm text-mx-soft whitespace-nowrap">Preço por lavagem:</label>
            <div className="flex items-center gap-2 flex-1">
              <span className="text-mx-muted text-sm">R$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={precoEditando}
                onChange={e => setPrecoEditando(e.target.value)}
                className="input-field text-sm w-28"
                placeholder="0,00"
              />
              <button
                onClick={salvarPreco}
                disabled={salvandoPreco}
                className="btn-primary py-2 px-4 text-sm"
              >
                {salvandoPreco ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
          <p className="text-xs text-mx-muted">Só cavalo = metade do preço. Carreta ou ambos = preço cheio.</p>
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

        {/* Resumo com Total a Receber */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          <div className="card text-center py-4 col-span-2 sm:col-span-1" style={{ border: "1px solid rgba(47,158,111,0.4)" }}>
            <p className="text-2xl font-bold text-[#2F9E6F]">{formatarValor(totalReceber)}</p>
            <p className="section-label mt-1">A RECEBER</p>
          </div>
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
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-3 text-white text-xs font-bold" style={{ background: "#6D5CF5" }}>
              <span>PLACAS / DATA</span>
              <span className="hidden sm:block">LAVADOR</span>
              <span>TIPO</span>
              <span>VALOR</span>
            </div>
            {lavagens.map((l, i) => (
              <div
                key={l.id}
                className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-3 items-center"
                style={{
                  background: i % 2 === 0 ? "#0D0D12" : "#0F0F16",
                  borderTop: "1px solid #1D1D26",
                }}
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-white text-sm">{l.placa_cavalo || "—"}</span>
                    {l.placa_carreta && <><span className="text-mx-muted">/</span><span className="font-mono font-bold text-white text-sm">{l.placa_carreta}</span></>}
                  </div>
                  <p className="text-xs text-mx-muted mt-0.5">{formatarData(l.data_hora)}</p>
                  <p className="text-xs text-mx-muted sm:hidden">{l.perfis?.nome ?? "—"}</p>
                </div>
                <span className="text-xs text-mx-muted hidden sm:block">{l.perfis?.nome ?? "—"}</span>
                <span className={l.tipo === "bau" ? "badge-roxo" : "badge-verde"}>
                  {l.tipo === "bau" ? "Baú" : "Sider"}
                </span>
                <span className="text-sm font-semibold text-[#2F9E6F]">
                  {formatarValor(calcularValor(l.escopo, precoCheio))}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── SEÇÃO DEV ── */}
        {isDev && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: "#1D1D26" }} />
              <span className="text-xs text-mx-muted font-mono tracking-widest">GESTÃO DO SISTEMA</span>
              <div className="flex-1 h-px" style={{ background: "#1D1D26" }} />
            </div>

            {/* Card Manutenção */}
            <div className="card" style={{ border: `1px solid ${manutencao.cor}33` }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="section-label mb-1">Manutenção MX Digital</p>
                  <p className="text-2xl font-bold text-white">R$ 60<span className="text-sm font-normal text-mx-muted">/mês</span></p>
                  <p className="text-xs text-mx-muted mt-1">Vence todo dia 1 de cada mês</p>
                </div>
                <span
                  className="text-sm font-bold px-3 py-1 rounded-full"
                  style={{ background: `${manutencao.cor}22`, color: manutencao.cor, border: `1px solid ${manutencao.cor}44` }}
                >
                  {manutencao.status}
                </span>
              </div>
            </div>

            {/* Card Métricas */}
            <div className="card space-y-4">
              <p className="section-label">Métricas de Uso</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center py-3 rounded-xl" style={{ background: "#0D0D12", border: "1px solid #1D1D26" }}>
                  <p className="text-3xl font-bold text-[#8B7CF8]">{totalLavagensBanco}</p>
                  <p className="text-xs text-mx-muted mt-1">LAVAGENS NO BANCO</p>
                </div>
                <div className="text-center py-3 rounded-xl" style={{ background: "#0D0D12", border: "1px solid #1D1D26" }}>
                  <p className="text-3xl font-bold text-[#8B7CF8]">{totalUsuarios}</p>
                  <p className="text-xs text-mx-muted mt-1">USUÁRIOS CADASTRADOS</p>
                </div>
              </div>
            </div>

            {/* Card Usuários */}
            <div className="card space-y-3">
              <p className="section-label">Usuários do Sistema</p>
              <div className="space-y-2">
                {usuarios.map(u => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between px-3 py-2 rounded-xl"
                    style={{ background: "#0D0D12", border: "1px solid #1D1D26" }}
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{u.nome}</p>
                      <p className="text-xs text-mx-muted capitalize">{u.papel}</p>
                    </div>
                    <span
                      className="text-xs px-2 py-1 rounded-full capitalize"
                      style={{
                        background: u.papel === "dev" ? "rgba(109,92,245,0.15)" : u.papel === "gestor" ? "rgba(109,92,245,0.1)" : "rgba(47,158,111,0.1)",
                        color: u.papel === "dev" ? "#8B7CF8" : u.papel === "gestor" ? "#6D5CF5" : "#2F9E6F",
                        border: `1px solid ${u.papel === "dev" ? "rgba(139,124,248,0.3)" : u.papel === "gestor" ? "rgba(109,92,245,0.2)" : "rgba(47,158,111,0.2)"}`,
                      }}
                    >
                      {u.papel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <ChatLavagem onLavagemSalva={carregarDados} />
    </div>
  );
}
