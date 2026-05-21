import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listConexoes } from "@/lib/conexoes.functions";
import { listGruposConexao, iniciarDisparoGrupo } from "@/lib/grupos.functions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Send, Loader2, Search, Users, RefreshCw } from "lucide-react";
import { AiGenerateButton, AiVaryButton } from "@/components/AiMessageHelper";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/grupos")({ component: Page });

type Conexao = { id: number; NomeConexao: string; Telefone: string | null; status: string };
type Grupo = { WhatsAppId: string; nome: string; participantes: number };

function Page() {
  const listConn = useServerFn(listConexoes);
  const listGr = useServerFn(listGruposConexao);
  const iniciar = useServerFn(iniciarDisparoGrupo);

  const { data: conexoes = [] } = useQuery({ queryKey: ["conexoes"], queryFn: () => listConn() });
  const connected = useMemo(
    () => (conexoes as Conexao[]).filter((c) => c.status === "connected"),
    [conexoes],
  );

  const [idConexao, setIdConexao] = useState<string>("");
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loadingGrupos, setLoadingGrupos] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const [texto, setTexto] = useState("");
  const [minDelay, setMinDelay] = useState(5);
  const [maxDelay, setMaxDelay] = useState(15);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(
    () => grupos.filter((g) => g.nome.toLowerCase().includes(busca.toLowerCase())),
    [grupos, busca],
  );

  async function carregarGrupos() {
    if (!idConexao) return toast.error("Selecione uma conexão");
    setLoadingGrupos(true);
    setGrupos([]);
    setSelected(new Set());
    try {
      const res = await listGr({ data: { idConexao: Number(idConexao) } });
      setGrupos(res);
      toast.success(`${res.length} grupos encontrados`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingGrupos(false);
    }
  }

  function toggle(id: string) {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelected(n);
  }
  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((g) => g.WhatsAppId)));
  }

  async function handleStart() {
    if (selected.size === 0) return toast.error("Selecione ao menos um grupo");
    if (!texto.trim()) return toast.error("Mensagem vazia");
    if (minDelay > maxDelay) return toast.error("Intervalo mínimo > máximo");

    const escolhidos = grupos.filter((g) => selected.has(g.WhatsAppId));
    setBusy(true);
    const tid = toast.loading("Disparando para grupos...");
    try {
      const res = await iniciar({
        data: {
          idConexao: Number(idConexao),
          grupos: escolhidos.map((g) => ({ WhatsAppId: g.WhatsAppId, nome: g.nome })),
          texto,
          minDelay,
          maxDelay,
        },
      });
      toast.success(`Concluído: ${res.enviados} enviados, ${res.falhas} falhas`, { id: tid });
    } catch (e) {
      toast.error((e as Error).message, { id: tid });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Disparo para Grupos</h1>
          <p className="text-sm text-muted-foreground">
            Selecione grupos do WhatsApp e envie uma mensagem.
          </p>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div>
            <Label>Conexão *</Label>
            <div className="mt-1 flex gap-2">
              <select
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={idConexao}
                onChange={(e) => setIdConexao(e.target.value)}
              >
                <option value="">Selecione...</option>
                {connected.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.NomeConexao} ({c.Telefone ?? "?"})
                  </option>
                ))}
              </select>
              <Button onClick={carregarGrupos} disabled={!idConexao || loadingGrupos} variant="outline">
                {loadingGrupos ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Carregar
              </Button>
            </div>
            {connected.length === 0 && (
              <p className="mt-1 text-xs text-yellow-500">
                Nenhuma conexão conectada.{" "}
                <Link to="/conexoes" className="underline">Conectar</Link>
              </p>
            )}
          </div>

          {grupos.length > 0 && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar grupo..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {selected.size} de {filtered.length} selecionados
                </span>
                <Button variant="ghost" size="sm" onClick={toggleAll}>
                  {selected.size === filtered.length ? "Limpar" : "Selecionar todos"}
                </Button>
              </div>
              <div className="max-h-72 space-y-1 overflow-auto rounded-md border border-border p-2">
                {filtered.map((g) => (
                  <label
                    key={g.WhatsAppId}
                    className={`flex cursor-pointer items-center gap-3 rounded-md p-2 text-sm transition-colors ${
                      selected.has(g.WhatsAppId) ? "bg-primary/10" : "hover:bg-accent"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(g.WhatsAppId)}
                      onChange={() => toggle(g.WhatsAppId)}
                    />
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 truncate">{g.nome}</div>
                    <span className="text-xs text-muted-foreground">{g.participantes}p</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {grupos.length > 0 && (
          <div className="space-y-4 rounded-xl border border-border bg-card p-5">
            <div>
              <div className="flex items-center justify-between">
                <Label>Mensagem</Label>
                <div className="flex gap-2">
                  <AiGenerateButton onApply={setTexto} />
                  <AiVaryButton texto={texto} onApply={setTexto} />
                </div>
              </div>
              <Textarea rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={4096} className="mt-2" />
              <p className="mt-1 text-xs text-muted-foreground">{texto.length}/4096</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Intervalo mín. (s)</Label>
                <Input type="number" min={1} max={600} value={minDelay} onChange={(e) => setMinDelay(Number(e.target.value))} />
              </div>
              <div>
                <Label>Intervalo máx. (s)</Label>
                <Input type="number" min={1} max={600} value={maxDelay} onChange={(e) => setMaxDelay(Number(e.target.value))} />
              </div>
            </div>
            <Button onClick={handleStart} disabled={busy || selected.size === 0} className="w-full" size="lg">
              {busy ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Disparando...</>
              ) : (
                <><Send className="mr-2 h-4 w-4" /> Disparar para {selected.size} grupo(s)</>
              )}
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
