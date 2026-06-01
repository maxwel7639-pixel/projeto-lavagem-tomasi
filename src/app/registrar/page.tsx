"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import ChatLavagem from "@/components/ChatLavagem";
import LogoMX from "@/components/LogoMX";

type Etapa = "inicio" | "foto-cavalo" | "foto-carreta" | "processando" | "confirmacao" | "salvando" | "sucesso";

function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function fileParaBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function RegistrarPage() {
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>("inicio");
  const [fotoCavalo, setFotoCavalo] = useState<File | null>(null);
  const [fotoCarreta, setFotoCarreta] = useState<File | null>(null);
  const [previewCavalo, setPreviewCavalo] = useState<string | null>(null);
  const [previewCarreta, setPreviewCarreta] = useState<string | null>(null);
  const [placaCavalo, setPlacaCavalo] = useState("");
  const [placaCarreta, setPlacaCarreta] = useState("");
  const [tipo, setTipo] = useState<"bau" | "sider" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [autenticado, setAutenticado] = useState(false);
  const inputCavaloRef = useRef<HTMLInputElement>(null);
  const inputCarretaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelado = false;
    async function checar() {
      const supabase = createClient();
      await supabase.auth.getSession();
      if (cancelado) return;
      setAutenticado(true);
    }
    checar();
    return () => { cancelado = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFotoCavalo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoCavalo(file);
    setPreviewCavalo(URL.createObjectURL(file));
    setEtapa("foto-carreta");
  }

  function handleFotoCarreta(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoCarreta(file);
    setPreviewCarreta(URL.createObjectURL(file));
    processarPlacas(fotoCavalo!, file);
  }

  async function processarPlacas(cavalo: File, carreta: File) {
    setEtapa("processando");
    setErro(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const [base64Cavalo, base64Carreta] = await Promise.all([
        fileParaBase64(cavalo),
        fileParaBase64(carreta),
      ]);

      const resp = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/extrair-placas`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ foto_cavalo: base64Cavalo, foto_carreta: base64Carreta }),
        }
      );

      if (!resp.ok) throw new Error("Falha ao processar imagens");
      const json = await resp.json();
      setPlacaCavalo(json.placa_cavalo ?? "");
      setPlacaCarreta(json.placa_carreta ?? "");
      setEtapa("confirmacao");
    } catch {
      setErro("Não foi possível extrair as placas. Preencha manualmente.");
      setPlacaCavalo("");
      setPlacaCarreta("");
      setEtapa("confirmacao");
    }
  }

  async function salvar() {
    if (!tipo) { setErro("Selecione o tipo de carreta (Baú ou Sider)."); return; }
    if (!placaCavalo.trim() || !placaCarreta.trim()) { setErro("Preencha as duas placas."); return; }
    setErro(null);
    setEtapa("salvando");

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const { data: lavagem, error: insErr } = await supabase
        .from("lavagens")
        .insert({ placa_cavalo: placaCavalo.trim().toUpperCase(), placa_carreta: placaCarreta.trim().toUpperCase(), tipo, registrado_por: session.user.id })
        .select().single();

      if (insErr || !lavagem) throw new Error("Erro ao salvar lavagem");

      const uploadFoto = async (file: File, campo: "cavalo" | "carreta") => {
        const path = `${session.user.id}/${lavagem.id}/${campo}.jpg`;
        const { error } = await supabase.storage.from("fotos-lavagens").upload(path, file, { contentType: "image/jpeg", upsert: true });
        if (error) return null;
        const { data } = supabase.storage.from("fotos-lavagens").getPublicUrl(path);
        return data.publicUrl;
      };

      const [urlCavalo, urlCarreta] = await Promise.all([
        fotoCavalo ? uploadFoto(fotoCavalo, "cavalo") : Promise.resolve(null),
        fotoCarreta ? uploadFoto(fotoCarreta, "carreta") : Promise.resolve(null),
      ]);

      if (urlCavalo || urlCarreta) {
        await supabase.from("lavagens").update({ foto_cavalo_url: urlCavalo, foto_carreta_url: urlCarreta }).eq("id", lavagem.id);
      }

      setEtapa("sucesso");
    } catch {
      setErro("Erro ao salvar. Tente novamente.");
      setEtapa("confirmacao");
    }
  }

  function reiniciar() {
    setEtapa("inicio");
    setFotoCavalo(null); setFotoCarreta(null);
    setPreviewCavalo(null); setPreviewCarreta(null);
    setPlacaCavalo(""); setPlacaCarreta("");
    setTipo(null); setErro(null);
    if (inputCavaloRef.current) inputCavaloRef.current.value = "";
    if (inputCarretaRef.current) inputCarretaRef.current.value = "";
  }

  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (!autenticado) return <div className="min-h-screen bg-mx-bg" />;

  return (
    <div className="min-h-screen bg-mx-bg relative">
      {/* Glow roxo */}
      <div
        className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px]"
        style={{ background: "radial-gradient(ellipse at center top, rgba(109,92,245,0.14) 0%, transparent 70%)" }}
      />

      {/* Header */}
      <header className="relative z-10 px-4 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #1D1D26" }}>
        <LogoMX />
        <button onClick={sair} className="btn-secondary text-sm py-2 px-4">Sair</button>
      </header>

      <main className="relative z-10 max-w-md mx-auto p-4 space-y-4">

        {/* INICIO */}
        {etapa === "inicio" && (
          <div className="text-center pt-12 space-y-6">
            <div
              className="inline-flex items-center justify-center w-24 h-24 rounded-full mx-auto"
              style={{ background: "rgba(109,92,245,0.12)", border: "1.5px solid rgba(109,92,245,0.35)", boxShadow: "0 0 30px rgba(109,92,245,0.2)" }}
            >
              <svg className="w-12 h-12 text-[#8B7CF8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 1h6l2-1zM13 16l2-5h4l2 5-2 1h-4l-2-1z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                Registrar <em className="not-italic text-[#8B7CF8]">Lavagem</em>
              </h2>
              <p className="text-mx-muted mt-2 text-sm">Fotografe as placas do cavalo e da carreta para registrar.</p>
            </div>
            <button onClick={() => setEtapa("foto-cavalo")} className="btn-primary w-full text-lg py-4">
              Iniciar Registro
            </button>
          </div>
        )}

        {/* FOTO CAVALO */}
        {etapa === "foto-cavalo" && (
          <div className="space-y-4">
            <div className="card space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-[#8B7CF8] flex-shrink-0"
                  style={{ background: "rgba(109,92,245,0.14)", border: "1px solid rgba(109,92,245,0.35)" }}
                >1</div>
                <h2 className="text-base font-semibold text-white">Foto da Placa do Cavalo</h2>
              </div>
              <p className="text-mx-muted text-sm">Aponte a câmera para a placa traseira do cavalo (caminhão).</p>
              <label className="block w-full cursor-pointer">
                <input ref={inputCavaloRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoCavalo} />
                <div className="btn-primary w-full text-lg py-4 text-center">Tirar Foto</div>
              </label>
            </div>
            <button onClick={reiniciar} className="w-full text-mx-muted text-sm py-2">Cancelar</button>
          </div>
        )}

        {/* FOTO CARRETA */}
        {etapa === "foto-carreta" && (
          <div className="space-y-4">
            {previewCavalo && (
              <div className="card p-3">
                <p className="section-label mb-2">CAVALO — foto recebida</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewCavalo} alt="Placa cavalo" className="w-full h-40 object-cover rounded-xl" />
              </div>
            )}
            <div className="card space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-[#8B7CF8] flex-shrink-0"
                  style={{ background: "rgba(109,92,245,0.14)", border: "1px solid rgba(109,92,245,0.35)" }}
                >2</div>
                <h2 className="text-base font-semibold text-white">Foto da Placa da Carreta</h2>
              </div>
              <p className="text-mx-muted text-sm">Agora fotografe a placa da carreta.</p>
              <label className="block w-full cursor-pointer">
                <input ref={inputCarretaRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoCarreta} />
                <div className="btn-primary w-full text-lg py-4 text-center">Tirar Foto</div>
              </label>
            </div>
            <button onClick={reiniciar} className="w-full text-mx-muted text-sm py-2">Cancelar</button>
          </div>
        )}

        {/* PROCESSANDO */}
        {etapa === "processando" && (
          <div className="text-center pt-16 space-y-6">
            <Spinner className="h-16 w-16 text-[#8B7CF8] mx-auto" />
            <div>
              <h2 className="text-xl font-semibold text-white">Identificando placas...</h2>
              <p className="text-mx-muted mt-1 text-sm">A IA está analisando as fotos.</p>
            </div>
          </div>
        )}

        {/* CONFIRMACAO */}
        {etapa === "confirmacao" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white pt-2">
              Confirmar <em className="not-italic text-[#8B7CF8]">dados</em>
            </h2>

            {erro && (
              <div className="text-sm rounded-xl px-4 py-3 text-yellow-300" style={{ background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.3)" }}>
                {erro}
              </div>
            )}

            {/* Previews */}
            <div className="grid grid-cols-2 gap-3">
              {previewCavalo && (
                <div className="card p-2">
                  <p className="section-label mb-1">CAVALO</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewCavalo} alt="Cavalo" className="w-full h-28 object-cover rounded-lg" />
                </div>
              )}
              {previewCarreta && (
                <div className="card p-2">
                  <p className="section-label mb-1">CARRETA</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewCarreta} alt="Carreta" className="w-full h-28 object-cover rounded-lg" />
                </div>
              )}
            </div>

            {/* Placas */}
            <div className="card space-y-4">
              <div>
                <label className="block text-xs font-medium text-mx-soft mb-1">PLACA DO CAVALO</label>
                <input
                  type="text"
                  value={placaCavalo}
                  onChange={e => setPlacaCavalo(e.target.value.toUpperCase())}
                  placeholder="ABC-1234"
                  className="input-field text-lg font-mono uppercase"
                  maxLength={8}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-mx-soft mb-1">PLACA DA CARRETA</label>
                <input
                  type="text"
                  value={placaCarreta}
                  onChange={e => setPlacaCarreta(e.target.value.toUpperCase())}
                  placeholder="ABC-1234"
                  className="input-field text-lg font-mono uppercase"
                  maxLength={8}
                />
              </div>
            </div>

            {/* Tipo */}
            <div className="card">
              <p className="section-label mb-3">TIPO DE CARRETA</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setTipo("bau")}
                  className={`py-4 rounded-2xl font-semibold text-lg transition-colors ${tipo === "bau" ? "btn-primary" : "btn-secondary"}`}
                >Baú</button>
                <button
                  onClick={() => setTipo("sider")}
                  className={`py-4 rounded-2xl font-semibold text-lg transition-colors ${tipo === "sider" ? "btn-primary" : "btn-secondary"}`}
                >Sider</button>
              </div>
            </div>

            <button
              onClick={salvar}
              disabled={!tipo || !placaCavalo.trim() || !placaCarreta.trim()}
              className="btn-primary w-full text-lg py-4"
            >
              Confirmar e Salvar
            </button>
            <button onClick={reiniciar} className="w-full text-mx-muted text-sm py-2">Cancelar</button>
          </div>
        )}

        {/* SALVANDO */}
        {etapa === "salvando" && (
          <div className="text-center pt-16 space-y-6">
            <Spinner className="h-16 w-16 text-[#8B7CF8] mx-auto" />
            <div>
              <h2 className="text-xl font-semibold text-white">Salvando...</h2>
              <p className="text-mx-muted mt-1 text-sm">Registrando a lavagem no sistema.</p>
            </div>
          </div>
        )}

        {/* SUCESSO */}
        {etapa === "sucesso" && (
          <div className="text-center pt-12 space-y-6">
            <div
              className="inline-flex items-center justify-center w-24 h-24 rounded-full mx-auto"
              style={{ background: "rgba(109,92,245,0.12)", border: "1.5px solid rgba(109,92,245,0.4)", boxShadow: "0 0 30px rgba(109,92,245,0.25)" }}
            >
              <svg className="w-14 h-14 text-[#8B7CF8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Lavagem registrada!</h2>
              <p className="text-mx-muted mt-2">
                <span className="font-mono font-semibold text-white">{placaCavalo}</span>
                <span className="text-mx-muted"> / </span>
                <span className="font-mono font-semibold text-white">{placaCarreta}</span>
                <br />
                <span className={tipo === "bau" ? "badge-roxo inline-block mt-2" : "badge-verde inline-block mt-2"}>
                  {tipo === "bau" ? "Baú" : "Sider"}
                </span>
              </p>
            </div>
            <button onClick={reiniciar} className="btn-primary w-full text-lg py-4">
              Nova Lavagem
            </button>
          </div>
        )}
      </main>

      <ChatLavagem />
    </div>
  );
}
