"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";

type Escopo = "ambos" | "cavalo" | "carreta" | "rodotrem" | "completar_rodotrem";

type ChatEstado =
  | "fechado"
  | "inicio"
  | "escolhendo_escopo"
  | "aguardando_cavalo"
  | "aguardando_carreta"
  | "processando"
  | "confirmacao"
  | "salvando"
  | "sucesso";

interface Mensagem {
  id: string;
  de: "bot" | "user";
  texto?: string;
  imagem?: string;
  carregando?: boolean;
}

function fileParaBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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
      {msg.imagem ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={msg.imagem}
          alt="foto"
          className="max-w-[60%] rounded-2xl rounded-br-sm shadow object-cover"
          style={{ maxHeight: 180 }}
        />
      ) : (
        <div
          className="max-w-[78%] rounded-2xl rounded-br-sm px-4 py-2 text-sm text-white font-medium"
          style={{ background: "#6D5CF5", boxShadow: "0 0 12px rgba(109,92,245,0.35)" }}
        >
          {msg.texto}
        </div>
      )}
    </div>
  );
}

export default function ChatLavagem({ onLavagemSalva }: { onLavagemSalva?: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<ChatEstado>("fechado");
  const [escopo, setEscopo] = useState<Escopo>("ambos");
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [fotoCavalo, setFotoCavalo] = useState<File | null>(null);
  const [fotoCarreta, setFotoCarreta] = useState<File | null>(null);
  const [placaCavalo, setPlacaCavalo] = useState("");
  const [placaCarreta, setPlacaCarreta] = useState("");
  const [placaCarreta2, setPlacaCarreta2] = useState("");
  const [tipo, setTipo] = useState<"bau" | "sider" | "rodotrem" | null>(null);
  const [erroCampos, setErroCampos] = useState("");

  const inputCavaloRef = useRef<HTMLInputElement>(null);
  const inputCarretaRef = useRef<HTMLInputElement>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const fotoCavaloRef = useRef<File | null>(null);
  const escopoRef = useRef<Escopo>("ambos");

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

  function resetarCampos() {
    setFotoCavalo(null);
    setFotoCarreta(null);
    fotoCavaloRef.current = null;
    setPlacaCavalo("");
    setPlacaCarreta("");
    setPlacaCarreta2("");
    setTipo(null);
    setErroCampos("");
    if (inputCavaloRef.current) inputCavaloRef.current.value = "";
    if (inputCarretaRef.current) inputCarretaRef.current.value = "";
  }

  function abrirChat() {
    setAberto(true);
    if (estado === "fechado") {
      setEstado("escolhendo_escopo");
      setMensagens([]);
      setTimeout(() => {
        addMensagem({ de: "bot", texto: "Olá! O que você vai registrar hoje?" });
      }, 300);
    }
  }

  function fecharChat() {
    setAberto(false);
  }

  function novaLavagem() {
    resetarCampos();
    setMensagens([]);
    setEstado("escolhendo_escopo");
    setTimeout(() => {
      addMensagem({ de: "bot", texto: "O que você vai registrar agora?" });
    }, 100);
  }

  function escolherEscopo(e: Escopo) {
    setEscopo(e);
    escopoRef.current = e;
    const labels: Record<Escopo, string> = {
      ambos: "Cavalo + Carreta",
      cavalo: "Só o cavalo",
      carreta: "Só a carreta",
      rodotrem: "Rodotrem",
      completar_rodotrem: "Completar Rodotrem",
    };
    addMensagem({ de: "user", texto: labels[e] });

    setTimeout(() => {
      if (e === "ambos" || e === "cavalo" || e === "rodotrem") {
        addMensagem({ de: "bot", texto: "Toque no ＋ para enviar a foto da placa do cavalo." });
        setEstado("aguardando_cavalo");
      } else {
        addMensagem({ de: "bot", texto: "Toque no ＋ para enviar a foto da placa da carreta." });
        setEstado("aguardando_carreta");
      }
    }, 300);
  }

  async function handleFotoCavalo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoCavalo(file);
    fotoCavaloRef.current = file;
    addMensagem({ de: "user", imagem: URL.createObjectURL(file) });
    if (inputCavaloRef.current) inputCavaloRef.current.value = "";

    const escopoAtual = escopoRef.current;

    if (escopoAtual === "ambos" || escopoAtual === "rodotrem") {
      setEstado("aguardando_carreta");
      setTimeout(() => {
        addMensagem({ de: "bot", texto: "Foto do cavalo recebida! Agora envie a foto da placa da carreta." });
      }, 400);
    } else {
      // escopo = cavalo: processa só a placa do cavalo
      await new Promise(r => setTimeout(r, 400));
      const idSpinner = addMensagem({ de: "bot", texto: "Identificando a placa...", carregando: true });
      setEstado("processando");
      await processarUmaPlaca(file, "cavalo", idSpinner);
    }
  }

  async function handleFotoCarreta(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoCarreta(file);
    addMensagem({ de: "user", imagem: URL.createObjectURL(file) });
    if (inputCarretaRef.current) inputCarretaRef.current.value = "";

    const escopoAtual = escopoRef.current;
    await new Promise(r => setTimeout(r, 400));

    if (escopoAtual === "ambos") {
      const idSpinner = addMensagem({ de: "bot", texto: "Identificando as placas...", carregando: true });
      setEstado("processando");
      await processarDuasPlacas(file, idSpinner);
    } else {
      // escopo = carreta: processa só a placa da carreta
      const idSpinner = addMensagem({ de: "bot", texto: "Identificando a placa...", carregando: true });
      setEstado("processando");
      await processarUmaPlaca(file, "carreta", idSpinner);
    }
  }

  // Envia as duas fotos para a edge function (escopo = ambos)
  async function processarDuasPlacas(fileCarreta: File, idSpinner: string) {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const cavaloAtual = fotoCavaloRef.current;
      if (!cavaloAtual) throw new Error("Foto do cavalo não encontrada");

      const [b64Cavalo, b64Carreta] = await Promise.all([
        fileParaBase64(cavaloAtual),
        fileParaBase64(fileCarreta),
      ]);

      const resp = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/extrair-placas`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ foto_cavalo: b64Cavalo, foto_carreta: b64Carreta }),
        }
      );
      const json = await resp.json();
      atualizarMensagem(idSpinner, { carregando: false, texto: "Placas identificadas! Confira e corrija se precisar:" });
      setPlacaCavalo(json.placa_cavalo ?? "");
      setPlacaCarreta(json.placa_carreta ?? "");
      setEstado("confirmacao");
    } catch {
      atualizarMensagem(idSpinner, { carregando: false, texto: "Não consegui ler as placas. Preencha manualmente abaixo:" });
      setPlacaCavalo("");
      setPlacaCarreta("");
      setEstado("confirmacao");
    }
  }

  // Envia uma foto para a edge function passando a mesma como cavalo (a IA lê o campo placa_cavalo)
  async function processarUmaPlaca(file: File, campo: "cavalo" | "carreta", idSpinner: string) {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const b64 = await fileParaBase64(file);

      // Enviamos a foto no campo foto_cavalo para os dois lados — a IA retorna placa_cavalo
      // Para carreta-único usamos o mesmo truque e depois mapeamos pro campo certo
      const resp = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/extrair-placas`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ foto_cavalo: b64, foto_carreta: b64 }),
        }
      );
      const json = await resp.json();
      const placa = json.placa_cavalo ?? "";

      atualizarMensagem(idSpinner, { carregando: false, texto: "Placa identificada! Confira e corrija se precisar:" });
      if (campo === "cavalo") {
        setPlacaCavalo(placa);
      } else {
        setPlacaCarreta(placa);
      }
      setEstado("confirmacao");
    } catch {
      atualizarMensagem(idSpinner, { carregando: false, texto: "Não consegui ler a placa. Preencha manualmente abaixo:" });
      if (campo === "cavalo") setPlacaCavalo(""); else setPlacaCarreta("");
      setEstado("confirmacao");
    }
  }

  async function salvar() {
    // Validação conforme escopo
    if ((escopo === "ambos" || escopo === "cavalo" || escopo === "rodotrem") && !placaCavalo.trim()) {
      setErroCampos("Preencha a placa do cavalo."); return;
    }
    if ((escopo === "ambos" || escopo === "carreta" || escopo === "rodotrem" || escopo === "completar_rodotrem") && !placaCarreta.trim()) {
      setErroCampos("Preencha a placa da carreta."); return;
    }
    if (escopo === "rodotrem" && !placaCarreta2.trim()) {
      setErroCampos("Preencha a placa da 2ª carreta."); return;
    }
    if ((escopo === "ambos" || escopo === "carreta") && !tipo) {
      setErroCampos("Selecione o tipo: Baú, Sider ou Rodotrem."); return;
    }

    setErroCampos("");
    setEstado("salvando");
    const idSalvando = addMensagem({ de: "bot", texto: "Salvando lavagem...", carregando: true });

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const ts = Date.now();

      // Upload só das fotos que existem
      const uploads: Promise<unknown>[] = [];
      const pathCavalo = `${session.user.id}/cavalo-${ts}.jpg`;
      const pathCarreta = `${session.user.id}/carreta-${ts}.jpg`;

      if (fotoCavalo) {
        uploads.push(supabase.storage.from("fotos-lavagens").upload(pathCavalo, fotoCavalo, { contentType: "image/jpeg", upsert: true }));
      }
      if (fotoCarreta) {
        uploads.push(supabase.storage.from("fotos-lavagens").upload(pathCarreta, fotoCarreta, { contentType: "image/jpeg", upsert: true }));
      }
      await Promise.all(uploads);

      const urlCavalo = fotoCavalo
        ? supabase.storage.from("fotos-lavagens").getPublicUrl(pathCavalo).data.publicUrl
        : null;
      const urlCarreta = fotoCarreta
        ? supabase.storage.from("fotos-lavagens").getPublicUrl(pathCarreta).data.publicUrl
        : null;

      // Monta o registro respeitando nulls por escopo
      const escopoDb = escopo === "rodotrem" ? "ambos" : escopo === "completar_rodotrem" ? "carreta" : escopo;
      const tipoDb = escopo === "rodotrem" || escopo === "completar_rodotrem" ? "rodotrem" : tipo;

      const registro = {
        escopo: escopoDb,
        registrado_por: session.user.id,
        placa_cavalo: (escopoDb === "ambos" || escopoDb === "cavalo") ? placaCavalo.trim().toUpperCase() : null,
        placa_carreta: (escopoDb === "ambos" || escopoDb === "carreta") ? placaCarreta.trim().toUpperCase() : null,
        placa_carreta2: escopo === "rodotrem" ? placaCarreta2.trim().toUpperCase() : null,
        tipo: tipoDb,
        foto_cavalo_url: urlCavalo,
        foto_carreta_url: urlCarreta,
      };

      const { error } = await supabase.from("lavagens").insert(registro);
      if (error) throw error;

      // Mensagem de sucesso adaptada ao escopo
      const tipoLabel = tipo === "bau" ? "Baú" : tipo === "sider" ? "Sider" : "Rodotrem";
      let resumo = "";
      if (escopo === "rodotrem") {
        resumo = `${placaCavalo.trim().toUpperCase()} / ${placaCarreta.trim().toUpperCase()} / ${placaCarreta2.trim().toUpperCase()} — Rodotrem`;
      } else if (escopo === "completar_rodotrem") {
        resumo = `2ª Carreta: ${placaCarreta.trim().toUpperCase()} — Rodotrem`;
      } else if (escopo === "ambos") {
        resumo = `${placaCavalo.trim().toUpperCase()} / ${placaCarreta.trim().toUpperCase()} — ${tipoLabel}`;
      } else if (escopo === "cavalo") {
        resumo = `Cavalo: ${placaCavalo.trim().toUpperCase()}`;
      } else {
        resumo = `Carreta: ${placaCarreta.trim().toUpperCase()} — ${tipoLabel}`;
      }

      atualizarMensagem(idSalvando, { carregando: false, texto: `✅ Lavagem registrada! ${resumo}` });
      setEstado("sucesso");
      onLavagemSalva?.();
    } catch {
      atualizarMensagem(idSalvando, { carregando: false, texto: "❌ Erro ao salvar. Tente novamente." });
      setEstado("confirmacao");
    }
  }

  function handlePlusTap() {
    if (estado === "aguardando_cavalo") inputCavaloRef.current?.click();
    else if (estado === "aguardando_carreta") inputCarretaRef.current?.click();
  }

  const mostrarPlus = estado === "aguardando_cavalo" || estado === "aguardando_carreta";

  // Texto do placeholder da barra inferior
  const textoPlaceholder =
    estado === "aguardando_cavalo" ? "Enviar foto da placa do cavalo..." :
    estado === "aguardando_carreta" ? "Enviar foto da placa da carreta..." :
    estado === "processando" || estado === "salvando" ? "Aguarde..." :
    estado === "sucesso" ? "Lavagem registrada ✅" : "";

  return (
    <>
      <input ref={inputCavaloRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoCavalo} />
      <input ref={inputCarretaRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoCarreta} />

      {/* Botão flutuante */}
      {!aberto && (
        <button
          onClick={abrirChat}
          className="fixed bottom-6 right-5 z-50 w-14 h-14 text-white rounded-full flex items-center justify-center transition-colors"
          style={{ background: "#6D5CF5", boxShadow: "0 0 24px rgba(109,92,245,0.5)" }}
          aria-label="Registrar lavagem via chat"
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3-3-3z" />
          </svg>
        </button>
      )}

      {/* Painel do chat */}
      {aberto && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ maxWidth: 480, margin: "0 auto", background: "#050507" }}>
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center gap-3"
            style={{ background: "#0D0D12", borderBottom: "1px solid #1D1D26" }}
          >
            <button onClick={fecharChat} className="p-1 -ml-1 text-[#9090A0]">
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
              <p className="font-semibold text-sm text-white leading-tight">Registrar Lavagem</p>
              <p className="text-[#9090A0] text-xs">Lava-Jato Tomasi</p>
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
                  {(["ambos", "cavalo", "carreta", "rodotrem", "completar_rodotrem"] as Escopo[]).map((e) => {
                    const labels: Record<Escopo, string> = {
                      ambos: "🚛 Cavalo + Carreta",
                      cavalo: "🚚 Só o cavalo",
                      carreta: "🔗 Só a carreta",
                      rodotrem: "🚛 Rodotrem",
                      completar_rodotrem: "➕ Completar Rodotrem",
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
                </div>
              </div>
            )}

            {/* Formulário de confirmação inline */}
            {estado === "confirmacao" && (
              <div className="flex items-end gap-2 mb-3">
                <div
                  className="w-7 h-7 rounded-full flex-shrink-0 mb-1"
                  style={{ background: "rgba(109,92,245,0.2)", border: "1px solid rgba(109,92,245,0.4)" }}
                />
                <div
                  className="max-w-[85%] rounded-2xl rounded-bl-sm p-4 space-y-3"
                  style={{ background: "#0D0D12", border: "1px solid #1D1D26" }}
                >
                  {erroCampos && (
                    <p className="text-xs text-red-400 font-medium">{erroCampos}</p>
                  )}

                  {/* Placa do cavalo */}
                  {(escopo === "ambos" || escopo === "cavalo" || escopo === "rodotrem") && (
                    <div>
                      <label className="block text-xs font-semibold text-[#8B7CF8] tracking-widest mb-1">PLACA DO CAVALO</label>
                      <input
                        type="text"
                        value={placaCavalo}
                        onChange={e => setPlacaCavalo(e.target.value.toUpperCase())}
                        placeholder="ABC1234"
                        maxLength={8}
                        className="w-full rounded-xl px-3 py-2 text-base font-mono uppercase text-white focus:outline-none focus:ring-2 focus:ring-[#6D5CF5]"
                        style={{ background: "#050507", border: "1px solid #1D1D26" }}
                      />
                    </div>
                  )}

                  {/* Placa da carreta */}
                  {(escopo === "ambos" || escopo === "carreta" || escopo === "rodotrem" || escopo === "completar_rodotrem") && (
                    <div>
                      <label className="block text-xs font-semibold text-[#8B7CF8] tracking-widest mb-1">
                        {escopo === "completar_rodotrem" ? "PLACA DA 2ª CARRETA" : "PLACA DA CARRETA"}
                      </label>
                      <input
                        type="text"
                        value={placaCarreta}
                        onChange={e => setPlacaCarreta(e.target.value.toUpperCase())}
                        placeholder="ABC1234"
                        maxLength={8}
                        className="w-full rounded-xl px-3 py-2 text-base font-mono uppercase text-white focus:outline-none focus:ring-2 focus:ring-[#6D5CF5]"
                        style={{ background: "#050507", border: "1px solid #1D1D26" }}
                      />
                    </div>
                  )}

                  {/* Placa da 2ª carreta — só para rodotrem */}
                  {escopo === "rodotrem" && (
                    <div>
                      <label className="block text-xs font-semibold text-[#8B7CF8] tracking-widest mb-1">PLACA DA 2ª CARRETA</label>
                      <input
                        type="text"
                        value={placaCarreta2}
                        onChange={e => setPlacaCarreta2(e.target.value.toUpperCase())}
                        placeholder="ABC1234"
                        maxLength={8}
                        className="w-full rounded-xl px-3 py-2 text-base font-mono uppercase text-white focus:outline-none focus:ring-2 focus:ring-[#6D5CF5]"
                        style={{ background: "#050507", border: "1px solid #1D1D26" }}
                      />
                    </div>
                  )}

                  {/* Tipo — só para ambos ou carreta (não para rodotrem/completar_rodotrem) */}
                  {(escopo === "ambos" || escopo === "carreta") && (
                    <div>
                      <label className="block text-xs font-semibold text-[#8B7CF8] tracking-widest mb-2">TIPO DE CARRETA</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => setTipo("bau")}
                          className="py-3 rounded-xl font-semibold text-sm transition-colors"
                          style={tipo === "bau"
                            ? { background: "#6D5CF5", color: "#fff", boxShadow: "0 0 14px rgba(109,92,245,0.4)", border: "1px solid #6D5CF5" }
                            : { background: "transparent", color: "#8B7CF8", border: "1px solid rgba(109,92,245,0.35)" }}
                        >Baú</button>
                        <button
                          onClick={() => setTipo("sider")}
                          className="py-3 rounded-xl font-semibold text-sm transition-colors"
                          style={tipo === "sider"
                            ? { background: "#6D5CF5", color: "#fff", boxShadow: "0 0 14px rgba(109,92,245,0.4)", border: "1px solid #6D5CF5" }
                            : { background: "transparent", color: "#8B7CF8", border: "1px solid rgba(109,92,245,0.35)" }}
                        >Sider</button>
                        <button
                          onClick={() => setTipo("rodotrem")}
                          className="py-3 rounded-xl font-semibold text-sm transition-colors"
                          style={tipo === "rodotrem"
                            ? { background: "#6D5CF5", color: "#fff", boxShadow: "0 0 14px rgba(109,92,245,0.4)", border: "1px solid #6D5CF5" }
                            : { background: "transparent", color: "#8B7CF8", border: "1px solid rgba(109,92,245,0.35)" }}
                        >Rodotrem</button>
                      </div>

                      {tipo === "rodotrem" && (
                        <div className="mt-3">
                          <label className="block text-xs font-semibold text-[#8B7CF8] tracking-widest mb-1">PLACA DA 2ª CARRETA</label>
                          <input
                            type="text"
                            value={placaCarreta2}
                            onChange={e => setPlacaCarreta2(e.target.value.toUpperCase())}
                            placeholder="ABC1234"
                            maxLength={8}
                            className="w-full rounded-xl px-3 py-2 text-base font-mono uppercase text-white focus:outline-none focus:ring-2 focus:ring-[#6D5CF5]"
                            style={{ background: "#050507", border: "1px solid #1D1D26" }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={salvar}
                    disabled={
                      ((escopo === "ambos" || escopo === "cavalo" || escopo === "rodotrem") && !placaCavalo.trim()) ||
                      ((escopo === "ambos" || escopo === "carreta" || escopo === "rodotrem" || escopo === "completar_rodotrem") && !placaCarreta.trim()) ||
                      (escopo === "rodotrem" && !placaCarreta2.trim()) ||
                      ((escopo === "ambos" || escopo === "carreta") && !tipo)
                    }
                    className="w-full text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-50 transition-colors"
                    style={{ background: "#6D5CF5", boxShadow: "0 0 18px rgba(109,92,245,0.4)" }}
                  >
                    Confirmar e Salvar
                  </button>
                </div>
              </div>
            )}

            {/* Botão nova lavagem após sucesso */}
            {estado === "sucesso" && (
              <div className="flex justify-center mt-4">
                <button
                  onClick={novaLavagem}
                  className="text-white text-sm font-semibold px-6 py-3 rounded-full transition-colors"
                  style={{ background: "#6D5CF5", boxShadow: "0 0 18px rgba(109,92,245,0.4)" }}
                >
                  Nova Lavagem
                </button>
              </div>
            )}

            <div ref={fimRef} />
          </div>

          {/* Barra inferior */}
          <div
            className="px-3 py-2 flex items-center gap-2"
            style={{ background: "#0D0D12", borderTop: "1px solid #1D1D26" }}
          >
            {mostrarPlus ? (
              <>
                <button
                  onClick={handlePlusTap}
                  className="w-10 h-10 text-white rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                  style={{ background: "#6D5CF5", boxShadow: "0 0 12px rgba(109,92,245,0.4)" }}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <div
                  className="flex-1 rounded-full px-4 py-2 text-sm text-[#9090A0]"
                  style={{ background: "#050507", border: "1px solid #1D1D26" }}
                >
                  {textoPlaceholder}
                </div>
              </>
            ) : (
              <div
                className="flex-1 rounded-full px-4 py-2 text-sm text-[#9090A0]"
                style={{ background: "#050507", border: "1px solid #1D1D26" }}
              >
                {textoPlaceholder}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
