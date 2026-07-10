"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";

// Chat exclusivo da aba "Minhas Lavagens" (tabela lavagens_maxwel).
// Reaproveita o visual do ChatLavagem, mas pede as placas por TEXTO (sem foto).
// Componente separado de propósito — não altera o ChatLavagem original.

type Escopo = "ambos" | "cavalo" | "carreta" | "truck" | "rodotrem";
type Modo = Escopo | "completar";
type Campo = "cavalo" | "carreta" | "carreta2";
type Estado = "escolhendo_escopo" | "aguardando_input" | "salvando" | "sucesso";

const VALOR_PADRAO = 30;
const VALOR_RODOTREM = 60;

interface Mensagem {
  id: string;
  de: "bot" | "user";
  texto?: string;
  carregando?: boolean;
}

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatarValor(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const LABEL_ESCOPO: Record<Escopo, string> = {
  ambos: "Cavalo + Carreta",
  cavalo: "Só o cavalo",
  carreta: "Só a carreta",
  truck: "Truck",
  rodotrem: "Rodotrem (1ª parte)",
};

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function BolhaBot({ msg }: { msg: Mensagem }) {
  return (
    <div className="flex items-end gap-2 mb-3">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mb-1"
        style={{ background: "rgba(109,92,245,0.2)", border: "1px solid rgba(109,92,245,0.4)" }}
      >
        <svg className="w-4 h-4 text-[#8B7CF8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 1h6l2-1z" />
        </svg>
      </div>
      <div
        className="max-w-[78%] rounded-2xl rounded-bl-sm px-4 py-2 text-sm text-white"
        style={{ background: "#0D0D12", border: "1px solid #1D1D26" }}
      >
        {msg.carregando ? (
          <span className="flex items-center gap-2 text-[#9090A0]">
            <Spinner /> {msg.texto}
          </span>
        ) : (
          <span>{msg.texto}</span>
        )}
      </div>
    </div>
  );
}

function BolhaUser({ msg }: { msg: Mensagem }) {
  return (
    <div className="flex justify-end mb-3">
      <div
        className="max-w-[78%] rounded-2xl rounded-br-sm px-4 py-2 text-sm text-white font-medium"
        style={{ background: "#6D5CF5", boxShadow: "0 0 12px rgba(109,92,245,0.35)" }}
      >
        {msg.texto}
      </div>
    </div>
  );
}

export default function ChatMinhasLavagens({ onRegistrado }: { onRegistrado?: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<Estado>("escolhendo_escopo");
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [input, setInput] = useState("");
  const [campoAtual, setCampoAtual] = useState<Campo | null>(null);

  const modoRef = useRef<Modo>("ambos");
  const filaRef = useRef<Campo[]>([]);
  const dadosRef = useRef<{ cavalo: string; carreta: string; carreta2: string }>({ cavalo: "", carreta: "", carreta2: "" });
  const fimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addMensagem = useCallback((msg: Omit<Mensagem, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setMensagens(prev => [...prev, { ...msg, id }]);
    return id;
  }, []);

  const atualizarMensagem = useCallback((id: string, patch: Partial<Mensagem>) => {
    setMensagens(prev => prev.map(m => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, estado]);

  useEffect(() => {
    if (estado === "aguardando_input") inputRef.current?.focus();
  }, [estado, campoAtual]);

  function resetar() {
    filaRef.current = [];
    dadosRef.current = { cavalo: "", carreta: "", carreta2: "" };
    setCampoAtual(null);
    setInput("");
  }

  function abrirChat() {
    setAberto(true);
    resetar();
    setMensagens([]);
    setEstado("escolhendo_escopo");
    setTimeout(() => {
      addMensagem({ de: "bot", texto: "Olá! O que você vai registrar hoje?" });
    }, 200);
  }

  function fecharChat() {
    setAberto(false);
  }

  function novaLavagem() {
    resetar();
    setMensagens([]);
    setEstado("escolhendo_escopo");
    setTimeout(() => {
      addMensagem({ de: "bot", texto: "O que você vai registrar agora?" });
    }, 100);
  }

  function promptCampo(campo: Campo): string {
    if (campo === "cavalo") return modoRef.current === "truck" ? "Digite a placa do truck." : "Digite a placa do cavalo.";
    if (campo === "carreta") return "Digite a placa da carreta.";
    return "Digite a placa da 2ª carreta.";
  }

  function iniciarFila(fila: Campo[]) {
    filaRef.current = [...fila];
    const primeiro = filaRef.current[0];
    setCampoAtual(primeiro);
    setEstado("aguardando_input");
    setTimeout(() => addMensagem({ de: "bot", texto: promptCampo(primeiro) }), 300);
  }

  function escolherEscopo(e: Escopo) {
    modoRef.current = e;
    dadosRef.current = { cavalo: "", carreta: "", carreta2: "" };
    addMensagem({ de: "user", texto: LABEL_ESCOPO[e] });
    if (e === "ambos" || e === "rodotrem") iniciarFila(["cavalo", "carreta"]);
    else if (e === "cavalo" || e === "truck") iniciarFila(["cavalo"]);
    else iniciarFila(["carreta"]); // carreta
  }

  function iniciarCompletar() {
    modoRef.current = "completar";
    dadosRef.current = { cavalo: "", carreta: "", carreta2: "" };
    addMensagem({ de: "user", texto: "Completar rodotrem (2ª carreta)" });
    iniciarFila(["carreta2"]);
  }

  function enviarTexto(e?: React.FormEvent) {
    e?.preventDefault();
    const val = input.trim().toUpperCase();
    if (!val || !campoAtual) return;
    addMensagem({ de: "user", texto: val });
    dadosRef.current[campoAtual] = val;
    setInput("");

    filaRef.current = filaRef.current.slice(1);
    const proximo = filaRef.current[0];
    if (proximo) {
      setCampoAtual(proximo);
      setTimeout(() => addMensagem({ de: "bot", texto: promptCampo(proximo) }), 300);
    } else {
      setCampoAtual(null);
      finalizar();
    }
  }

  async function finalizar() {
    setEstado("salvando");
    const modo = modoRef.current;
    const { cavalo, carreta, carreta2 } = dadosRef.current;

    // Completar rodotrem: NÃO cria registro novo; anexa a 2ª carreta como nota no rodotrem
    // mais recente lançado hoje. Sem cobrança extra (já incluída no valor 60).
    if (modo === "completar") {
      const idMsg = addMensagem({ de: "bot", texto: "Anexando 2ª carreta...", carregando: true });
      try {
        const supabase = createClient();
        const hoje = hojeISO();
        const { data: rows } = await supabase
          .from("lavagens_maxwel")
          .select("id, observacao, placa_cavalo, placa_carreta")
          .eq("escopo", "rodotrem").eq("data", hoje).eq("excluido", false)
          .order("created_at", { ascending: false }).limit(1);
        const alvo = rows?.[0];
        if (!alvo) {
          atualizarMensagem(idMsg, { carregando: false, texto: "Nenhum rodotrem lançado hoje para completar. Registre a 1ª parte primeiro." });
          setEstado("sucesso");
          return;
        }
        const nota = `2ª carreta: ${carreta2}`;
        const novaObs = alvo.observacao ? `${alvo.observacao} | ${nota}` : nota;
        const { error } = await supabase.from("lavagens_maxwel").update({ observacao: novaObs }).eq("id", alvo.id);
        if (error) throw error;
        atualizarMensagem(idMsg, {
          carregando: false,
          texto: `✅ 2ª carreta ${carreta2} anexada ao rodotrem de hoje (${alvo.placa_cavalo ?? "—"} / ${alvo.placa_carreta ?? "—"}). Sem cobrança extra.`,
        });
        setEstado("sucesso");
        onRegistrado?.();
      } catch {
        atualizarMensagem(idMsg, { carregando: false, texto: "❌ Erro ao anexar. Tente novamente." });
        setEstado("sucesso");
      }
      return;
    }

    // Demais escopos: cria registro em lavagens_maxwel
    const valor = modo === "rodotrem" ? VALOR_RODOTREM : VALOR_PADRAO;
    const placaCavalo = (modo === "ambos" || modo === "cavalo" || modo === "truck" || modo === "rodotrem") ? (cavalo || null) : null;
    const placaCarreta = (modo === "ambos" || modo === "carreta" || modo === "rodotrem") ? (carreta || null) : null;

    const idMsg = addMensagem({ de: "bot", texto: "Salvando lavagem...", carregando: true });
    try {
      const supabase = createClient();
      const { error } = await supabase.from("lavagens_maxwel").insert({
        data: hojeISO(),
        placa_cavalo: placaCavalo,
        placa_carreta: placaCarreta,
        tipo: null,
        escopo: modo,
        valor,
        observacao: null,
      });
      if (error) throw error;

      let placas = "";
      if (modo === "ambos" || modo === "rodotrem") placas = `${placaCavalo} / ${placaCarreta}`;
      else if (modo === "cavalo" || modo === "truck") placas = placaCavalo ?? "";
      else placas = placaCarreta ?? "";

      atualizarMensagem(idMsg, {
        carregando: false,
        texto: `✅ Lavagem registrada: ${placas} — ${formatarValor(valor)}`,
      });
      setEstado("sucesso");
      onRegistrado?.();
    } catch {
      atualizarMensagem(idMsg, { carregando: false, texto: "❌ Erro ao salvar. Tente novamente." });
      setEstado("sucesso");
    }
  }

  const textoPlaceholder =
    campoAtual === "cavalo" ? (modoRef.current === "truck" ? "Digite a placa do truck..." : "Digite a placa do cavalo...") :
    campoAtual === "carreta" ? "Digite a placa da carreta..." :
    campoAtual === "carreta2" ? "Digite a placa da 2ª carreta..." :
    estado === "salvando" ? "Aguarde..." :
    estado === "sucesso" ? "Registro concluído ✅" : "";

  return (
    <>
      {/* Botão que abre o chat (no lugar do formulário manual) */}
      <button onClick={abrirChat} className="btn-primary w-full">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3-3-3z" />
        </svg>
        Registrar lavagem
      </button>

      {/* Painel do chat */}
      {aberto && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ maxWidth: 480, margin: "0 auto", background: "#050507" }}>
          {/* Header */}
          <div className="px-4 py-3 flex items-center gap-3" style={{ background: "#0D0D12", borderBottom: "1px solid #1D1D26" }}>
            <button onClick={fecharChat} className="p-1 -ml-1 text-[#9090A0]" aria-label="Fechar chat">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(109,92,245,0.15)", border: "1px solid rgba(109,92,245,0.4)" }}
            >
              <svg className="w-5 h-5 text-[#8B7CF8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 1h6l2-1z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-sm text-white leading-tight">Minhas Lavagens</p>
              <p className="text-[#9090A0] text-xs">Registro por texto</p>
            </div>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto px-3 py-4">
            {mensagens.map(msg =>
              msg.de === "bot"
                ? <BolhaBot key={msg.id} msg={msg} />
                : <BolhaUser key={msg.id} msg={msg} />
            )}

            {/* Botões de escolha de escopo */}
            {estado === "escolhendo_escopo" && (
              <div className="flex items-end gap-2 mb-3">
                <div
                  className="w-7 h-7 rounded-full flex-shrink-0 mb-1"
                  style={{ background: "rgba(109,92,245,0.2)", border: "1px solid rgba(109,92,245,0.4)" }}
                />
                <div className="flex flex-col gap-2 max-w-[85%]">
                  {(["ambos", "cavalo", "carreta", "truck", "rodotrem"] as Escopo[]).map((e) => {
                    const labels: Record<Escopo, string> = {
                      ambos: "🚛 Cavalo + Carreta",
                      cavalo: "🚚 Só o cavalo",
                      carreta: "🔗 Só a carreta",
                      truck: "🚐 Truck",
                      rodotrem: "🚛🔗 Rodotrem (1ª parte)",
                    };
                    return (
                      <button
                        key={e}
                        onClick={() => escolherEscopo(e)}
                        className="text-left px-4 py-3 rounded-2xl text-sm font-semibold text-[#8B7CF8] transition-colors"
                        style={{ background: "rgba(109,92,245,0.10)", border: "1px solid rgba(109,92,245,0.35)" }}
                      >
                        {labels[e]}
                      </button>
                    );
                  })}
                  <button
                    onClick={iniciarCompletar}
                    className="text-left px-4 py-3 rounded-2xl text-sm font-semibold text-[#2F9E6F] transition-colors"
                    style={{ background: "rgba(47,158,111,0.10)", border: "1px solid rgba(47,158,111,0.35)" }}
                  >
                    ➕ Completar rodotrem (2ª carreta)
                  </button>
                </div>
              </div>
            )}

            {/* Botões após concluir um registro */}
            {estado === "sucesso" && (
              <div className="flex flex-col items-center gap-2 mt-4">
                <button
                  onClick={novaLavagem}
                  className="text-white text-sm font-semibold px-6 py-3 rounded-full transition-colors"
                  style={{ background: "#6D5CF5", boxShadow: "0 0 18px rgba(109,92,245,0.4)" }}
                >
                  Registrar outra
                </button>
                <button
                  onClick={fecharChat}
                  className="text-[#9090A0] text-sm font-semibold px-6 py-2 rounded-full transition-colors"
                >
                  Fechar
                </button>
              </div>
            )}

            <div ref={fimRef} />
          </div>

          {/* Barra inferior — input de texto quando aguardando placa */}
          <form onSubmit={enviarTexto} className="px-3 py-2 flex items-center gap-2" style={{ background: "#0D0D12", borderTop: "1px solid #1D1D26" }}>
            {estado === "aguardando_input" ? (
              <>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value.toUpperCase())}
                  maxLength={8}
                  placeholder={textoPlaceholder}
                  className="flex-1 rounded-full px-4 py-2 text-sm text-white font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#6D5CF5]"
                  style={{ background: "#050507", border: "1px solid #1D1D26" }}
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="w-10 h-10 text-white rounded-full flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-40"
                  style={{ background: "#6D5CF5", boxShadow: "0 0 12px rgba(109,92,245,0.4)" }}
                  aria-label="Enviar placa"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              </>
            ) : (
              <div
                className="flex-1 rounded-full px-4 py-2 text-sm text-[#9090A0]"
                style={{ background: "#050507", border: "1px solid #1D1D26" }}
              >
                {textoPlaceholder}
              </div>
            )}
          </form>
        </div>
      )}
    </>
  );
}
