
-- =========================================================================
-- FASE 1: SaaS DisparadorAi - Schema completo
-- =========================================================================

-- ---------- ROLES ----------
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;

CREATE POLICY "roles self read" ON public.user_roles FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "roles admin write" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ---------- PLANOS ----------
CREATE TABLE public."SAAS_Planos" (
  id bigserial PRIMARY KEY,
  nome text NOT NULL,
  preco numeric(10,2) NOT NULL DEFAULT 0,
  "qntConexoes" integer NOT NULL DEFAULT 1,
  "qntListas" integer NOT NULL DEFAULT 1,
  "qntContatos" integer NOT NULL DEFAULT 100,
  "qntDisparos" integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public."SAAS_Planos" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "planos read auth" ON public."SAAS_Planos" FOR SELECT TO authenticated USING (true);
CREATE POLICY "planos admin write" ON public."SAAS_Planos" FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_planos_updated BEFORE UPDATE ON public."SAAS_Planos" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public."SAAS_Planos" (nome, preco, "qntConexoes", "qntListas", "qntContatos", "qntDisparos")
VALUES ('Gratis', 0, 1, 1, 100, 100), ('Pro', 49.90, 5, 20, 5000, 10000);

-- ---------- USUARIOS (perfil) ----------
CREATE TABLE public."SAAS_Usuarios" (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT '',
  "Email" text NOT NULL,
  telefone text,
  plano bigint REFERENCES public."SAAS_Planos"(id) ON DELETE SET NULL,
  "dataValidade" date,
  status text NOT NULL DEFAULT 'ativo',
  apikey_gpt text,
  senha text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public."SAAS_Usuarios" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usuarios self read" ON public."SAAS_Usuarios" FOR SELECT TO authenticated USING (id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "usuarios self update" ON public."SAAS_Usuarios" FOR UPDATE TO authenticated USING (id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "usuarios admin insert" ON public."SAAS_Usuarios" FOR INSERT TO authenticated WITH CHECK (id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "usuarios admin delete" ON public."SAAS_Usuarios" FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_usuarios_updated BEFORE UPDATE ON public."SAAS_Usuarios" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para criar perfil ao cadastrar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _free_plano bigint;
BEGIN
  SELECT id INTO _free_plano FROM public."SAAS_Planos" WHERE nome='Gratis' LIMIT 1;
  INSERT INTO public."SAAS_Usuarios" (id, "Email", nome, telefone, plano, "dataValidade", status)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nome',''), NEW.raw_user_meta_data->>'telefone', _free_plano, (now()+ interval '7 days')::date, 'ativo')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- CONEXOES ----------
CREATE TABLE public."SAAS_Conexoes" (
  id bigserial PRIMARY KEY,
  "idUsuario" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "NomeConexao" text NOT NULL,
  "Telefone" text,
  "Apikey" text,
  "instanceName" text,
  "FotoPerfil" text,
  status text NOT NULL DEFAULT 'disconnected',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public."SAAS_Conexoes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conex own all" ON public."SAAS_Conexoes" FOR ALL TO authenticated
USING ("idUsuario"=auth.uid() OR public.has_role(auth.uid(),'admin'))
WITH CHECK ("idUsuario"=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_conexoes_updated BEFORE UPDATE ON public."SAAS_Conexoes" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_conexoes_user ON public."SAAS_Conexoes"("idUsuario");

-- ---------- LISTAS ----------
CREATE TABLE public."SAAS_Listas" (
  id bigserial PRIMARY KEY,
  "idUsuario" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "idConexao" bigint REFERENCES public."SAAS_Conexoes"(id) ON DELETE SET NULL,
  nome text NOT NULL,
  descricao text,
  tipo text NOT NULL DEFAULT 'contatos',  -- 'contatos' | 'grupos'
  campos jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public."SAAS_Listas" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lista own all" ON public."SAAS_Listas" FOR ALL TO authenticated
USING ("idUsuario"=auth.uid() OR public.has_role(auth.uid(),'admin'))
WITH CHECK ("idUsuario"=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_listas_updated BEFORE UPDATE ON public."SAAS_Listas" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_listas_user ON public."SAAS_Listas"("idUsuario");

-- ---------- CONTATOS ----------
CREATE TABLE public."SAAS_Contatos" (
  id bigserial PRIMARY KEY,
  "idUsuario" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "idLista" bigint NOT NULL REFERENCES public."SAAS_Listas"(id) ON DELETE CASCADE,
  nome text,
  telefone text NOT NULL,
  atributos jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public."SAAS_Contatos" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contato own all" ON public."SAAS_Contatos" FOR ALL TO authenticated
USING ("idUsuario"=auth.uid() OR public.has_role(auth.uid(),'admin'))
WITH CHECK ("idUsuario"=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_contatos_lista ON public."SAAS_Contatos"("idLista");

-- ---------- GRUPOS ----------
CREATE TABLE public."SAAS_Grupos" (
  id bigserial PRIMARY KEY,
  "idUsuario" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "idLista" bigint NOT NULL REFERENCES public."SAAS_Listas"(id) ON DELETE CASCADE,
  "idConexao" bigint REFERENCES public."SAAS_Conexoes"(id) ON DELETE SET NULL,
  "WhatsAppId" text NOT NULL,
  nome text,
  participantes integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public."SAAS_Grupos" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grupo own all" ON public."SAAS_Grupos" FOR ALL TO authenticated
USING ("idUsuario"=auth.uid() OR public.has_role(auth.uid(),'admin'))
WITH CHECK ("idUsuario"=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_grupos_lista ON public."SAAS_Grupos"("idLista");

-- ---------- DISPAROS ----------
CREATE TABLE public."SAAS_Disparos" (
  id bigserial PRIMARY KEY,
  "userId" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "idLista" bigint REFERENCES public."SAAS_Listas"(id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'individual',  -- 'individual' | 'grupo'
  status text NOT NULL DEFAULT 'pendente',  -- pendente|ativo|pausado|concluido|excluido
  conexoes bigint[] DEFAULT ARRAY[]::bigint[],
  mensagens jsonb DEFAULT '[]'::jsonb,
  settings jsonb DEFAULT '{}'::jsonb,
  total integer DEFAULT 0,
  enviados integer DEFAULT 0,
  falhas integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public."SAAS_Disparos" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disp own all" ON public."SAAS_Disparos" FOR ALL TO authenticated
USING ("userId"=auth.uid() OR public.has_role(auth.uid(),'admin'))
WITH CHECK ("userId"=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_disparos_updated BEFORE UPDATE ON public."SAAS_Disparos" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_disparos_user ON public."SAAS_Disparos"("userId");

-- ---------- DETALHES DISPAROS ----------
CREATE TABLE public."SAAS_Detalhes_Disparos" (
  id bigserial PRIMARY KEY,
  "idDisparo" bigint NOT NULL REFERENCES public."SAAS_Disparos"(id) ON DELETE CASCADE,
  "UserId" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "idConexao" bigint REFERENCES public."SAAS_Conexoes"(id) ON DELETE SET NULL,
  telefone text,
  "nomeContato" text,
  mensagem text,
  midia text,
  "Status" text NOT NULL DEFAULT 'pendente',  -- pendente|sent|failed
  "Payload" text,
  "mensagemErro" text,
  "dataEnvio" timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public."SAAS_Detalhes_Disparos" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "det own all" ON public."SAAS_Detalhes_Disparos" FOR ALL TO authenticated
USING ("UserId"=auth.uid() OR public.has_role(auth.uid(),'admin'))
WITH CHECK ("UserId"=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_det_disparo ON public."SAAS_Detalhes_Disparos"("idDisparo");
CREATE INDEX idx_det_user ON public."SAAS_Detalhes_Disparos"("UserId");

-- ---------- VIEWS ----------
CREATE OR REPLACE VIEW public."vw_Usuarios_Com_Plano" AS
SELECT u.*, p.nome AS plano_nome, p.preco AS plano_preco, p."qntConexoes", p."qntListas", p."qntContatos", p."qntDisparos"
FROM public."SAAS_Usuarios" u LEFT JOIN public."SAAS_Planos" p ON p.id=u.plano;

CREATE OR REPLACE VIEW public."vw_Planos_Usuarios_Count" AS
SELECT p.*, (SELECT count(*) FROM public."SAAS_Usuarios" u WHERE u.plano=p.id) AS total_usuarios
FROM public."SAAS_Planos" p;

CREATE OR REPLACE VIEW public."vw_Detalhes_Completo" AS
SELECT d.id AS "idDisparo", d."userId" AS "UserId", d.status AS "StatusDisparo",
       det.id AS "idDetalhe", det."Status", det."dataEnvio", det.telefone, det."nomeContato",
       det.mensagem, det."mensagemErro"
FROM public."SAAS_Disparos" d
LEFT JOIN public."SAAS_Detalhes_Disparos" det ON det."idDisparo"=d.id;

-- ---------- RPC FUNCTIONS ----------
-- Cria disparo individual a partir de payload jsonb
CREATE OR REPLACE FUNCTION public.create_disparo(payload jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _user uuid; _lista bigint; _conexoes bigint[]; _id bigint; _contato jsonb;
BEGIN
  _user := (payload->>'userId')::uuid;
  IF _user IS NULL OR _user <> auth.uid() THEN RAISE EXCEPTION 'unauthorized'; END IF;
  _lista := NULLIF(payload->>'idLista','')::bigint;
  SELECT ARRAY(SELECT (jsonb_array_elements_text(payload->'connections'))::bigint) INTO _conexoes;
  INSERT INTO public."SAAS_Disparos" ("userId","idLista",tipo,status,conexoes,mensagens,settings,total)
  VALUES (_user,_lista,'individual','ativo',_conexoes, COALESCE(payload->'mensagens','[]'::jsonb), COALESCE(payload->'settings','{}'::jsonb),
          COALESCE(jsonb_array_length(payload->'contatos'),0))
  RETURNING id INTO _id;
  IF payload ? 'contatos' THEN
    FOR _contato IN SELECT * FROM jsonb_array_elements(payload->'contatos') LOOP
      INSERT INTO public."SAAS_Detalhes_Disparos" ("idDisparo","UserId",telefone,"nomeContato",mensagem)
      VALUES (_id,_user,_contato->>'telefone',_contato->>'nome',_contato->>'mensagem');
    END LOOP;
  END IF;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.create_disparo_grupo(payload jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _user uuid; _lista bigint; _conexoes bigint[]; _id bigint; _grupo jsonb;
BEGIN
  _user := (payload->>'userId')::uuid;
  IF _user IS NULL OR _user <> auth.uid() THEN RAISE EXCEPTION 'unauthorized'; END IF;
  _lista := NULLIF(payload->>'idLista','')::bigint;
  SELECT ARRAY(SELECT (jsonb_array_elements_text(payload->'connections'))::bigint) INTO _conexoes;
  INSERT INTO public."SAAS_Disparos" ("userId","idLista",tipo,status,conexoes,mensagens,settings,total)
  VALUES (_user,_lista,'grupo','ativo',_conexoes, COALESCE(payload->'mensagens','[]'::jsonb), COALESCE(payload->'settings','{}'::jsonb),
          COALESCE(jsonb_array_length(payload->'grupos'),0))
  RETURNING id INTO _id;
  IF payload ? 'grupos' THEN
    FOR _grupo IN SELECT * FROM jsonb_array_elements(payload->'grupos') LOOP
      INSERT INTO public."SAAS_Detalhes_Disparos" ("idDisparo","UserId",telefone,"nomeContato",mensagem)
      VALUES (_id,_user,_grupo->>'WhatsAppId',_grupo->>'nome',_grupo->>'mensagem');
    END LOOP;
  END IF;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.pause_disparo(_id bigint, _user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF _user <> auth.uid() AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'unauthorized'; END IF;
  UPDATE public."SAAS_Disparos" SET status='pausado' WHERE id=_id AND ("userId"=_user OR public.has_role(auth.uid(),'admin'));
END $$;

CREATE OR REPLACE FUNCTION public.resume_disparo(_id bigint, _user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF _user <> auth.uid() AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'unauthorized'; END IF;
  UPDATE public."SAAS_Disparos" SET status='ativo' WHERE id=_id AND ("userId"=_user OR public.has_role(auth.uid(),'admin'));
END $$;

CREATE OR REPLACE FUNCTION public.delete_disparo(_id bigint, _user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF _user <> auth.uid() AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'unauthorized'; END IF;
  DELETE FROM public."SAAS_Disparos" WHERE id=_id AND ("userId"=_user OR public.has_role(auth.uid(),'admin'));
END $$;

CREATE OR REPLACE FUNCTION public.swap_connection(_disparo bigint, _from bigint, _user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF _user <> auth.uid() AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'unauthorized'; END IF;
  UPDATE public."SAAS_Disparos"
    SET conexoes = array_remove(conexoes, _from)
    WHERE id=_disparo AND ("userId"=_user OR public.has_role(auth.uid(),'admin'));
END $$;

CREATE OR REPLACE FUNCTION public.add_connections_disparo(_disparo bigint, _conns bigint[], _user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF _user <> auth.uid() AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'unauthorized'; END IF;
  UPDATE public."SAAS_Disparos"
    SET conexoes = ARRAY(SELECT DISTINCT unnest(conexoes || _conns))
    WHERE id=_disparo AND ("userId"=_user OR public.has_role(auth.uid(),'admin'));
END $$;

CREATE OR REPLACE FUNCTION public.get_contatos_by_lista(_lista bigint)
RETURNS SETOF public."SAAS_Contatos" LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT * FROM public."SAAS_Contatos" WHERE "idLista"=_lista
    AND ("idUsuario"=auth.uid() OR public.has_role(auth.uid(),'admin'));
$$;

CREATE OR REPLACE FUNCTION public.get_grupos_by_lista(_lista bigint)
RETURNS SETOF public."SAAS_Grupos" LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT * FROM public."SAAS_Grupos" WHERE "idLista"=_lista
    AND ("idUsuario"=auth.uid() OR public.has_role(auth.uid(),'admin'));
$$;

-- ---------- STORAGE BUCKETS ----------
INSERT INTO storage.buckets (id,name,public) VALUES ('fotos-perfil','fotos-perfil',true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id,name,public) VALUES ('media-disparos','media-disparos',false) ON CONFLICT DO NOTHING;

CREATE POLICY "fotos public read" ON storage.objects FOR SELECT USING (bucket_id='fotos-perfil');
CREATE POLICY "fotos auth write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='fotos-perfil' AND auth.uid()::text=(storage.foldername(name))[1]);
CREATE POLICY "fotos auth update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='fotos-perfil' AND auth.uid()::text=(storage.foldername(name))[1]);
CREATE POLICY "fotos auth delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='fotos-perfil' AND auth.uid()::text=(storage.foldername(name))[1]);

CREATE POLICY "media own read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='media-disparos' AND auth.uid()::text=(storage.foldername(name))[1]);
CREATE POLICY "media own write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='media-disparos' AND auth.uid()::text=(storage.foldername(name))[1]);
CREATE POLICY "media own update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='media-disparos' AND auth.uid()::text=(storage.foldername(name))[1]);
CREATE POLICY "media own delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='media-disparos' AND auth.uid()::text=(storage.foldername(name))[1]);
