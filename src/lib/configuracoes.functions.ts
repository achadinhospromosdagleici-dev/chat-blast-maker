import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: usuario } = await supabase
      .from("SAAS_Usuarios")
      .select('id,nome,"Email",telefone,plano,"dataValidade",status,apikey_gpt')
      .eq("id", userId)
      .single();

    let plano: any = null;
    if (usuario?.plano) {
      const { data: p } = await supabase
        .from("SAAS_Planos")
        .select("*")
        .eq("id", usuario.plano)
        .single();
      plano = p;
    }

    const [{ count: cDisparos }, { count: cConex }, { count: cContatos }, { count: cListas }] =
      await Promise.all([
        supabase.from("SAAS_Disparos").select("id", { count: "exact", head: true }),
        supabase.from("SAAS_Conexoes").select("id", { count: "exact", head: true }),
        supabase.from("SAAS_Contatos").select("id", { count: "exact", head: true }),
        supabase.from("SAAS_Listas").select("id", { count: "exact", head: true }),
      ]);

    return {
      usuario,
      plano,
      uso: {
        disparos: cDisparos ?? 0,
        conexoes: cConex ?? 0,
        contatos: cContatos ?? 0,
        listas: cListas ?? 0,
      },
    };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        nome: z.string().min(1).max(120),
        telefone: z.string().max(40).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("SAAS_Usuarios")
      .update({ nome: data.nome, telefone: data.telefone ?? null })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateMyApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ apikey_gpt: z.string().max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("SAAS_Usuarios")
      .update({ apikey_gpt: data.apikey_gpt })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getDisparosPorDia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ dias: z.number().int().min(1).max(90).default(7) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const since = new Date();
    since.setDate(since.getDate() - data.dias);
    const { data: rows } = await context.supabase
      .from("SAAS_Disparos")
      .select("created_at,total,enviados")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true });

    const buckets: Record<string, number> = {};
    for (let i = 0; i < data.dias; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (data.dias - 1 - i));
      const key = d.toISOString().slice(0, 10);
      buckets[key] = 0;
    }
    for (const r of rows ?? []) {
      const key = (r.created_at ?? "").slice(0, 10);
      if (key in buckets) buckets[key] += r.enviados ?? 0;
    }
    return Object.entries(buckets).map(([date, value]) => ({ date, value }));
  });
