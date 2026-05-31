"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";

type ChatEstado =
  | "fechado"
  | "inicio"
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
      <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mb-1">
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 1h6l2-1z" />
        </svg>
      </div>
      <div className="max-w-[78%] bg-white text-gray-800 rounded-2xl rounded-bl-sm px-4 py-2 shadow text-sm">
        {msg.carregando ? (
          <span className="flex items-center gap-2 text-gray-500">
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
        <img
          src={msg.imagem}
          alt="foto"
          className="max-w-[60%] rounded-2xl rounded-br-sm shadow object-cover"
          style={{ maxHeight: 180 }}
        />
      ) : (
        <div className="max-w-[78%] bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2 shadow text-sm">
          {msg.texto}
        </div>
      )}
    </div>
  );
}

export default function ChatLavagem({ onLavagemSalva }: { onLavagemSalva?: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<ChatEstado>("fechado");
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [fotoCavalo, setFotoCavalo] = useState<File | null>(null);
  const [fotoCarreta, setFotoCarreta] = useState<File | null>(null);
  const [placaCavalo, setPlacaCavalo] = useState("");
  const [placaCarreta, setPlacaCarreta] = useState("");
  const [tipo, setTipo] = useState<"bau" | "sider" | null>(null);
  const [erroCampos, setErroCampos] = useState("");

  const inputCavaloRef = useRef<HTMLInputElement>(null);
  const inputCarretaRef = useRef<HTMLInputElement>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const fotoCavaloRef = useRef<File | null>(null);

  const addMensagem = useCallback((msg: Omit<Mensagem, "id">) => {
    const nova = { ...msg, id: Math.random().toString(36).slice(2) };
    setMensagens(prev => [...prev, nova]);
    return nova.id;
  }, []);

  const atualizarMensagem = useCallback((id: string, patch: Partial<Mensagem>) => {
    setMensagens(prev => prev.map(m => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, estado]);

  function abrirChat() {
    setAberto(true);
    if (estado === "fechado") {
      setEstado("inicio");
      setMensagens([]);
      setTimeout(() => {
        addMensagem({ de: "bot", texto: "Olá! Toque no ＋ abaixo para enviar a foto da placa do cavalo." });
        setEstado("aguardando_cavalo");
      }, 300);
    }
  }

  function fecharChat() {
    setAberto(false);
  }

  function novaLavagem() {
    setEstado("aguardando_cavalo");
    setFotoCavalo(null);
    setFotoCarreta(null);
    fotoCavaloRef.current = null;
    setPlacaCavalo("");
    setPlacaCarreta("");
    setTipo(null);
    setErroCampos("");
    setMensagens([]);
    setTimeout(() => {
      addMensagem({ de: "bot", texto: "Tudo pronto! Toque no ＋ para enviar a foto da placa do cavalo." });
    }, 100);
  }

  async function handleFotoCavalo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoCavalo(file);
    fotoCavaloRef.current = file;
    const preview = URL.createObjectURL(file);
    addMensagem({ de: "user", imagem: preview });
    setEstado("aguardando_carreta");
    setTimeout(() => {
      addMensagem({ de: "bot", texto: "Foto do cavalo recebida! Agora envie a foto da placa da carreta." });
    }, 400);
    if (inputCavaloRef.current) inputCavaloRef.current.value = "";
  }

  async function handleFotoCarreta(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoCarreta(file);
    const preview = URL.createObjectURL(file);
    addMensagem({ de: "user", imagem: preview });
    setEstado("processando");
    if (inputCarretaRef.current) inputCarretaRef.current.value = "";

    // pequeno delay para o preview aparecer antes do spinner
    await new Promise(r => setTimeout(r, 400));
    const idSpinner = addMensagem({ de: "bot", texto: "Identificando as placas...", carregando: true });

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const cavaloAtual = fotoCavaloRef.current;
      if (!cavaloAtual) throw new Error("Foto do cavalo não encontrada");

      const [b64Cavalo, b64Carreta] = await Promise.all([
        fileParaBase64(cavaloAtual),
        fileParaBase64(file),
      ]);

      const resp = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/extrair-placas`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
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

  async function salvar() {
    if (!placaCavalo.trim() || !placaCarreta.trim()) {
      setErroCampos("Preencha as duas placas.");
      return;
    }
    if (!tipo) {
      setErroCampos("Selecione o tipo: Baú ou Sider.");
      return;
    }
    setErroCampos("");
    setEstado("salvando");
    const idSalvando = addMensagem({ de: "bot", texto: "Salvando lavagem...", carregando: true });

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const ts = Date.now();
      const pathCavalo = `${session.user.id}/cavalo-${ts}.jpg`;
      const pathCarreta = `${session.user.id}/carreta-${ts}.jpg`;

      const uploadCavalo = fotoCavalo
        ? supabase.storage.from("fotos-lavagens").upload(pathCavalo, fotoCavalo, { contentType: "image/jpeg", upsert: true })
        : Promise.resolve({ error: null });

      const uploadCarreta = fotoCarreta
        ? supabase.storage.from("fotos-lavagens").upload(pathCarreta, fotoCarreta, { contentType: "image/jpeg", upsert: true })
        : Promise.resolve({ error: null });

      await Promise.all([uploadCavalo, uploadCarreta]);

      const urlCavalo = fotoCavalo
        ? supabase.storage.from("fotos-lavagens").getPublicUrl(pathCavalo).data.publicUrl
        : null;
      const urlCarreta = fotoCarreta
        ? supabase.storage.from("fotos-lavagens").getPublicUrl(pathCarreta).data.publicUrl
        : null;

      const { error } = await supabase.from("lavagens").insert({
        placa_cavalo: placaCavalo.trim().toUpperCase(),
        placa_carreta: placaCarreta.trim().toUpperCase(),
        tipo,
        registrado_por: session.user.id,
        foto_cavalo_url: urlCavalo,
        foto_carreta_url: urlCarreta,
      });

      if (error) throw error;

      atualizarMensagem(idSalvando, {
        carregando: false,
        texto: `✅ Lavagem registrada! ${placaCavalo.trim().toUpperCase()} / ${placaCarreta.trim().toUpperCase()} — ${tipo === "bau" ? "Baú" : "Sider"}`,
      });
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

  return (
    <>
      {/* Inputs de câmera ocultos */}
      <input ref={inputCavaloRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoCavalo} />
      <input ref={inputCarretaRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoCarreta} />

      {/* Botão flutuante */}
      {!aberto && (
        <button
          onClick={abrirChat}
          className="fixed bottom-6 right-5 z-50 w-14 h-14 bg-blue-600 text-white rounded-full shadow-xl flex items-center justify-center active:bg-blue-700 transition-colors"
          aria-label="Registrar lavagem via chat"
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3-3-3z" />
          </svg>
        </button>
      )}

      {/* Painel do chat */}
      {aberto && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#ece5dd]" style={{ maxWidth: 480, margin: "0 auto" }}>
          {/* Header */}
          <div className="bg-blue-700 text-white px-4 py-3 flex items-center gap-3 shadow">
            <button onClick={fecharChat} className="p-1 -ml-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 1h6l2-1z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">Registrar Lavagem</p>
              <p className="text-blue-200 text-xs">Lava-Jato Tomasi</p>
            </div>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
            {mensagens.map(msg =>
              msg.de === "bot"
                ? <BolhaBot key={msg.id} msg={msg} />
                : <BolhaUser key={msg.id} msg={msg} />
            )}

            {/* Formulário de confirmação inline */}
            {estado === "confirmacao" && (
              <div className="flex items-end gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-blue-600 flex-shrink-0 mb-1" />
                <div className="max-w-[85%] bg-white rounded-2xl rounded-bl-sm shadow p-4 space-y-3">
                  {erroCampos && (
                    <p className="text-xs text-red-600 font-medium">{erroCampos}</p>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">PLACA DO CAVALO</label>
                    <input
                      type="text"
                      value={placaCavalo}
                      onChange={e => setPlacaCavalo(e.target.value.toUpperCase())}
                      placeholder="ABC1234"
                      maxLength={8}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-base font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">PLACA DA CARRETA</label>
                    <input
                      type="text"
                      value={placaCarreta}
                      onChange={e => setPlacaCarreta(e.target.value.toUpperCase())}
                      placeholder="ABC1234"
                      maxLength={8}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-base font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-2">TIPO DE CARRETA</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setTipo("bau")}
                        className={`py-3 rounded-xl font-semibold text-sm border-2 transition-colors ${tipo === "bau" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200"}`}
                      >
                        Baú
                      </button>
                      <button
                        onClick={() => setTipo("sider")}
                        className={`py-3 rounded-xl font-semibold text-sm border-2 transition-colors ${tipo === "sider" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200"}`}
                      >
                        Sider
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={salvar}
                    disabled={!tipo || !placaCavalo.trim() || !placaCarreta.trim()}
                    className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-50 active:bg-green-700 transition-colors"
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
                  className="bg-blue-600 text-white text-sm font-semibold px-6 py-3 rounded-full shadow active:bg-blue-700 transition-colors"
                >
                  Nova Lavagem
                </button>
              </div>
            )}

            <div ref={fimRef} />
          </div>

          {/* Barra inferior */}
          <div className="bg-[#f0f0f0] px-3 py-2 flex items-center gap-2 border-t border-gray-300">
            {mostrarPlus ? (
              <>
                <button
                  onClick={handlePlusTap}
                  className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center shadow active:bg-blue-700 transition-colors flex-shrink-0"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <div className="flex-1 bg-white rounded-full px-4 py-2 text-sm text-gray-400 shadow-inner">
                  {estado === "aguardando_cavalo" ? "Enviar foto da placa do cavalo..." : "Enviar foto da placa da carreta..."}
                </div>
              </>
            ) : (
              <div className="flex-1 bg-white rounded-full px-4 py-2 text-sm text-gray-300 shadow-inner">
                {estado === "processando" || estado === "salvando" ? "Aguarde..." : estado === "sucesso" ? "Lavagem registrada ✅" : ""}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
