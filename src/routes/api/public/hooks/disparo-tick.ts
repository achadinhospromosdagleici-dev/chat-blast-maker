import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  applyTemplate,
  msUntilAllowed,
  randomDelay,
  sendWithPhoneFallback,
  sleep,
  wuzSendButtons,
  wuzSendList,
  wuzSendMedia,
  wuzSendText,
} from "@/lib/disparo.functions";

// Worker que processa pendências em lotes. Chamado periodicamente via pg_cron.
// Roda no máximo ~25s por tick para caber no limite do worker.

const TICK_BUDGET_MS = 25_000;
const MAX_DISPAROS_POR_TICK = 5;
const MAX_MSGS_POR_DISPARO = 20;

type Mensagem = {
  tipo?: "texto" | "botoes" | "lista";
  texto?: string;
  botoes?: { DisplayText: string; Type?: "reply" | "url" | "call"; Url?: string; PhoneNumber?: string }[];
  lista?: { buttonText: string; footerText?: string; sections: { title: string; rows: { title: string; description?: string; rowId?: string }[] }[] };
  midia?: { kind: "imagem" | "video" | "audio" | "documento"; path: string; name: string; mime: string };
};

type Settings = {
  minDelay?: number;
  maxDelay?: number;
  pausaApos?: number;
  pausaMin?: number;
  horaIni?: string;
  horaFim?: string;
  diasSemana?: number[];
  scheduledAt?: string;
  timezone?: string;
};

async function processDisparo(disparoId: number, startedAt: number): Promise<{ enviados: number; falhas: number; done: boolean }> {
  const { data: disparo } = await supabaseAdmin
    .from("SAAS_Disparos")
    .select("id,userId,status,conexoes,mensagens,settings,enviados,falhas")
    .eq("id", disparoId)
    .single();
  if (!disparo || disparo.status !== "ativo") return { enviados: 0, falhas: 0, done: true };

  const settings = (disparo.settings as Settings | null) ?? {};
  const tz = settings.timezone ?? "America/Sao_Paulo";

  // Agendamento: se ainda não chegou a hora, pula este tick.
  if (settings.scheduledAt) {
    const target = new Date(settings.scheduledAt).getTime();
    if (Date.now() < target) return { enviados: 0, falhas: 0, done: false };
  }
  // Janela horária / dias da semana.
  if (msUntilAllowed(new Date(), { horaIni: settings.horaIni, horaFim: settings.horaFim, diasSemana: settings.diasSemana, timezone: tz }) > 0) {
    return { enviados: 0, falhas: 0, done: false };
  }

  const mensagens = (disparo.mensagens as Mensagem[] | null) ?? [];
  const mensagem = mensagens[0] ?? { tipo: "texto", texto: "" };

  const conIds = (disparo.conexoes as number[] | null) ?? [];
  if (conIds.length === 0) return { enviados: 0, falhas: 0, done: false };
  const { data: conns } = await supabaseAdmin
    .from("SAAS_Conexoes")
    .select("id,Apikey,status")
    .in("id", conIds);
  const ativas = (conns ?? []).filter((c) => c.Apikey && c.status === "connected");
  if (ativas.length === 0) return { enviados: 0, falhas: 0, done: false };

  // Pré-baixa mídia (uma vez).
  let midiaDataUrl: string | null = null;
  if (mensagem.midia) {
    const { data: blob } = await supabaseAdmin.storage.from("media-disparos").download(mensagem.midia.path);
    if (blob) {
      const buf = Buffer.from(await blob.arrayBuffer());
      midiaDataUrl = `data:${mensagem.midia.mime};base64,${buf.toString("base64")}`;
    }
  }

  const { data: pendentes } = await supabaseAdmin
    .from("SAAS_Detalhes_Disparos")
    .select("id,telefone,mensagem,nomeContato")
    .eq("idDisparo", disparoId)
    .eq("Status", "pendente")
    .order("id", { ascending: true })
    .limit(MAX_MSGS_POR_DISPARO);

  if (!pendentes || pendentes.length === 0) {
    await supabaseAdmin
      .from("SAAS_Disparos")
      .update({ status: "concluido" })
      .eq("id", disparoId);
    return { enviados: 0, falhas: 0, done: true };
  }

  let enviados = disparo.enviados ?? 0;
  let falhas = disparo.falhas ?? 0;
  let processados = 0;

  for (const det of pendentes) {
    if (Date.now() - startedAt > TICK_BUDGET_MS) break;

    const conn = ativas[processados % ativas.length];
    const body = det.mensagem ?? applyTemplate(mensagem.texto ?? "", {
      nome: det.nomeContato ?? null,
      telefone: det.telefone ?? "",
      atributos: null,
    });

    try {
      await sendWithPhoneFallback(conn.Apikey!, det.telefone!, async (resolvedPhone) => {
        const hasButtons = mensagem.tipo === "botoes" && !!mensagem.botoes?.length;
        const hasList = mensagem.tipo === "lista" && !!mensagem.lista;
        const allBtns = mensagem.botoes ?? [];
        const replyBtns = allBtns.filter((b) => (b.Type ?? "reply") === "reply");
        const ctaBtns = allBtns.filter((b) => b.Type === "url" || b.Type === "call");
        const buttonGroups = hasButtons ? [replyBtns, ctaBtns].filter((g) => g.length > 0) : [];
        const m = mensagem.midia;

        if (m && midiaDataUrl && m.kind === "imagem" && buttonGroups.length > 0) {
          await wuzSendButtons(conn.Apikey!, resolvedPhone, body, buttonGroups[0], midiaDataUrl);
          for (const grp of buttonGroups.slice(1)) {
            await wuzSendButtons(conn.Apikey!, resolvedPhone, body, grp);
          }
          return;
        }
        if (m && midiaDataUrl) {
          const captionForMedia = hasButtons || hasList ? "" : body;
          await wuzSendMedia(conn.Apikey!, resolvedPhone, m.kind, midiaDataUrl, captionForMedia, m.name);
          if (!hasButtons && !hasList) return;
        }
        if (hasButtons) {
          for (const grp of buttonGroups) await wuzSendButtons(conn.Apikey!, resolvedPhone, body, grp);
          return;
        }
        if (hasList) {
          return wuzSendList(conn.Apikey!, resolvedPhone, {
            topText: body,
            desc: body,
            buttonText: mensagem.lista!.buttonText,
            footerText: mensagem.lista!.footerText,
            sections: mensagem.lista!.sections,
          });
        }
        return wuzSendText(conn.Apikey!, resolvedPhone, body);
      });
      await supabaseAdmin
        .from("SAAS_Detalhes_Disparos")
        .update({ Status: "enviado", idConexao: conn.id, dataEnvio: new Date().toISOString() })
        .eq("id", det.id);
      enviados++;
    } catch (e) {
      await supabaseAdmin
        .from("SAAS_Detalhes_Disparos")
        .update({ Status: "erro", idConexao: conn.id, mensagemErro: (e as Error).message.slice(0, 500) })
        .eq("id", det.id);
      falhas++;
    }
    processados++;
    await supabaseAdmin.from("SAAS_Disparos").update({ enviados, falhas }).eq("id", disparoId);

    // delay entre mensagens
    if (processados < pendentes.length && Date.now() - startedAt < TICK_BUDGET_MS) {
      await sleep(randomDelay(settings.minDelay ?? 3, settings.maxDelay ?? 8));
      const pausaApos = settings.pausaApos ?? 0;
      const pausaMin = settings.pausaMin ?? 0;
      if (pausaApos > 0 && pausaMin > 0 && enviados > 0 && enviados % pausaApos === 0) {
        // pausa longa: encerra o tick, próximo cron retoma
        break;
      }
    }
  }

  // Se zerou as pendências, marca como concluído.
  const { count } = await supabaseAdmin
    .from("SAAS_Detalhes_Disparos")
    .select("id", { count: "exact", head: true })
    .eq("idDisparo", disparoId)
    .eq("Status", "pendente");
  if ((count ?? 0) === 0) {
    await supabaseAdmin.from("SAAS_Disparos").update({ status: "concluido" }).eq("id", disparoId);
    return { enviados, falhas, done: true };
  }
  return { enviados, falhas, done: false };
}

export const Route = createFileRoute("/api/public/hooks/disparo-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }

        const startedAt = Date.now();
        const { data: ativos } = await supabaseAdmin
          .from("SAAS_Disparos")
          .select("id")
          .eq("status", "ativo")
          .order("created_at", { ascending: true })
          .limit(MAX_DISPAROS_POR_TICK);

        const results: { id: number; enviados: number; falhas: number; done: boolean }[] = [];
        for (const d of ativos ?? []) {
          if (Date.now() - startedAt > TICK_BUDGET_MS) break;
          try {
            const r = await processDisparo(d.id, startedAt);
            results.push({ id: d.id, ...r });
          } catch (e) {
            results.push({ id: d.id, enviados: 0, falhas: 0, done: false });
            console.error("disparo-tick erro", d.id, (e as Error).message);
          }
        }

        return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
