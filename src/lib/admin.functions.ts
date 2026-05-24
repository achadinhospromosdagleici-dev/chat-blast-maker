import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { invalidateCache } from "@/lib/app-config";

async function assertAdmin(userSupabase: any, userId: string) {
  const { data, error } = await userSupabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("forbidden");
}

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context as any).supabase.rpc("has_role", {
      _user_id: (context as any).userId,
      _role: "admin",
    });
    return { isAdmin: !!data };
  });

export const listUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin((context as any).supabase, (context as any).userId);
    const { data: users, error } = await supabaseAdmin
      .from("SAAS_Usuarios")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: roles } = await supabaseAdmin.from("user_roles").select("*");
    return { users: users ?? [], roles: roles ?? [] };
  });

export const listPlanos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin((context as any).supabase, (context as any).userId);
    const { data, error } = await supabaseAdmin
      .from("SAAS_Planos")
      .select("*")
      .order("preco", { ascending: true });
    if (error) throw new Error(error.message);
    return { planos: data ?? [] };
  });

export const updateUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        plano: z.number().int().nullable().optional(),
        status: z.enum(["ativo", "bloqueado", "expirado"]).optional(),
        dataValidade: z.string().nullable().optional(),
        nome: z.string().max(120).optional(),
        telefone: z.string().max(40).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin((context as any).supabase, (context as any).userId);
    const patch: Record<string, unknown> = {};
    if (data.plano !== undefined) patch.plano = data.plano;
    if (data.status !== undefined) patch.status = data.status;
    if (data.dataValidade !== undefined) patch.dataValidade = data.dataValidade;
    if (data.nome !== undefined) patch.nome = data.nome;
    if (data.telefone !== undefined) patch.telefone = data.telefone;
    const { error } = await (supabaseAdmin as any)
      .from("SAAS_Usuarios")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "moderator", "user"]),
        add: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin((context as any).supabase, (context as any).userId);
    if (data.add) {
      const { error } = await (supabaseAdmin as any)
        .from("user_roles")
        .insert({ user_id: data.userId, role: data.role });
      if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    } else {
      const { error } = await (supabaseAdmin as any)
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const upsertPlano = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.number().int().optional(),
        nome: z.string().min(1).max(60),
        preco: z.number().min(0),
        qntListas: z.number().int().min(0),
        qntConexoes: z.number().int().min(0),
        qntContatos: z.number().int().min(0),
        qntDisparos: z.number().int().min(0),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin((context as any).supabase, (context as any).userId);
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("SAAS_Planos")
        .update({
          nome: data.nome,
          preco: data.preco,
          qntListas: data.qntListas,
          qntConexoes: data.qntConexoes,
          qntContatos: data.qntContatos,
          qntDisparos: data.qntDisparos,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("SAAS_Planos")
      .insert({
        nome: data.nome,
        preco: data.preco,
        qntListas: data.qntListas,
        qntConexoes: data.qntConexoes,
        qntContatos: data.qntContatos,
        qntDisparos: data.qntDisparos,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: ins!.id };
  });

export const deletePlano = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.number().int() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin((context as any).supabase, (context as any).userId);
    const { error } = await supabaseAdmin
      .from("SAAS_Planos")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getWuzapiToken = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin((context as any).supabase, (context as any).userId);
    const { data } = await supabaseAdmin
      .from("app_config")
      .select("value")
      .eq("key", "wuzapi_admin_token")
      .single();
    const envToken = process.env.WUZAPI_ADMIN_TOKEN;
    return {
      token: data?.value || "",
      fromEnv: !data?.value && !!envToken,
    };
  });

export const setWuzapiToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ token: z.string() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin((context as any).supabase, (context as any).userId);
    const { error } = await supabaseAdmin
      .from("app_config")
      .upsert({ key: "wuzapi_admin_token", value: data.token }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    invalidateCache();
    return { ok: true };
  });

export const deleteUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin((context as any).supabase, (context as any).userId);
    if (data.id === (context as any).userId) throw new Error("Não é possível remover você mesmo");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
