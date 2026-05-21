import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BASE_URL = "https://wuzapi.cellchat.store";

async function wuz(
  path: string,
  opts: { method?: string; token?: string; body?: unknown; admin?: boolean } = {},
): Promise<{ code?: number; success?: boolean; data?: unknown }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.admin) headers["Authorization"] = process.env.WUZAPI_ADMIN_TOKEN!;
  if (opts.token) headers["token"] = opts.token;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* keep raw */
  }
  if (!res.ok) {
    throw new Error(
      `WuzAPI ${res.status}: ${typeof parsed === "string" ? parsed : JSON.stringify(parsed)}`,
    );
  }
  return parsed as { code?: number; success?: boolean; data?: unknown };
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40) || "conexao";

export const listConexoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("SAAS_Conexoes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createConexao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { nome: string }) =>
    z.object({ nome: z.string().min(1).max(50) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const token = crypto.randomUUID().replace(/-/g, "");
    const instanceName = `${slug(data.nome)}_${Date.now().toString(36)}`;

    await wuz("/admin/users", {
      method: "POST",
      admin: true,
      body: { name: instanceName, token, webhook: "", events: "All", expiration: 0 },
    });

    const { data: row, error } = await context.supabase
      .from("SAAS_Conexoes")
      .insert({
        idUsuario: context.userId,
        NomeConexao: data.nome,
        instanceName,
        Apikey: token,
        status: "disconnected",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteConexao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: inst } = await context.supabase
      .from("SAAS_Conexoes")
      .select("Apikey")
      .eq("id", data.id)
      .single();
    if (inst?.Apikey) {
      try {
        await wuz("/session/logout", { method: "POST", token: inst.Apikey });
      } catch {
        /* ignore */
      }
    }
    const { error } = await context.supabase.from("SAAS_Conexoes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const connectConexao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: inst, error } = await context.supabase
      .from("SAAS_Conexoes")
      .select("Apikey")
      .eq("id", data.id)
      .single();
    if (error || !inst?.Apikey) throw new Error("Conexão não encontrada");

    try {
      await wuz("/session/connect", {
        method: "POST",
        token: inst.Apikey,
        body: { Subscribe: ["Message"], Immediate: true },
      });
    } catch (e) {
      console.error("connect err", e);
    }

    let qr = "";
    try {
      const qrRes = await wuz("/session/qr", { token: inst.Apikey });
      qr = (qrRes.data as { QRCode?: string } | undefined)?.QRCode ?? "";
    } catch {
      /* ignore */
    }

    await context.supabase
      .from("SAAS_Conexoes")
      .update({ status: "connecting" })
      .eq("id", data.id);
    return { qr };
  });

export const statusConexao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: inst } = await context.supabase
      .from("SAAS_Conexoes")
      .select("Apikey,FotoPerfil,Telefone")
      .eq("id", data.id)
      .single();
    if (!inst?.Apikey) throw new Error("Conexão não encontrada");

    try {
      const res = await wuz("/session/status", { token: inst.Apikey });
      const info = res.data as
        | { connected?: boolean; loggedIn?: boolean; jid?: string }
        | undefined;
      const status = info?.loggedIn ? "connected" : info?.connected ? "connecting" : "disconnected";
      const jid = info?.jid ?? null;
      const phone = jid ? (jid.split("@")[0]?.split(":")[0] ?? null) : inst.Telefone;

      let foto = inst.FotoPerfil;
      if (status === "connected" && jid) {
        try {
          const av = await wuz("/user/avatar", {
            method: "POST",
            token: inst.Apikey,
            body: { Phone: jid },
          });
          const url = (av.data as { URL?: string } | undefined)?.URL;
          if (url) foto = url;
        } catch {
          /* ignore avatar errors */
        }
      }

      await context.supabase
        .from("SAAS_Conexoes")
        .update({ status, Telefone: phone, FotoPerfil: foto })
        .eq("id", data.id);
      return { status, phone, foto };
    } catch (e) {
      return { status: "disconnected", error: String(e) };
    }
  });

export const logoutConexao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: inst } = await context.supabase
      .from("SAAS_Conexoes")
      .select("Apikey")
      .eq("id", data.id)
      .single();
    if (!inst?.Apikey) throw new Error("Conexão não encontrada");
    try {
      await wuz("/session/logout", { method: "POST", token: inst.Apikey });
    } catch {
      /* ignore */
    }
    await context.supabase
      .from("SAAS_Conexoes")
      .update({ status: "disconnected" })
      .eq("id", data.id);
    return { ok: true };
  });
