
-- Views: SECURITY INVOKER (respeita RLS do chamador)
ALTER VIEW public."vw_Usuarios_Com_Plano" SET (security_invoker = on);
ALTER VIEW public."vw_Planos_Usuarios_Count" SET (security_invoker = on);
ALTER VIEW public."vw_Detalhes_Completo" SET (security_invoker = on);

-- Revoga EXECUTE de anon nas funções SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.create_disparo(jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_disparo_grupo(jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.pause_disparo(bigint, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.resume_disparo(bigint, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.delete_disparo(bigint, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.swap_connection(bigint, bigint, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.add_connections_disparo(bigint, bigint[], uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_contatos_by_lista(bigint) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_grupos_by_lista(bigint) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.create_disparo(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_disparo_grupo(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pause_disparo(bigint, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resume_disparo(bigint, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_disparo(bigint, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.swap_connection(bigint, bigint, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_connections_disparo(bigint, bigint[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contatos_by_lista(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_grupos_by_lista(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
