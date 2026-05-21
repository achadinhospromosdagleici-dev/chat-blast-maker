import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

async function callOpenRouter(model: string, system: string, user: string) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY não configurado");
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://lovable.dev",
      "X-Title": "WuzAPI Sender",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.8,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 401) throw new Error("Token OpenRouter inválido");
    if (res.status === 402) throw new Error("Créditos OpenRouter esgotados");
    if (res.status === 429) throw new Error("Limite de requisições atingido");
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = JSON.parse(text);
  const content: string = json?.choices?.[0]?.message?.content ?? "";
  return content.trim();
}

const SYSTEM_DISPARO = `Você é um especialista em copywriting para WhatsApp.
Regras:
- Escreva em português brasileiro, tom natural e humano.
- Mensagem curta (no máximo 4 linhas), direta e sem soar como spam.
- NUNCA use links, emojis em excesso, ou CAIXA ALTA.
- Pode usar variáveis no formato {{nome}}, {{telefone}} e {{atributos}} quando fizer sentido.
- Retorne APENAS o texto final da mensagem, sem explicações, sem aspas, sem títulos.`;

export const gerarMensagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      prompt: z.string().min(3).max(2000),
      model: z.string().min(3).max(100),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const out = await callOpenRouter(data.model, SYSTEM_DISPARO, data.prompt);
    return { texto: out };
  });

export const variarMensagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      texto: z.string().min(3).max(4096),
      quantidade: z.number().int().min(1).max(5).default(3),
      model: z.string().min(3).max(100),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const sys = `${SYSTEM_DISPARO}
Sua tarefa: reescrever a mensagem do usuário em ${data.quantidade} versões diferentes, preservando o sentido e quaisquer variáveis {{...}}.
Retorne APENAS as versões, uma por linha, separadas por "---" (três traços em uma linha), sem numeração nem comentários.`;
    const out = await callOpenRouter(data.model, sys, data.texto);
    const versoes = out
      .split(/^---\s*$/m)
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
    return { versoes };
  });
