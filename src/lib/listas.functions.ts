import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listListas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("SAAS_Listas")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createLista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { nome: string; descricao?: string; tipo?: string }) =>
    z
      .object({
        nome: z.string().min(1).max(100),
        descricao: z.string().max(500).optional(),
        tipo: z.enum(["contatos", "grupos"]).default("contatos"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("SAAS_Listas")
      .insert({
        idUsuario: context.userId,
        nome: data.nome,
        descricao: data.descricao ?? null,
        tipo: data.tipo,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateLista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number; nome: string; descricao?: string }) =>
    z
      .object({
        id: z.number().int(),
        nome: z.string().min(1).max(100),
        descricao: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("SAAS_Listas")
      .update({ nome: data.nome, descricao: data.descricao ?? null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("SAAS_Contatos").delete().eq("idLista", data.id);
    await context.supabase.from("SAAS_Grupos").delete().eq("idLista", data.id);
    const { error } = await context.supabase.from("SAAS_Listas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getLista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: lista, error } = await context.supabase
      .from("SAAS_Listas")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const { data: contatos, error: e2 } = await context.supabase
      .from("SAAS_Contatos")
      .select("*")
      .eq("idLista", data.id)
      .order("created_at", { ascending: false });
    if (e2) throw new Error(e2.message);
    return { lista, contatos: contatos ?? [] };
  });

const phoneRe = /^\+?[0-9\s().-]{8,20}$/;
const normalizePhone = (p: string) => p.replace(/\D/g, "");

export const createContato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { idLista: number; nome?: string; telefone: string; atributos?: Record<string, unknown> }) =>
      z
        .object({
          idLista: z.number().int(),
          nome: z.string().max(150).optional(),
          telefone: z.string().regex(phoneRe, "Telefone inválido"),
          atributos: z.record(z.string(), z.unknown()).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("SAAS_Contatos")
      .insert({
        idUsuario: context.userId,
        idLista: data.idLista,
        nome: data.nome ?? null,
        telefone: normalizePhone(data.telefone),
        atributos: (data.atributos ?? {}) as any,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateContato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { id: number; nome?: string; telefone: string; atributos?: Record<string, unknown> }) =>
      z
        .object({
          id: z.number().int(),
          nome: z.string().max(150).optional(),
          telefone: z.string().regex(phoneRe, "Telefone inválido"),
          atributos: z.record(z.string(), z.unknown()).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("SAAS_Contatos")
      .update({
        nome: data.nome ?? null,
        telefone: normalizePhone(data.telefone),
        atributos: (data.atributos ?? {}) as any,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteContato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("SAAS_Contatos")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const importContatos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      idLista: number;
      contatos: Array<{ nome?: string; telefone: string; atributos?: Record<string, unknown> }>;
    }) =>
      z
        .object({
          idLista: z.number().int(),
          contatos: z
            .array(
              z.object({
                nome: z.string().max(150).optional(),
                telefone: z.string().min(6).max(40),
                atributos: z.record(z.string(), z.unknown()).optional(),
              }),
            )
            .min(1)
            .max(10000),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const rows = data.contatos
      .map((c) => ({
        idUsuario: context.userId,
        idLista: data.idLista,
        nome: c.nome ?? null,
        telefone: normalizePhone(c.telefone),
        atributos: (c.atributos ?? {}) as any,
      }))
      .filter((r) => r.telefone.length >= 8);

    // chunk inserts to avoid payload limits
    const CHUNK = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const { error, count } = await context.supabase
        .from("SAAS_Contatos")
        .insert(slice, { count: "exact" });
      if (error) throw new Error(error.message);
      inserted += count ?? slice.length;
    }
    return { inserted, skipped: data.contatos.length - rows.length };
  });
