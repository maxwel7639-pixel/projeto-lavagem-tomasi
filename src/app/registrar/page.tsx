"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import ChatLavagem from "@/components/ChatLavagem";

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
  const inputCavaloRef = useRef<HTMLInputElement>(null);
  const inputCarretaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.replace("/");
        return;
      }
      const { data: perfil } = await supabase
        .from("perfis")
        .select("papel")
        .eq("id", data.session.user.id)
        .single();
      if (perfil?.papel !== "lavador") {
        router.replace("/painel");
      }
    });
  }, [router]);

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
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
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
    if (!tipo) {
      setErro("Selecione o tipo de carreta (Baú ou Sider).");
      return;
    }
    if (!placaCavalo.trim() || !placaCarreta.trim()) {
      setErro("Preencha as duas placas.");
      return;
    }
    setErro(null);
    setEtapa("salvando");

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const { data: lavagem, error: insErr } = await supabase
        .from("lavagens")
        .insert({
          placa_cavalo: placaCavalo.trim().toUpperCase(),
          placa_carreta: placaCarreta.trim().toUpperCase(),
          tipo,
          registrado_por: session.user.id,
        })
        .select()
        .single();

      if (insErr || !lavagem) throw new Error("Erro ao salvar lavagem");

      const uploadFoto = async (file: File, campo: "cavalo" | "carreta") => {
        const path = `${session.user.id}/${lavagem.id}/${campo}.jpg`;
        const { error } = await supabase.storage
          .from("fotos-lavagens")
          .upload(path, file, { contentType: "image/jpeg", upsert: true });
        if (error) return null;
        const { data } = supabase.storage.from("fotos-lavagens").getPublicUrl(path);
        return data.publicUrl;
      };

      const [urlCavalo, urlCarreta] = await Promise.all([
        fotoCavalo ? uploadFoto(fotoCavalo, "cavalo") : Promise.resolve(null),
        fotoCarreta ? uploadFoto(fotoCarreta, "carreta") : Promise.resolve(null),
      ]);

      if (urlCavalo || urlCarreta) {
        await supabase
          .from("lavagens")
          .update({ foto_cavalo_url: urlCavalo, foto_carreta_url: urlCarreta })
          .eq("id", lavagem.id);
      }

      setEtapa("sucesso");
    } catch {
      setErro("Erro ao salvar. Tente novamente.");
      setEtapa("confirmacao");
    }
  }

  function reiniciar() {
    setEtapa("inicio");
    setFotoCavalo(null);
    setFotoCarreta(null);
    setPreviewCavalo(null);
    setPreviewCarreta(null);
    setPlacaCavalo("");
    setPlacaCarreta("");
    setTipo(null);
    setErro(null);
    if (inputCavaloRef.current) inputCavaloRef.current.value = "";
    if (inputCarretaRef.current) inputCarretaRef.current.value = "";
  }

  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-600 text-white px-4 py-4 flex items-center justify-between shadow">
        <h1 className="font-bold text-lg">Lava-Jato Tomasi</h1>
        <button onClick={sair} className="text-blue-200 text-sm underline">Sair</button>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        {/* INICIO */}
        {etapa === "inicio" && (
          <div className="text-center pt-12 space-y-6">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-blue-100 rounded-full">
              <svg className="w-14 h-14 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 1h6l2-1zM13 16l2-5h4l2 5-2 1h-4l-2-1z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Registrar Lavagem</h2>
              <p className="text-gray-500 mt-2">Fotografe as placas do cavalo e da carreta para registrar a lavagem.</p>
            </div>
            <button
              onClick={() => setEtapa("foto-cavalo")}
              className="w-full bg-blue-600 text-white font-semibold py-4 rounded-2xl text-lg shadow active:bg-blue-700 transition-colors"
            >
              Iniciar Registro
            </button>
          </div>
        )}

        {/* FOTO CAVALO */}
        {etapa === "foto-cavalo" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 shadow space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">1</span>
                <h2 className="text-lg font-semibold text-gray-800">Foto da Placa do Cavalo</h2>
              </div>
              <p className="text-gray-500 text-sm">Aponte a câmera para a placa traseira do cavalo (caminhão).</p>
              <label className="block w-full cursor-pointer">
                <input
                  ref={inputCavaloRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFotoCavalo}
                />
                <div className="w-full bg-blue-600 text-white font-semibold py-4 rounded-2xl text-center text-lg active:bg-blue-700 transition-colors">
                  Tirar Foto
                </div>
              </label>
            </div>
            <button onClick={reiniciar} className="w-full text-gray-500 text-sm py-2">Cancelar</button>
          </div>
        )}

        {/* FOTO CARRETA */}
        {etapa === "foto-carreta" && (
          <div className="space-y-4">
            {previewCavalo && (
              <div className="bg-white rounded-2xl p-4 shadow">
                <p className="text-xs text-gray-500 mb-2 font-medium">CAVALO — foto recebida</p>
                <img src={previewCavalo} alt="Placa cavalo" className="w-full h-40 object-cover rounded-xl" />
              </div>
            )}
            <div className="bg-white rounded-2xl p-6 shadow space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">2</span>
                <h2 className="text-lg font-semibold text-gray-800">Foto da Placa da Carreta</h2>
              </div>
              <p className="text-gray-500 text-sm">Agora fotografe a placa da carreta.</p>
              <label className="block w-full cursor-pointer">
                <input
                  ref={inputCarretaRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFotoCarreta}
                />
                <div className="w-full bg-blue-600 text-white font-semibold py-4 rounded-2xl text-center text-lg active:bg-blue-700 transition-colors">
                  Tirar Foto
                </div>
              </label>
            </div>
            <button onClick={reiniciar} className="w-full text-gray-500 text-sm py-2">Cancelar</button>
          </div>
        )}

        {/* PROCESSANDO */}
        {etapa === "processando" && (
          <div className="text-center pt-16 space-y-6">
            <Spinner className="h-16 w-16 text-blue-600 mx-auto" />
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Identificando placas...</h2>
              <p className="text-gray-500 mt-1 text-sm">A IA está analisando as fotos.</p>
            </div>
          </div>
        )}

        {/* CONFIRMACAO */}
        {etapa === "confirmacao" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800 pt-2">Confirmar dados</h2>

            {erro && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-xl px-4 py-3">
                {erro}
              </div>
            )}

            {/* Previews */}
            <div className="grid grid-cols-2 gap-3">
              {previewCavalo && (
                <div className="bg-white rounded-xl p-2 shadow">
                  <p className="text-xs text-gray-500 mb-1 font-medium">CAVALO</p>
                  <img src={previewCavalo} alt="Cavalo" className="w-full h-28 object-cover rounded-lg" />
                </div>
              )}
              {previewCarreta && (
                <div className="bg-white rounded-xl p-2 shadow">
                  <p className="text-xs text-gray-500 mb-1 font-medium">CARRETA</p>
                  <img src={previewCarreta} alt="Carreta" className="w-full h-28 object-cover rounded-lg" />
                </div>
              )}
            </div>

            {/* Placas */}
            <div className="bg-white rounded-2xl p-5 shadow space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Placa do Cavalo</label>
                <input
                  type="text"
                  value={placaCavalo}
                  onChange={e => setPlacaCavalo(e.target.value.toUpperCase())}
                  placeholder="ABC-1234"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={8}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Placa da Carreta</label>
                <input
                  type="text"
                  value={placaCarreta}
                  onChange={e => setPlacaCarreta(e.target.value.toUpperCase())}
                  placeholder="ABC-1234"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={8}
                />
              </div>
            </div>

            {/* Tipo */}
            <div className="bg-white rounded-2xl p-5 shadow">
              <p className="text-sm font-medium text-gray-700 mb-3">Tipo de carreta</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setTipo("bau")}
                  className={`py-4 rounded-2xl font-semibold text-lg border-2 transition-colors ${tipo === "bau" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200 active:bg-gray-50"}`}
                >
                  Baú
                </button>
                <button
                  onClick={() => setTipo("sider")}
                  className={`py-4 rounded-2xl font-semibold text-lg border-2 transition-colors ${tipo === "sider" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200 active:bg-gray-50"}`}
                >
                  Sider
                </button>
              </div>
            </div>

            <button
              onClick={salvar}
              disabled={!tipo || !placaCavalo.trim() || !placaCarreta.trim()}
              className="w-full bg-green-600 text-white font-semibold py-4 rounded-2xl text-lg shadow disabled:opacity-50 disabled:cursor-not-allowed active:bg-green-700 transition-colors"
            >
              Confirmar e Salvar
            </button>
            <button onClick={reiniciar} className="w-full text-gray-500 text-sm py-2">Cancelar</button>
          </div>
        )}

        {/* SALVANDO */}
        {etapa === "salvando" && (
          <div className="text-center pt-16 space-y-6">
            <Spinner className="h-16 w-16 text-green-600 mx-auto" />
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Salvando...</h2>
              <p className="text-gray-500 mt-1 text-sm">Registrando a lavagem no sistema.</p>
            </div>
          </div>
        )}

        {/* SUCESSO */}
        {etapa === "sucesso" && (
          <div className="text-center pt-12 space-y-6">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full">
              <svg className="w-14 h-14 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Lavagem registrada!</h2>
              <p className="text-gray-500 mt-2">
                <span className="font-mono font-semibold">{placaCavalo}</span> / <span className="font-mono font-semibold">{placaCarreta}</span>
                <br /><span className="capitalize">{tipo === "bau" ? "Baú" : "Sider"}</span>
              </p>
            </div>
            <button
              onClick={reiniciar}
              className="w-full bg-blue-600 text-white font-semibold py-4 rounded-2xl text-lg shadow active:bg-blue-700 transition-colors"
            >
              Nova Lavagem
            </button>
          </div>
        )}
      </main>

      <ChatLavagem />
    </div>
  );
}
