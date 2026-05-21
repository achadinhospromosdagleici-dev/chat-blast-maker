import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BASE_URL = "https://wuzapi.cellchat.store";

export const WUZAPI_ENDPOINTS = {
  texto: `${BASE_URL}/chat/send/text`,
  botoes: `${BASE_URL}/chat/send/buttons`,
  lista: `${BASE_URL}/chat/send/list`,
  imagem: `${BASE_URL}/chat/send/image`,
  video: `${BASE_URL}/chat/send/video`,
  audio: `${BASE_URL}/chat/send/audio`,
  documento: `${BASE_URL}/chat/send/document`,
} as const;

type MidiaKind = "imagem" | "video" | "audio" | "documento";

export async function wuzSendMedia(
  token: string,
  phone: string,
  kind: MidiaKind,
  dataUrl: string,
  caption: string,
  fileName?: string,
) {
  const url = WUZAPI_ENDPOINTS[kind];
  const payload: Record<string, unknown> = { Phone: phone };
  if (kind === "imagem") {
    payload.Image = dataUrl;
    payload.Caption = caption;
  } else if (kind === "video") {
    payload.Video = dataUrl;
    payload.Caption = caption;
  } else if (kind === "audio") {
    // A WuzAPI espera o base64 como audio/ogg simples e os metadados opus separados.
    // Com codecs dentro do data URL ela pode aceitar HTTP 200, mas o WhatsApp não renderiza.
    payload.Audio = dataUrl.replace(/^data:[^,]+,/i, "data:audio/ogg;base64,");
    payload.PTT = true;
    payload.MimeType = "audio/ogg; codecs=opus";
  } else {
    payload.Document = dataUrl;
    payload.FileName = fileName ?? "arquivo";
    if (caption) payload.Caption = caption;
  }
  return wuzPost(url, token, payload);
}

async function wuzPost(url: string, token: string, payload: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", token },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`WuzAPI ${res.status}: ${text.slice(0, 300)}`);
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // resposta textual também é aceita
  }
  if (parsed && typeof parsed === "object" && "success" in parsed && parsed.success === false) {
    throw new Error(`WuzAPI: ${text.slice(0, 300)}`);
  }
  return parsed;
}

async function wuzJson<T>(path: string, token: string, payload: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // mantém o texto bruto para a mensagem de erro
  }
  if (!res.ok) throw new Error(`WuzAPI ${res.status}: ${typeof parsed === "string" ? parsed : JSON.stringify(parsed)}`);
  return parsed as T;
}

function phoneCandidates(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const candidates = [digits];
  if (digits.startsWith("55") && digits.length === 13 && digits[4] === "9") {
    candidates.push(`${digits.slice(0, 4)}${digits.slice(5)}`);
  }
  if (digits.startsWith("55") && digits.length === 12) {
    candidates.push(`${digits.slice(0, 4)}9${digits.slice(4)}`);
  }
  return [...new Set(candidates.filter(Boolean))];
}

async function checkedPhoneCandidates(token: string, phone: string) {
  const candidates = phoneCandidates(phone);
  try {
    const res = await wuzJson<{
      data?: { Users?: { IsInWhatsapp?: boolean; JID?: string; Query?: string }[] };
      success?: boolean;
    }>("/user/check", token, { Phone: candidates });
    const found = (res.data?.Users ?? [])
      .filter((u) => u.IsInWhatsapp)
      .map((u) => u.JID?.split("@")[0]?.split(":")[0] || u.Query || "")
      .filter(Boolean);
    return [...new Set([...found, ...candidates])];
  } catch {
    return candidates;
  }
}

export async function sendWithPhoneFallback(token: string, phone: string, send: (resolvedPhone: string) => Promise<unknown>) {
  let lastError: unknown;
  for (const candidate of await checkedPhoneCandidates(token, phone)) {
    try {
      return await send(candidate);
    } catch (e) {
      lastError = e;
      const message = (e as Error).message.toLowerCase();
      if (!message.includes("lid") && !message.includes("user info")) throw e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Falha ao enviar mensagem");
}

export async function wuzSendText(token: string, phone: string, body: string) {
  return wuzPost(WUZAPI_ENDPOINTS.texto, token, { Phone: phone, Body: body });
}

export async function wuzSendButtons(
  token: string,
  phone: string,
  body: string,
  buttons: { DisplayText: string; Type?: "reply" | "url" | "call"; Url?: string; PhoneNumber?: string }[],
  imageDataUrl?: string,
) {
  const typeMap = { reply: "reply", url: "cta_url", call: "cta_call" } as const;
  return wuzPost(WUZAPI_ENDPOINTS.botoes, token, {
    Phone: phone,
    Body: body,
    ...(imageDataUrl ? { Image: imageDataUrl } : {}),
    Buttons: buttons.map((b) => ({
      title: b.DisplayText,
      id: b.DisplayText,
      type: typeMap[b.Type ?? "reply"],
      ...(b.Url ? { url: b.Url } : {}),
      ...(b.PhoneNumber ? { phone_number: b.PhoneNumber } : {}),
    })),
  });
}

export async function wuzSendList(
  token: string,
  phone: string,
  payload: {
    topText: string;
    desc: string;
    buttonText: string;
    footerText?: string;
    sections: { title: string; rows: { title: string; description?: string; rowId?: string }[] }[];
  },
) {
  return wuzPost(WUZAPI_ENDPOINTS.lista, token, {
    Phone: phone,
    ButtonText: payload.buttonText,
    Desc: payload.desc,
    TopText: payload.topText,
    FooterText: payload.footerText ?? "",
    Sections: payload.sections.map((s) => ({
      Title: s.title,
      Rows: s.rows.map((r) => ({
        Title: r.title,
        Description: r.description ?? "",
        RowId: r.rowId ?? r.title,
      })),
    })),
  });
}

const botaoSchema = z.object({
  DisplayText: z.string().min(1).max(40),
  Type: z.enum(["reply", "url", "call"]).default("reply"),
  Url: z.string().url().max(2048).optional(),
  PhoneNumber: z.string().max(30).optional(),
});
const listRowSchema = z.object({
  title: z.string().min(1).max(60),
  description: z.string().max(120).optional(),
  rowId: z.string().max(80).optional(),
});
const listSectionSchema = z.object({
  title: z.string().min(1).max(60),
  rows: z.array(listRowSchema).min(1).max(10),
});

const midiaSchema = z.object({
  kind: z.enum(["imagem", "video", "audio", "documento"]),
  path: z.string().min(1).max(500),
  name: z.string().min(1).max(255),
  mime: z.string().min(1).max(150),
});

const messageVarsSchema = z.object({
  tipo: z.enum(["texto", "botoes", "lista"]).default("texto"),
  texto: z.string().max(4096).default(""),
  botoes: z.array(botaoSchema).max(3).optional(),
  lista: z
    .object({
      buttonText: z.string().min(1).max(20),
      footerText: z.string().max(60).optional(),
      sections: z.array(listSectionSchema).min(1).max(10),
    })
    .optional(),
  midia: midiaSchema.optional(),
});

const settingsSchema = z.object({
  minDelay: z.number().int().min(1).max(600).default(3),
  maxDelay: z.number().int().min(1).max(600).default(8),
  // Pausa automática: após N mensagens, aguardar X minutos
  pausaApos: z.number().int().min(0).max(10000).default(0),
  pausaMin: z.number().int().min(0).max(1440).default(0),
  // Janela horária HH:MM (vazio = sem restrição)
  horaIni: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  horaFim: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  // Dias permitidos: 0=dom..6=sab
  diasSemana: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  // Agendamento: ISO datetime para iniciar
  scheduledAt: z.string().datetime().optional(),
  // Timezone IANA (padrão BR)
  timezone: z.string().min(1).max(64).default("America/Sao_Paulo"),
});

export function applyTemplate(tpl: string, contato: { nome: string | null; telefone: string; atributos: Record<string, unknown> | null }) {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}|<\s*([\w.]+)\s*>/g, (_, k1: string, k2: string) => {
    const key = k1 ?? k2;
    if (key === "nome") return contato.nome ?? "";
    if (key === "telefone") return contato.telefone;
    const attrs = (contato.atributos ?? {}) as Record<string, unknown>;
    const val = attrs[key];
    return val == null ? "" : String(val);
  });
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function randomDelay(minSec: number, maxSec: number) {
  const min = Math.min(minSec, maxSec);
  const max = Math.max(minSec, maxSec);
  return (Math.floor(Math.random() * (max - min + 1)) + min) * 1000;
}

// Converte Date -> componentes (hora, minuto, diaSemana 0..6) em determinada timezone IANA.
function zonedParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = wdMap[get("weekday")] ?? 0;
  return { hour, minute, weekday };
}

function parseHM(s?: string): { h: number; m: number } | null {
  if (!s) return null;
  const [h, m] = s.split(":").map((x) => Number(x));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return { h, m };
}

// Retorna ms para aguardar até o próximo momento permitido (0 se já permitido).
export function msUntilAllowed(
  now: Date,
  opts: { horaIni?: string; horaFim?: string; diasSemana?: number[]; timezone: string },
) {
  const ini = parseHM(opts.horaIni);
  const fim = parseHM(opts.horaFim);
  const dias = opts.diasSemana && opts.diasSemana.length > 0 ? opts.diasSemana : null;
  if (!ini && !fim && !dias) return 0;

  // Verifica em janelas de 1 minuto até 8 dias à frente
  for (let i = 0; i < 60 * 24 * 8; i++) {
    const t = new Date(now.getTime() + i * 60_000);
    const { hour, minute, weekday } = zonedParts(t, opts.timezone);
    const dayOk = !dias || dias.includes(weekday);
    let timeOk = true;
    if (ini && fim) {
      const cur = hour * 60 + minute;
      const a = ini.h * 60 + ini.m;
      const b = fim.h * 60 + fim.m;
      timeOk = a <= b ? cur >= a && cur <= b : cur >= a || cur <= b;
    } else if (ini) {
      timeOk = hour * 60 + minute >= ini.h * 60 + ini.m;
    } else if (fim) {
      timeOk = hour * 60 + minute <= fim.h * 60 + fim.m;
    }
    if (dayOk && timeOk) return i * 60_000;
  }
  return 0;
}

// Aguarda em chunks para não exceder timers; respeita um teto máximo de espera por chamada.
export async function sleepCapped(ms: number, capMs = 6 * 60 * 60 * 1000) {
  const total = Math.min(ms, capMs);
  const step = 30_000;
  let left = total;
  while (left > 0) {
    const s = Math.min(step, left);
    await sleep(s);
    left -= s;
  }
}

// ============ HISTÓRICO ============

export const listDisparos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("SAAS_Disparos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [disp, conex, listas, contatos] = await Promise.all([
      supabase.from("SAAS_Disparos").select("id,status,total,enviados,falhas,created_at").order("created_at", { ascending: false }),
      supabase.from("SAAS_Conexoes").select("id,status"),
      supabase.from("SAAS_Listas").select("id"),
      supabase.from("SAAS_Contatos").select("id"),
    ]);
    const disparos = disp.data ?? [];
    const totalEnviados = disparos.reduce((s, d) => s + (d.enviados ?? 0), 0);
    const totalFalhas = disparos.reduce((s, d) => s + (d.falhas ?? 0), 0);
    const ativos = disparos.filter((d) => d.status === "ativo").length;
    const conexoes = conex.data ?? [];
    return {
      totalDisparos: disparos.length,
      disparosAtivos: ativos,
      totalEnviados,
      totalFalhas,
      totalConexoes: conexoes.length,
      conexoesConectadas: conexoes.filter((c) => c.status === "connected").length,
      totalListas: (listas.data ?? []).length,
      totalContatos: (contatos.data ?? []).length,
      recentes: disparos.slice(0, 5),
    };
  });

export const deleteDisparo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("SAAS_Detalhes_Disparos").delete().eq("idDisparo", data.id);
    const { error } = await context.supabase.from("SAAS_Disparos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getDisparoDetalhes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: disp } = await context.supabase
      .from("SAAS_Disparos")
      .select("*")
      .eq("id", data.id)
      .single();
    const { data: det } = await context.supabase
      .from("SAAS_Detalhes_Disparos")
      .select("*")
      .eq("idDisparo", data.id)
      .order("id", { ascending: true });
    return { disparo: disp, detalhes: det ?? [] };
  });

// ============ DISPARO INDIVIDUAL ============

export const iniciarDisparoIndividual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      idLista: z.number().int(),
      conexoes: z.array(z.number().int()).min(1),
      mensagem: messageVarsSchema,
      settings: settingsSchema,
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: contatos, error: contatosErr } = await supabase
      .from("SAAS_Contatos")
      .select("id,nome,telefone,atributos")
      .eq("idLista", data.idLista);
    if (contatosErr) throw new Error(contatosErr.message);
    if (!contatos || contatos.length === 0) throw new Error("Lista vazia");

    const { data: conns, error: connsErr } = await supabase
      .from("SAAS_Conexoes")
      .select("id,Apikey,status,NomeConexao")
      .in("id", data.conexoes);
    if (connsErr) throw new Error(connsErr.message);
    const ativas = (conns ?? []).filter((c) => c.Apikey && c.status === "connected");
    if (ativas.length === 0) throw new Error("Nenhuma conexão conectada selecionada");

    const { data: disparo, error: dispErr } = await supabase
      .from("SAAS_Disparos")
      .insert({
        userId,
        idLista: data.idLista,
        tipo: "individual",
        status: "ativo",
        conexoes: data.conexoes,
        mensagens: [data.mensagem] as unknown as never,
        settings: data.settings as unknown as never,
        total: contatos.length,
      })
      .select()
      .single();
    if (dispErr || !disparo) throw new Error(dispErr?.message ?? "Falha ao criar disparo");

    const detalhes = contatos.map((c) => ({
      idDisparo: disparo.id,
      UserId: userId,
      telefone: c.telefone,
      nomeContato: c.nome,
      mensagem: applyTemplate(data.mensagem.texto, {
        nome: c.nome,
        telefone: c.telefone,
        atributos: (c.atributos as Record<string, unknown> | null) ?? null,
      }),
      Status: "pendente",
    }));
    for (let i = 0; i < detalhes.length; i += 500) {
      const chunk = detalhes.slice(i, i + 500);
      const { error: detErr } = await supabase.from("SAAS_Detalhes_Disparos").insert(chunk);
      if (detErr) throw new Error(detErr.message);
    }

    let enviados = 0;
    let falhas = 0;

    // Pre-fetch media (once) and convert to base64 data URL
    let midiaDataUrl: string | null = null;
    if (data.mensagem.midia) {
      const { data: blob, error: dlErr } = await supabase.storage
        .from("media-disparos")
        .download(data.mensagem.midia.path);
      if (dlErr || !blob) throw new Error(`Falha ao baixar mídia: ${dlErr?.message ?? "sem dados"}`);
      const buf = Buffer.from(await blob.arrayBuffer());
      midiaDataUrl = `data:${data.mensagem.midia.mime};base64,${buf.toString("base64")}`;
    }

    const { data: pendentes } = await supabase
      .from("SAAS_Detalhes_Disparos")
      .select("id,telefone,mensagem")
      .eq("idDisparo", disparo.id)
      .order("id", { ascending: true });

    // Agendamento: se houver data futura, aguarda (limitado pelo cap do worker).
    if (data.settings.scheduledAt) {
      const target = new Date(data.settings.scheduledAt).getTime();
      const diff = target - Date.now();
      if (diff > 0) await sleepCapped(diff);
    }

    for (let i = 0; i < (pendentes ?? []).length; i++) {
      // Respeita janela horária e dias da semana
      const waitWindow = msUntilAllowed(new Date(), {
        horaIni: data.settings.horaIni,
        horaFim: data.settings.horaFim,
        diasSemana: data.settings.diasSemana,
        timezone: data.settings.timezone,
      });
      if (waitWindow > 0) await sleepCapped(waitWindow);

      const det = pendentes![i];
      const conn = ativas[i % ativas.length];
      try {
        await sendWithPhoneFallback(conn.Apikey!, det.telefone!, async (resolvedPhone) => {
          const m = data.mensagem.midia;
          const hasButtons = data.mensagem.tipo === "botoes" && !!data.mensagem.botoes?.length;
          const hasList = data.mensagem.tipo === "lista" && !!data.mensagem.lista;

          // WhatsApp não renderiza reply + cta (url/call) na mesma mensagem interativa.
          // Separa em grupos por tipo e envia cada grupo isoladamente.
          const allBtns = data.mensagem.botoes ?? [];
          const replyBtns = allBtns.filter((b) => (b.Type ?? "reply") === "reply");
          const ctaBtns = allBtns.filter((b) => b.Type === "url" || b.Type === "call");
          const buttonGroups = hasButtons
            ? [replyBtns, ctaBtns].filter((g) => g.length > 0)
            : [];

          // Imagem só pode acompanhar o primeiro grupo de botões (header da interativa).
          if (m && midiaDataUrl && m.kind === "imagem" && buttonGroups.length > 0) {
            await wuzSendButtons(
              conn.Apikey!,
              resolvedPhone,
              det.mensagem!,
              buttonGroups[0],
              midiaDataUrl,
            );
            for (const grp of buttonGroups.slice(1)) {
              await wuzSendButtons(conn.Apikey!, resolvedPhone, det.mensagem!, grp);
            }
            return;
          }

          if (m && midiaDataUrl) {
            const captionForMedia = hasButtons || hasList ? "" : (det.mensagem ?? "");
            await wuzSendMedia(
              conn.Apikey!,
              resolvedPhone,
              m.kind,
              midiaDataUrl,
              captionForMedia,
              m.name,
            );
            if (!hasButtons && !hasList) return;
          }

          if (hasButtons) {
            for (const grp of buttonGroups) {
              await wuzSendButtons(conn.Apikey!, resolvedPhone, det.mensagem!, grp);
            }
            return;
          }
          if (hasList) {
            return wuzSendList(conn.Apikey!, resolvedPhone, {
              topText: det.mensagem!,
              desc: det.mensagem!,
              buttonText: data.mensagem.lista!.buttonText,
              footerText: data.mensagem.lista!.footerText,
              sections: data.mensagem.lista!.sections,
            });
          }
          return wuzSendText(conn.Apikey!, resolvedPhone, det.mensagem!);
        });
        await supabase
          .from("SAAS_Detalhes_Disparos")
          .update({
            Status: "enviado",
            idConexao: conn.id,
            dataEnvio: new Date().toISOString(),
          })
          .eq("id", det.id);
        enviados++;
      } catch (e) {
        await supabase
          .from("SAAS_Detalhes_Disparos")
          .update({
            Status: "erro",
            idConexao: conn.id,
            mensagemErro: (e as Error).message.slice(0, 500),
          })
          .eq("id", det.id);
        falhas++;
      }
      await supabase
        .from("SAAS_Disparos")
        .update({ enviados, falhas })
        .eq("id", disparo.id);

      if (i < (pendentes!.length - 1)) {
        await sleep(randomDelay(data.settings.minDelay, data.settings.maxDelay));
        // Pausa automática a cada N enviados
        const { pausaApos, pausaMin } = data.settings;
        if (pausaApos > 0 && pausaMin > 0 && enviados > 0 && enviados % pausaApos === 0) {
          await sleepCapped(pausaMin * 60_000);
        }
      }
    }

    await supabase
      .from("SAAS_Disparos")
      .update({ status: "concluido", enviados, falhas })
      .eq("id", disparo.id);

    return { id: disparo.id, total: detalhes.length, enviados, falhas };
  });
