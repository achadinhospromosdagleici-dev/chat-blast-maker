import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BASE_URL = "https://wuzapi.cellchat.store/api";

async function wuz(
  path: string,
  opts: { method?: string; token: string; body?: unknown },
): Promise<{ data?: unknown }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: opts.method ?? "GET",
    headers: { "Content-Type": "application/json", token: opts.token },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let parsed: unknown = text;
  try { parsed = JSON.parse(text); } catch { /* keep */ }
  if (!res.ok) throw new Error(`WuzAPI ${res.status}: ${typeof parsed === "string" ? parsed : JSON.stringify(parsed)}`);
  return parsed as { data?: unknown };
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
function randomDelay(min: number, max: number) {
  const lo = Math.min(min, max), hi = Math.max(min, max);
  return (Math.floor(Math.random() * (hi - lo + 1)) + lo) * 1000;
}

type WuzGroup = {
  JID?: string;
  Name?: string;
  GroupName?: { Name?: string };
  Participants?: unknown[];
};

export const listGruposConexao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { idConexao: number }) => z.object({ idConexao: z.number().int() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: conn, error } = await context.supabase
      .from("SAAS_Conexoes")
      .select("Apikey,status")
      .eq("id", data.idConexao)
      .single();
    if (error || !conn?.Apikey) throw new Error("Conexão não encontrada");
    if (conn.status !== "connected") throw new Error("Conexão não está conectada");

    const res = await wuz("/group/list", { token: conn.Apikey });
    const raw = (res.data as { Groups?: WuzGroup[] } | undefined)?.Groups
      ?? (res.data as WuzGroup[] | undefined)
      ?? [];
    const groups = (Array.isArray(raw) ? raw : []).map((g) => ({
      WhatsAppId: g.JID ?? "",
      nome: g.GroupName?.Name ?? g.Name ?? g.JID ?? "(sem nome)",
      participantes: Array.isArray(g.Participants) ? g.Participants.length : 0,
    })).filter((g) => g.WhatsAppId);
    return groups;
  });

export const iniciarDisparoGrupo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      idConexao: z.number().int(),
      grupos: z.array(z.object({
        WhatsAppId: z.string().min(1),
        nome: z.string().max(200),
      })).min(1),
      texto: z.string().min(1).max(4096),
      minDelay: z.number().int().min(1).max(600).default(5),
      maxDelay: z.number().int().min(1).max(600).default(15),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: conn, error } = await supabase
      .from("SAAS_Conexoes")
      .select("Apikey,status")
      .eq("id", data.idConexao)
      .single();
    if (error || !conn?.Apikey) throw new Error("Conexão não encontrada");
    if (conn.status !== "connected") throw new Error("Conexão não está conectada");

    const { data: disp, error: dispErr } = await supabase
      .from("SAAS_Disparos")
      .insert({
        userId,
        tipo: "grupo",
        status: "ativo",
        conexoes: [data.idConexao],
        mensagens: [{ texto: data.texto }] as unknown as never,
        settings: { minDelay: data.minDelay, maxDelay: data.maxDelay } as unknown as never,
        total: data.grupos.length,
      })
      .select()
      .single();
    if (dispErr || !disp) throw new Error(dispErr?.message ?? "Falha ao criar disparo");

    const detalhes = data.grupos.map((g) => ({
      idDisparo: disp.id,
      UserId: userId,
      telefone: g.WhatsAppId,
      nomeContato: g.nome,
      mensagem: data.texto,
      Status: "pendente",
    }));
    for (let i = 0; i < detalhes.length; i += 500) {
      const { error: detErr } = await supabase
        .from("SAAS_Detalhes_Disparos")
        .insert(detalhes.slice(i, i + 500));
      if (detErr) throw new Error(detErr.message);
    }

    const { data: pendentes } = await supabase
      .from("SAAS_Detalhes_Disparos")
      .select("id,telefone,mensagem")
      .eq("idDisparo", disp.id)
      .order("id", { ascending: true });

    let enviados = 0, falhas = 0;
    for (let i = 0; i < (pendentes ?? []).length; i++) {
      const det = pendentes![i];
      try {
        await wuz("/chat/send/text", {
          method: "POST",
          token: conn.Apikey,
          body: { Phone: det.telefone, Body: det.mensagem },
        });
        await supabase.from("SAAS_Detalhes_Disparos").update({
          Status: "enviado",
          idConexao: data.idConexao,
          dataEnvio: new Date().toISOString(),
        }).eq("id", det.id);
        enviados++;
      } catch (e) {
        await supabase.from("SAAS_Detalhes_Disparos").update({
          Status: "erro",
          idConexao: data.idConexao,
          mensagemErro: (e as Error).message.slice(0, 500),
        }).eq("id", det.id);
        falhas++;
      }
      await supabase.from("SAAS_Disparos").update({ enviados, falhas }).eq("id", disp.id);
      if (i < pendentes!.length - 1) await sleep(randomDelay(data.minDelay, data.maxDelay));
    }

    await supabase.from("SAAS_Disparos").update({ status: "concluido", enviados, falhas }).eq("id", disp.id);
    return { id: disp.id, enviados, falhas, total: detalhes.length };
  });
