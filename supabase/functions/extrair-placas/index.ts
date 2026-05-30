import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { foto_cavalo, foto_carreta } = await req.json();

    if (!foto_cavalo || !foto_carreta) {
      return new Response(
        JSON.stringify({ error: "foto_cavalo e foto_carreta são obrigatórios" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Configuração interna ausente" }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Você vai receber duas fotos de placas de veículos brasileiros. A primeira é a placa do CAVALO (caminhão trator) e a segunda é a placa da CARRETA (semirreboque). Extraia o texto de cada placa e retorne SOMENTE um JSON no formato: {\"placa_cavalo\": \"ABC1234\", \"placa_carreta\": \"DEF5678\"}. Sem explicações, sem markdown, apenas o JSON. Se não conseguir ler alguma placa, coloque string vazia no campo correspondente.",
              },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: foto_cavalo,
                },
              },
              {
                type: "text",
                text: "Segunda foto (placa da carreta):",
              },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: foto_carreta,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error("Anthropic error:", err);
      return new Response(
        JSON.stringify({ error: "Falha ao chamar API de visão" }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const anthropicData = await resp.json();
    const texto = anthropicData.content?.[0]?.text ?? "";

    let resultado = { placa_cavalo: "", placa_carreta: "" };
    try {
      const match = texto.match(/\{[^}]+\}/);
      if (match) {
        resultado = JSON.parse(match[0]);
      }
    } catch {
      console.error("Falha ao parsear resposta:", texto);
    }

    // Normaliza: remove espaços e hífens, uppercase
    const normalizar = (p: string) =>
      (p ?? "").replace(/[\s-]/g, "").toUpperCase();

    return new Response(
      JSON.stringify({
        placa_cavalo: normalizar(resultado.placa_cavalo),
        placa_carreta: normalizar(resultado.placa_carreta),
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
