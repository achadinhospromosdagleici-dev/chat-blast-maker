import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getConfig } from "@/lib/app-config";

const BASE_URL = "https://wuzapi.cellchat.store/api";

const admin = () => supabaseAdmin;

async function wuz(
  path: string,
  opts: { method?: string; token?: string; body?: unknown; admin?: boolean } = {},
): Promise<{ code?: number; success?: boolean; data?: unknown }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.admin) {
    const dbToken = await getConfig("wuzapi_admin_token");
    headers["Authorization"] = dbToken || process.env.WUZAPI_ADMIN_TOKEN!;
  }
  if (opts.token) headers["token"] = opts.token;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let parsed: unknown = text;
  try { parsed = JSON.parse(text); } catch {}
  if (!res.ok) {
    throw new Error(
      `WuzAPI ${res.status}: ${typeof parsed === "string" ? parsed : JSON.stringify(parsed)}`,
    );
  }
  return parsed as { code?: number; success?: boolean; data?: unknown };
}

// ============ INSTANCES ============

export const listInstances = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await admin()
    .from("instances")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const createInstance = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string }) => z.object({ name: z.string().min(1).max(50) }).parse(d))
  .handler(async ({ data }) => {
    const token = crypto.randomUUID().replace(/-/g, "");
    await wuz("/admin/users", {
      method: "POST",
      admin: true,
      body: { name: data.name, token, webhook: "", events: "All", expiration: 0 },
    });
    const { data: row, error } = await admin()
      .from("instances")
      .insert({ name: data.name, token, status: "disconnected" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteInstance = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = admin();
    const { data: inst } = await db.from("instances").select("*").eq("id", data.id).single();
    if (inst?.token) {
      try { await wuz("/session/logout", { method: "POST", token: inst.token }); } catch {}
    }
    await db.from("instances").delete().eq("id", data.id);
    return { ok: true };
  });

export const connectInstance = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = admin();
    const { data: inst, error } = await db.from("instances").select("*").eq("id", data.id).single();
    if (error || !inst) throw new Error("Instance not found");

    try {
      await wuz("/session/connect", {
        method: "POST",
        token: inst.token,
        body: { Subscribe: ["Message"], Immediate: true },
      });
    } catch (e) {
      console.error("connect err", e);
    }

    // Get QR
    let qr = "";
    try {
      const qrRes = await wuz("/session/qr", { token: inst.token });
      qr = (qrRes.data as { QRCode?: string } | undefined)?.QRCode ?? "";
    } catch {}

    await db.from("instances").update({ qr_code: qr, status: "connecting" }).eq("id", data.id);
    return { qr };
  });

export const checkStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = admin();
    const { data: inst } = await db.from("instances").select("*").eq("id", data.id).single();
    if (!inst) throw new Error("Not found");
    try {
      const res = await wuz("/session/status", { token: inst.token });
      const info = res.data as { Connected?: boolean; LoggedIn?: boolean; Jid?: string } | undefined;
      const status = info?.LoggedIn ? "connected" : info?.Connected ? "connecting" : "disconnected";
      const jid = info?.Jid ?? null;
      const phone = jid ? jid.split("@")[0]?.split(":")[0] ?? null : inst.phone;
      await db.from("instances").update({ status, jid, phone, qr_code: status === "connected" ? null : inst.qr_code }).eq("id", data.id);
      return { status, jid, phone };
    } catch (e) {
      return { status: "disconnected", error: String(e) };
    }
  });

export const logoutInstance = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = admin();
    const { data: inst } = await db.from("instances").select("*").eq("id", data.id).single();
    if (!inst) throw new Error("Not found");
    try { await wuz("/session/logout", { method: "POST", token: inst.token }); } catch {}
    await db.from("instances").update({ status: "disconnected", qr_code: null }).eq("id", data.id);
    return { ok: true };
  });

// ============ SEND ============

const phoneSchema = z.string().min(8).max(20).regex(/^[0-9+]+$/);

export const sendText = createServerFn({ method: "POST" })
  .inputValidator((d: { instanceId: string; phone: string; body: string }) =>
    z.object({
      instanceId: z.string().uuid(),
      phone: phoneSchema,
      body: z.string().min(1).max(4096),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = admin();
    const { data: inst } = await db.from("instances").select("token").eq("id", data.instanceId).single();
    if (!inst) throw new Error("Instance not found");
    await wuz("/chat/send/text", {
      method: "POST",
      token: inst.token,
      body: { Phone: data.phone, Body: data.body },
    });
    return { ok: true };
  });

export const sendButtons = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      instanceId: z.string().uuid(),
      phone: phoneSchema,
      title: z.string().min(1).max(1024),
      buttons: z.array(z.object({ DisplayText: z.string().min(1).max(20) })).min(1).max(3),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = admin();
    const { data: inst } = await db.from("instances").select("token").eq("id", data.instanceId).single();
    if (!inst) throw new Error("Instance not found");
    await wuz("/chat/send/buttons", {
      method: "POST",
      token: inst.token,
      body: { Phone: data.phone, Title: data.title, Buttons: data.buttons },
    });
    return { ok: true };
  });

export const sendList = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      instanceId: z.string().uuid(),
      phone: phoneSchema,
      topText: z.string().min(1).max(60),
      desc: z.string().max(1024).default(""),
      buttonText: z.string().min(1).max(20),
      footerText: z.string().max(60).default(""),
      sections: z.array(z.object({
        title: z.string().min(1).max(24),
        rows: z.array(z.object({
          title: z.string().min(1).max(24),
          desc: z.string().max(72).default(""),
          rowId: z.string().min(1).max(200),
        })).min(1).max(10),
      })).min(1).max(10),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = admin();
    const { data: inst } = await db.from("instances").select("token").eq("id", data.instanceId).single();
    if (!inst) throw new Error("Instance not found");
    await wuz("/chat/send/list", {
      method: "POST",
      token: inst.token,
      body: {
        Phone: data.phone,
        ButtonText: data.buttonText,
        TopText: data.topText,
        Desc: data.desc,
        FooterText: data.footerText,
        Sections: data.sections.map((s) => ({
          title: s.title,
          rows: s.rows.map((r) => ({ title: r.title, desc: r.desc, rowId: r.rowId })),
        })),
      },
    });
    return { ok: true };
  });
