import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  listConexoes,
  createConexao,
  deleteConexao,
  connectConexao,
  statusConexao,
} from "@/lib/conexoes.functions";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trash2, RefreshCw, Smartphone, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/conexoes")({ component: Page });

type Conexao = {
  id: number;
  NomeConexao: string;
  Telefone: string | null;
  FotoPerfil: string | null;
  status: string;
};

function statusBadge(s: string) {
  if (s === "connected")
    return { cls: "bg-primary/15 text-primary border border-primary/30", label: "Conectado" };
  if (s === "connecting")
    return { cls: "bg-yellow-500/10 text-yellow-500 border border-yellow-500/30", label: "Conectando" };
  return { cls: "bg-destructive/15 text-destructive border border-destructive/30", label: "Desconectado" };
}

function Page() {
  const qc = useQueryClient();
  const list = useServerFn(listConexoes);
  const create = useServerFn(createConexao);
  const del = useServerFn(deleteConexao);
  const connect = useServerFn(connectConexao);
  const status = useServerFn(statusConexao);

  const { data: rows = [] } = useQuery({
    queryKey: ["conexoes"],
    queryFn: () => list() as Promise<Conexao[]>,
  });
  const [showCreate, setShowCreate] = useState(false);
  const [nome, setNome] = useState("");
  const [qrFor, setQrFor] = useState<{ id: number; qr: string } | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["conexoes"] });

  const createMut = useMutation({
    mutationFn: () => create({ data: { nome } }),
    onSuccess: () => {
      setNome("");
      setShowCreate(false);
      toast.success("Conexão criada");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const connectMut = useMutation({
    mutationFn: (id: number) => connect({ data: { id } }),
    onSuccess: (res, id) => {
      if (res.qr) setQrFor({ id, qr: res.qr });
      else toast.message("Conectando...");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: (id: number) => status({ data: { id } }),
    onSuccess: (res) => {
      toast.success(`Status: ${res.status}`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!qrFor) return;
    const t = setInterval(() => statusMut.mutate(qrFor.id), 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrFor?.id]);

  const deleteDisconnected = async () => {
    const desc = rows.filter((r) => r.status !== "connected");
    if (desc.length === 0) return toast.info("Nada para excluir");
    if (!confirm(`Excluir ${desc.length} conexões desconectadas?`)) return;
    await Promise.all(desc.map((r) => del({ data: { id: r.id } })));
    toast.success("Conexões desconectadas excluídas");
    refresh();
  };

  return (
    <AppShell>
      <PageHeader
        title="Conexões WhatsApp"
        subtitle="Gerencie todas as suas conexões do WhatsApp em um só lugar"
        actions={
          <>
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Criar conexão
            </Button>
            <Button variant="destructive" onClick={deleteDisconnected} className="gap-2">
              <Trash2 className="h-4 w-4" /> Excluir conexões desconectadas
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((c) => {
          const sb = statusBadge(c.status);
          return (
            <div key={c.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start gap-3">
                <Avatar className="h-12 w-12">
                  {c.FotoPerfil ? <AvatarImage src={c.FotoPerfil} alt={c.NomeConexao} /> : null}
                  <AvatarFallback className="bg-muted text-[10px]">Foto</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">{c.NomeConexao}</h3>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {c.Telefone ?? "Sem número"}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${sb.cls}`}>
                  {sb.label}
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 gap-1"
                  onClick={() => statusMut.mutate(c.id)}
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Verificar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1"
                  onClick={() => connectMut.mutate(c.id)}
                >
                  <Smartphone className="h-3.5 w-3.5" /> Conectar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (confirm("Excluir esta conexão?"))
                      del({ data: { id: c.id } }).then(refresh);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma conexão ainda. Clique em "Criar conexão".
          </p>
        )}
      </div>

      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="w-full max-w-md space-y-3 rounded-xl border border-border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold">Nova conexão</h3>
            <Input
              placeholder="Nome (ex: Vendas)"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancelar
              </Button>
              <Button onClick={() => createMut.mutate()} disabled={!nome || createMut.isPending}>
                Criar
              </Button>
            </div>
          </div>
        </div>
      )}

      {qrFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setQrFor(null)}
        >
          <div
            className="rounded-xl border border-border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-center font-semibold">Escaneie no WhatsApp</h3>
            {qrFor.qr.startsWith("data:") ? (
              <img src={qrFor.qr} alt="QR" className="h-72 w-72" />
            ) : (
              <div className="grid h-72 w-72 place-items-center rounded bg-white p-2 text-black">
                <pre className="text-[6px] leading-[6px]">{qrFor.qr}</pre>
              </div>
            )}
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Aguardando leitura... atualiza automaticamente.
            </p>
            <div className="mt-4 flex justify-between gap-2">
              <Button variant="outline" onClick={() => statusMut.mutate(qrFor.id)}>
                Verificar agora
              </Button>
              <Button onClick={() => setQrFor(null)}>Fechar</Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
