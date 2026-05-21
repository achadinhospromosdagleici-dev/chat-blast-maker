import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getMyProfile,
  updateMyProfile,
  updateMyApiKey,
} from "@/lib/configuracoes.functions";
import { supabase } from "@/integrations/supabase/client";
import { User, Lock, Key, CreditCard, Save, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/configuracoes")({ component: Page });

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: any;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-5 flex items-center gap-2 font-semibold text-primary">
        <Icon className="h-5 w-5" /> {title}
      </h2>
      {children}
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-4">
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Page() {
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const updProfile = useServerFn(updateMyProfile);
  const updKey = useServerFn(updateMyApiKey);

  const { data } = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchProfile() });

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaConf, setSenhaConf] = useState("");
  const [showA, setShowA] = useState(false);
  const [showB, setShowB] = useState(false);
  const [showC, setShowC] = useState(false);

  useEffect(() => {
    if (data?.usuario) {
      setNome(data.usuario.nome ?? "");
      setTelefone(data.usuario.telefone ?? "");
      setApiKey(data.usuario.apikey_gpt ?? "");
    }
  }, [data]);

  const saveProfile = useMutation({
    mutationFn: () => updProfile({ data: { nome, telefone } }),
    onSuccess: () => {
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveKey = useMutation({
    mutationFn: () => updKey({ data: { apikey_gpt: apiKey } }),
    onSuccess: () => toast.success("API Key salva"),
    onError: (e: Error) => toast.error(e.message),
  });

  async function changePassword() {
    if (!senhaNova || senhaNova !== senhaConf)
      return toast.error("Senhas não coincidem");
    if (senhaNova.length < 6) return toast.error("Mínimo 6 caracteres");
    const { error } = await supabase.auth.updateUser({ password: senhaNova });
    if (error) return toast.error(error.message);
    toast.success("Senha redefinida");
    setSenhaAtual("");
    setSenhaNova("");
    setSenhaConf("");
  }

  const plano = data?.plano;
  const uso = data?.uso ?? { disparos: 0, conexoes: 0, contatos: 0, listas: 0 };

  return (
    <AppShell>
      <PageHeader
        title="Configurações"
        subtitle="Gerencie suas informações pessoais e configurações da conta"
      />

      <div className="mx-auto max-w-3xl space-y-6">
        <Section icon={User} title="Informações Pessoais">
          <Field label="Nome" hint="Seu nome completo">
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </Field>
          <Field label="Email" hint="Seu email de cadastro não pode ser alterado">
            <Input value={data?.usuario?.Email ?? ""} disabled />
          </Field>
          <Field label="Telefone" hint="Formato: (XX) XXXXX-XXXX">
            <Input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="Preencher telefone"
            />
          </Field>
          <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending} className="gap-2">
            <Save className="h-4 w-4" /> Salvar Alterações
          </Button>
        </Section>

        <Section icon={Lock} title="Segurança">
          <Field label="Senha Atual">
            <div className="relative">
              <Input
                type={showA ? "text" : "password"}
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                placeholder="Digite sua senha atual"
              />
              <button
                type="button"
                onClick={() => setShowA(!showA)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showA ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          <Field label="Nova Senha">
            <div className="relative">
              <Input
                type={showB ? "text" : "password"}
                value={senhaNova}
                onChange={(e) => setSenhaNova(e.target.value)}
                placeholder="Digite sua nova senha"
              />
              <button
                type="button"
                onClick={() => setShowB(!showB)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showB ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          <Field label="Confirmar Nova Senha">
            <div className="relative">
              <Input
                type={showC ? "text" : "password"}
                value={senhaConf}
                onChange={(e) => setSenhaConf(e.target.value)}
                placeholder="Confirme sua nova senha"
              />
              <button
                type="button"
                onClick={() => setShowC(!showC)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showC ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          <Button onClick={changePassword} className="gap-2">
            <Key className="h-4 w-4" /> Redefinir Senha
          </Button>
        </Section>

        <Section icon={Key} title="API Keys">
          <Field
            label="API Key GPT"
            hint="Sua API Key será criptografada e armazenada com segurança"
          >
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Digite sua API Key do GPT"
            />
          </Field>
          <Button onClick={() => saveKey.mutate()} disabled={saveKey.isPending} className="gap-2">
            <Save className="h-4 w-4" /> Salvar API Key
          </Button>
        </Section>

        <Section icon={CreditCard} title="Plano Atual">
          <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <p className="font-semibold text-primary">{plano?.nome ?? "Sem plano"}</p>
            <ul className="mt-2 space-y-1 text-sm">
              <li>✓ {plano?.qntDisparos ?? 0} disparos</li>
              <li>✓ {plano?.qntConexoes ?? 0} conexões</li>
              <li>✓ {plano?.qntContatos ?? 0} contatos</li>
              <li>✓ {plano?.qntListas ?? 0} listas</li>
            </ul>
          </div>

          <div className="rounded-lg border border-border p-4">
            <p className="mb-3 font-semibold">Uso do Plano</p>
            {[
              { label: "Disparos", v: uso.disparos, max: plano?.qntDisparos ?? 0 },
              { label: "Conexões", v: uso.conexoes, max: plano?.qntConexoes ?? 0 },
              { label: "Contatos", v: uso.contatos, max: plano?.qntContatos ?? 0 },
              { label: "Listas", v: uso.listas, max: plano?.qntListas ?? 0 },
            ].map((r) => {
              const pct = r.max > 0 ? Math.min(100, Math.round((r.v / r.max) * 100)) : 100;
              return (
                <div key={r.label} className="mb-3 last:mb-0">
                  <div className="mb-1 flex justify-between text-xs">
                    <span>{r.label}</span>
                    <span className="text-primary">
                      {r.v.toLocaleString("pt-BR")} / {r.max > 0 ? r.max : "Ilimitado"}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Caso queira mudar de plano,{" "}
            <a href="#" className="text-primary underline">
              clique aqui
            </a>{" "}
            e fale com o suporte
          </p>
        </Section>
      </div>
    </AppShell>
  );
}
