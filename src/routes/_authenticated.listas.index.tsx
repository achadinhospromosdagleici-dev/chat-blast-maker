import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  listListas,
  createLista,
  deleteLista,
  updateLista,
} from "@/lib/listas.functions";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Pencil, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/listas/")({ component: Page });

type Lista = {
  id: number;
  nome: string;
  descricao: string | null;
  tipo: string;
  created_at: string;
};

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}

function Page() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const list = useServerFn(listListas);
  const create = useServerFn(createLista);
  const del = useServerFn(deleteLista);
  const update = useServerFn(updateLista);

  const { data: rows = [] } = useQuery({
    queryKey: ["listas"],
    queryFn: () => list() as Promise<Lista[]>,
  });

  const [openCreate, setOpenCreate] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [editing, setEditing] = useState<Lista | null>(null);

  // filtros
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroData, setFiltroData] = useState<string>("todas");
  const [search, setSearch] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["listas"] });

  const createMut = useMutation({
    mutationFn: () => create({ data: { nome, descricao, tipo: "contatos" } }),
    onSuccess: () => {
      setNome("");
      setDescricao("");
      setOpenCreate(false);
      toast.success("Lista criada");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: () =>
      update({
        data: { id: editing!.id, nome: editing!.nome, descricao: editing!.descricao ?? "" },
      }),
    onSuccess: () => {
      setEditing(null);
      toast.success("Lista atualizada");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((l) => {
      if (filtroTipo !== "todos" && l.tipo !== filtroTipo) return false;
      if (filtroData !== "todas") {
        const d = new Date(l.created_at);
        const now = new Date();
        const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
        if (filtroData === "7d" && diff > 7) return false;
        if (filtroData === "30d" && diff > 30) return false;
        if (filtroData === "90d" && diff > 90) return false;
      }
      if (q && !l.nome.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, filtroTipo, filtroData, search]);

  return (
    <AppShell>
      <PageHeader
        title="Listas"
        subtitle="Gerencie suas listas de contatos e grupos do WhatsApp"
        onRefresh={refresh}
        actions={
          <Button onClick={() => setOpenCreate(true)} className="gap-2 bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Criar Lista
          </Button>
        }
      />

      {/* Filtros */}
      <div className="mb-6 rounded-xl border border-border bg-card p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-primary">Tipo de Lista</label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="todos">Todos os tipos</option>
              <option value="contatos">Contatos</option>
              <option value="grupos">Grupos</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-primary">Data de Criação</label>
            <select
              value={filtroData}
              onChange={(e) => setFiltroData(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="todas">Todas as datas</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="90d">Últimos 90 dias</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-primary">Buscar</label>
            <Input
              placeholder="Nome da lista..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-primary">Nome da Lista</TableHead>
              <TableHead className="text-primary">Tipo</TableHead>
              <TableHead className="text-primary">Data de Criação</TableHead>
              <TableHead className="text-right text-primary">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((l) => (
              <TableRow
                key={l.id}
                className="cursor-pointer"
                onClick={() => navigate({ to: "/listas/$id", params: { id: String(l.id) } })}
              >
                <TableCell>
                  <div className="font-medium">{l.nome}</div>
                  {l.descricao && (
                    <div className="text-xs text-muted-foreground">{l.descricao}</div>
                  )}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center rounded-md border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-medium capitalize text-primary">
                    {l.tipo}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(l.created_at)}
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => navigate({ to: "/listas/$id", params: { id: String(l.id) } })}
                      title="Abrir lista"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => setEditing(l)}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Excluir a lista "${l.nome}" e todos os contatos?`))
                          del({ data: { id: l.id } }).then(refresh);
                      }}
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                  {rows.length === 0
                    ? 'Nenhuma lista ainda. Clique em "Criar Lista" para começar.'
                    : "Nenhuma lista corresponde aos filtros."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal Criar */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-primary">Criar Lista</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Nome *</label>
              <Input
                placeholder="Ex: Clientes Premium"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Descrição</label>
              <Textarea
                placeholder="Descrição opcional"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
              />
            </div>
            <Button
              className="w-full gap-2"
              onClick={() => createMut.mutate()}
              disabled={!nome.trim() || createMut.isPending}
            >
              <Plus className="h-4 w-4" /> Criar Lista
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Editar */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-primary">Editar Lista</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Nome</label>
                <Input
                  value={editing.nome}
                  onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Descrição</label>
                <Textarea
                  value={editing.descricao ?? ""}
                  rows={3}
                  onChange={(e) => setEditing({ ...editing, descricao: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
                <Button onClick={() => updateMut.mutate()} disabled={updateMut.isPending}>
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
