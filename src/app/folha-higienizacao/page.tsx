"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

interface LavagemFolha {
  id: string;
  data_hora: string;
  placa_cavalo: string;
  placa_carreta: string | null;
  placa_carreta_2: string | null;
  tipo: "bau" | "sider";
  escopo: string | null;
  completo: boolean;
  confirmado_joao: boolean;
  confirmado_em: string | null;
}

function mesLabel(ano: number, mes: number) {
  const nomes = [
    "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
  ];
  return `${nomes[mes - 1]} / ${ano}`;
}

function descricaoLavacao(lav: LavagemFolha) {
  const tipo = lav.tipo === "bau" ? "Baú" : lav.tipo === "sider" ? "Sider" : "";
  if (lav.escopo === "truck") return `Truck – ${tipo}`;
  if (lav.escopo === "rodotrem") return `Rodotrem – ${tipo}`;
  if (lav.escopo === "cavalo") return `Cavalo`;
  if (lav.escopo === "carreta") return `Carreta – ${tipo}`;
  return tipo || "–";
}

export default function FolhaHigienizacao() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [lavagens, setLavagens] = useState<LavagemFolha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [autenticado, setAutenticado] = useState(false);
  const [isGestor, setIsGestor] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function checar() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelado) return;
      if (!session) {
        window.location.href = "/";
        return;
      }
      const { data: perfil } = await supabase
        .from("perfis").select("papel").eq("id", session.user.id).maybeSingle();
      if (cancelado) return;
      if (!perfil || !["gestor","dev"].includes(perfil.papel)) {
        window.location.href = "/";
        return;
      }
      setIsGestor(perfil.papel === "gestor");
      setAutenticado(true);
    }
    checar();
    return () => { cancelado = true; };
  }, []);

  useEffect(() => {
    if (!autenticado) return;
    buscarLavagens();
  }, [autenticado, ano, mes]);

  async function buscarLavagens() {
    setCarregando(true);
    const supabase = createClient();
    const inicio = `${ano}-${String(mes).padStart(2,"0")}-01`;
    const fimMes = new Date(ano, mes, 0).getDate();
    const fim = `${ano}-${String(mes).padStart(2,"0")}-${fimMes}T23:59:59`;

    const { data } = await supabase
      .from("lavagens")
      .select("id,data_hora,placa_cavalo,placa_carreta,placa_carreta_2,tipo,escopo,completo,confirmado_joao,confirmado_em")
      .eq("excluido", false)
      .gte("data_hora", inicio)
      .lte("data_hora", fim)
      .order("data_hora", { ascending: true });

    if (data) setLavagens(data as LavagemFolha[]);
    setCarregando(false);
  }

  async function toggleCompleto(id: string, valor: boolean) {
    setSalvando(id + "_completo");
    const supabase = createClient();
    await supabase.from("lavagens").update({ completo: valor }).eq("id", id);
    setLavagens(prev => prev.map(l => l.id === id ? { ...l, completo: valor } : l));
    setSalvando(null);
  }

  async function toggleConfirmado(id: string, valor: boolean) {
    setSalvando(id + "_conf");
    const supabase = createClient();
    const payload = valor
      ? { confirmado_joao: true, confirmado_em: new Date().toISOString() }
      : { confirmado_joao: false, confirmado_em: null };
    await supabase.from("lavagens").update(payload).eq("id", id);
    setLavagens(prev => prev.map(l =>
      l.id === id ? { ...l, ...payload } : l
    ));
    setSalvando(null);
  }

  function exportarPDF() {
    import("jspdf").then(({ default: jsPDF }) =>
      import("jspdf-autotable").then(() => {
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

        // Cabeçalho
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("TOMASI LOGÍSTICA", 105, 18, { align: "center" });
        doc.setFontSize(11);
        doc.text("CONTROLE DE HIGIENIZAÇÃO E LUBRIFICAÇÃO DE VEÍCULOS", 105, 26, { align: "center" });
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("POP3.1  •  Revisão 4", 105, 32, { align: "center" });
        doc.text(`Mês de referência: ${mesLabel(ano, mes)}`, 105, 38, { align: "center" });

        const linhas = lavagens.map(l => {
          const data = new Date(l.data_hora).toLocaleDateString("pt-BR");
          const cavalo = l.placa_cavalo || "–";
          const carreta = [l.placa_carreta, l.placa_carreta_2].filter(Boolean).join(" / ") || "–";
          const lavaExt = l.completo
            ? `Completo – ${descricaoLavacao(l)}`
            : descricaoLavacao(l);
          const conf = l.confirmado_joao ? "✓" : "";
          return [data, cavalo, carreta, lavaExt, conf];
        });

        // @ts-expect-error jspdf-autotable augments jsPDF at runtime
        doc.autoTable({
          startY: 44,
          head: [["DATA", "PLACA CAVALO/TRUCK", "PLACA CARRETA", "LAVAÇÃO EXTERNO", "CONFIRMAÇÃO"]],
          body: linhas,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: "bold" },
          columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 36 },
            2: { cellWidth: 36 },
            3: { cellWidth: 70 },
            4: { cellWidth: 22, halign: "center" },
          },
          alternateRowStyles: { fillColor: [245, 245, 245] },
        });

        const nomeMes = mesLabel(ano, mes).replace(" / ", "-").replace(/\s/g, "").toLowerCase();
        doc.save(`folha-higienizacao-${nomeMes}.pdf`);
      })
    );
  }

  if (!autenticado) return null;

  const meses = Array.from({ length: 12 }, (_, i) => i + 1);
  const anos = [hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1];

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e8e8f0", fontFamily: "sans-serif", padding: "24px 16px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Topo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Folha de Higienização</h1>
            <p style={{ fontSize: 12, color: "#888", margin: "4px 0 0" }}>POP3.1 • Revisão 4</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={mes}
              onChange={e => setMes(Number(e.target.value))}
              style={{ background: "#1a1a2e", color: "#e8e8f0", border: "1px solid #333", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}
            >
              {meses.map(m => (
                <option key={m} value={m}>{mesLabel(ano, m)}</option>
              ))}
            </select>
            <select
              value={ano}
              onChange={e => setAno(Number(e.target.value))}
              style={{ background: "#1a1a2e", color: "#e8e8f0", border: "1px solid #333", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}
            >
              {anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            {isGestor && (
              <button
                onClick={exportarPDF}
                style={{ background: "#6D5CF5", color: "#fff", border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}
              >
                Exportar PDF
              </button>
            )}
            <a
              href="/painel"
              style={{ background: "#1a1a2e", color: "#aaa", border: "1px solid #333", borderRadius: 6, padding: "7px 16px", fontSize: 13, textDecoration: "none" }}
            >
              ← Painel
            </a>
          </div>
        </div>

        {/* Tabela */}
        {carregando ? (
          <p style={{ color: "#888", textAlign: "center", marginTop: 60 }}>Carregando...</p>
        ) : lavagens.length === 0 ? (
          <p style={{ color: "#888", textAlign: "center", marginTop: 60 }}>Nenhuma lavagem em {mesLabel(ano, mes)}.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#1a1a2e" }}>
                  {["DATA","PLACA CAVALO/TRUCK","PLACA CARRETA","LAVAÇÃO EXTERNO","COMPLETO","CONFIRMAÇÃO"].map(h => (
                    <th key={h} style={{ padding: "10px 10px", textAlign: "left", fontWeight: 600, color: "#bbb", borderBottom: "1px solid #2a2a40", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lavagens.map((l, i) => (
                  <tr key={l.id} style={{ background: i % 2 === 0 ? "#111120" : "#0d0d1a" }}>
                    <td style={{ padding: "9px 10px", borderBottom: "1px solid #1e1e30" }}>
                      {new Date(l.data_hora).toLocaleDateString("pt-BR")}
                    </td>
                    <td style={{ padding: "9px 10px", borderBottom: "1px solid #1e1e30", fontFamily: "monospace" }}>
                      {l.placa_cavalo || "–"}
                    </td>
                    <td style={{ padding: "9px 10px", borderBottom: "1px solid #1e1e30", fontFamily: "monospace" }}>
                      {[l.placa_carreta, l.placa_carreta_2].filter(Boolean).join(" / ") || "–"}
                    </td>
                    <td style={{ padding: "9px 10px", borderBottom: "1px solid #1e1e30" }}>
                      {descricaoLavacao(l)}
                    </td>
                    <td style={{ padding: "9px 10px", borderBottom: "1px solid #1e1e30", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={l.completo}
                        disabled={!isGestor || salvando === l.id + "_completo"}
                        onChange={e => isGestor && toggleCompleto(l.id, e.target.checked)}
                        style={{ width: 16, height: 16, cursor: isGestor ? "pointer" : "default", accentColor: "#6D5CF5" }}
                      />
                    </td>
                    <td style={{ padding: "9px 10px", borderBottom: "1px solid #1e1e30", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={l.confirmado_joao}
                        disabled={!isGestor || salvando === l.id + "_conf"}
                        onChange={e => isGestor && toggleConfirmado(l.id, e.target.checked)}
                        style={{ width: 16, height: 16, cursor: isGestor ? "pointer" : "default", accentColor: "#22c55e" }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p style={{ marginTop: 16, fontSize: 11, color: "#555", textAlign: "right" }}>
          {lavagens.length} registro(s) em {mesLabel(ano, mes)}
        </p>
      </div>
    </div>
  );
}
