import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import {
  getLista,
  createContato,
  updateContato,
  deleteContato,
  importContatos,
} from "@/lib/listas.functions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  ArrowLeft,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Users,
  UserPlus,
  CheckCircle2,
  FileText,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/listas/$id")({ component: Page });

type Contato = {
  id: number;
  nome: string | null;
  telefone: string;
  atributos: Record<string, unknown> | null;
  created_at?: string;
};

function formatDate(d?: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}

function parseCSV(text: string): Array<{ nome?: string; telefone: string; atributos?: Record<string, unknown> }> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const first = lines[0];
  const delim = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : ",";
  const split = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') q = !q;
      else if (ch === delim && !q) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };

  let headers = split(lines[0]).map((h) => h.toLowerCase());
  let startIdx = 1;
  if (/^[+0-9()\s.-]{6,}$/.test(headers[0])) {
    headers = headers.length >= 2 ? ["telefone", "nome"] : ["telefone"];
    startIdx = 0;
  }
  const phoneIdx = headers.findIndex((h) =>
    ["telefone", "phone", "celular", "whatsapp", "numero", "número"].includes(h),
  );
  const nameIdx = headers.findIndex((h) =>
    ["nome", "name", "contato", "contact"].includes(h),
  );
  const tIdx = phoneIdx >= 0 ? phoneIdx : 0;
  const nIdx = nameIdx;

  const rows: Array<{ nome?: string; telefone: string; atributos?: Record<string, unknown> }> = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cells = split(lines[i]);
    const telefone = cells[tIdx];
    if (!telefone) continue;
    const nome = nIdx >= 0 ? cells[nIdx] : undefined;
    const atributos: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      if (idx !== tIdx && idx !== nIdx && cells[idx]) atributos[h] = cells[idx];
    });
    rows.push({
      nome: nome || undefined,
      telefone,
      atributos: Object.keys(atributos).length ? atributos : undefined,
    });
  }
  return rows;
}

function Page() {
  const { id } = Route.useParams();
  const idNum = Number(id);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const get = useServerFn(getLista);
  const create = useServerFn(createContato);
  const update = useServerFn(updateContato);
  const del = useServerFn(deleteContato);
  const imp = useServerFn(importContatos);

  const { data } = useQuery({
    queryKey: ["lista", idNum],
    queryFn: () => get({ data: { id: idNum } }),
  });

  const lista = data?.lista;
  const contatos = (data?.contatos ?? []) as Contato[];

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [editing, setEditing] = useState<Contato | null>(null);
  const [search, setSearch] = useState("");
  const [openNovo, setOpenNovo] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["lista", idNum] });

  const createMut = useMutation({
    mutationFn: () => create({ data: { idLista: idNum, nome, telefone } }),
    onSuccess: () => {
      setNome("");
      setTelefone("");
      setOpenNovo(false);
      toast.success("Contato adicionado");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: () =>
      update({
        data: {
          id: editing!.id,
          nome: editing!.nome ?? undefined,
          telefone: editing!.telefone,
        },
      }),
    onSuccess: () => {
      setEditing(null);
      toast.success("Contato atualizado");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importMut = useMutation({
    mutationFn: (rows: Array<{ nome?: string; telefone: string; atributos?: Record<string, unknown> }>) =>
      imp({ data: { idLista: idNum, contatos: rows } }),
    onSuccess: (res) => {
      toast.success(`${res.inserted} contato(s) carregado(s) com sucesso! (${res.skipped} ignorados)`);
      setOpenImport(false);
      setImportFile(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleImport = async () => {
    if (!importFile) return toast.error("Selecione um arquivo");
    const name = importFile.name.toLowerCase();
    let parsed: Array<{ nome?: string; telefone: string; atributos?: Record<string, unknown> }> = [];
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const XLSX = await import("xlsx");
      const buf = await importFile.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      parsed = rows
        .map((r: Record<string, unknown>) => {
          const keys = Object.keys(r);
          const phoneKey =
            keys.find((k) => ["telefone", "phone", "celular", "whatsapp", "numero", "número"].includes(k.toLowerCase())) ??
            keys[0];
          const nameKey = keys.find((k) => ["nome", "name", "contato", "contact"].includes(k.toLowerCase()));
          const telefone = String(r[phoneKey] ?? "").trim();
          if (!telefone) return null;
          const nome = nameKey ? String(r[nameKey] ?? "").trim() : undefined;
          const atributos: Record<string, unknown> = {};
          keys.forEach((k) => {
            if (k !== phoneKey && k !== nameKey && r[k] !== "" && r[k] != null) atributos[k.toLowerCase()] = r[k];
          });
          return {
            nome: nome || undefined,
            telefone,
            atributos: Object.keys(atributos).length ? atributos : undefined,
          };
        })
        .filter(Boolean) as typeof parsed;
    } else {
      const text = await importFile.text();
      parsed = parseCSV(text);
    }
    if (parsed.length === 0) return toast.error("Nenhum contato encontrado no arquivo");
    importMut.mutate(parsed);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return contatos;
    return contatos.filter(
      (c) => (c.nome ?? "").toLowerCase().includes(q) || c.telefone.toLowerCase().includes(q),
    );
  }, [contatos, search]);

  return (
    <AppShell>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Lista de Contatos</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => toast.info("Em breve")}>
            <MessageCircle className="h-4 w-4" /> Puxar do WhatsApp
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setOpenImport(true)}>
            <FileText className="h-4 w-4" /> Importar Contatos
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => navigate({ to: "/listas" })}>
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        </div>
      </div>

      {/* Nome da lista */}
      <div className="mb-6 rounded-xl border border-border bg-card px-5 py-4">
        <h2 className="text-2xl font-bold">{lista?.nome ?? "Carregando..."}</h2>
        {lista?.descricao && (
          <p className="mt-1 text-sm text-muted-foreground">{lista.descricao}</p>
        )}
      </div>

      {/* Variáveis da Lista */}
      <div className="mb-6 rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-primary">Variáveis da Lista</h3>
          </div>
          <Button size="sm" className="gap-1" onClick={() => toast.info("Em breve")}>
            <Plus className="h-3.5 w-3.5" /> Criar Variável
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          As variáveis permitem personalizar as mensagens para cada contato.
        </p>
      </div>

      {/* Contatos */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-2 flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4 rounded border-border" disabled />
              <span className="font-semibold">Contatos</span>
            </div>
            <Button size="sm" className="gap-1" onClick={() => setOpenNovo(true)}>
              <UserPlus className="h-3.5 w-3.5" /> Criar Contato
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => toast.info("Em breve")}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Verificar números
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => setOpenImport(true)}
              title="Importar CSV"
            >
              <FileText className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-56"
            />
            <span className="text-sm font-medium text-primary">
              Total de contatos: {contatos.length}
            </span>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-primary">Nome</TableHead>
              <TableHead className="text-primary">Telefone</TableHead>
              <TableHead className="text-primary">Data de Adição</TableHead>
              <TableHead className="text-primary">Variáveis</TableHead>
              <TableHead className="text-right text-primary">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.nome ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs text-primary">{c.telefone}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(c.created_at)}
                </TableCell>
                <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                  {c.atributos && Object.keys(c.atributos).length
                    ? Object.entries(c.atributos)
                        .map(([k, v]) => `${k}=${v}`)
                        .join(", ")
                    : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => setEditing(c)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (confirm("Excluir este contato?"))
                          del({ data: { id: c.id } }).then(refresh);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum contato {search ? "encontrado" : "ainda"}.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal Novo Contato */}
      <Dialog open={openNovo} onOpenChange={setOpenNovo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <UserPlus className="h-5 w-5" /> Novo Contato
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Nome</label>
              <Input
                placeholder="Nome completo do contato"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Telefone *</label>
              <Input
                placeholder="55(11)93423-2334"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
              />
            </div>
            <Button
              className="w-full gap-2"
              onClick={() => createMut.mutate()}
              disabled={!telefone || createMut.isPending}
            >
              <UserPlus className="h-4 w-4" /> Adicionar Contato
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Importar CSV */}
      <Dialog
        open={openImport}
        onOpenChange={(o) => {
          setOpenImport(o);
          if (!o) setImportFile(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <FileText className="h-5 w-5" /> Importar Contatos
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="mb-1 block text-xs font-medium">Arquivo CSV ou Excel (.xlsx / .xls)</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-background/40 py-10 text-center transition hover:border-primary/50 hover:bg-primary/5"
            >
              <FileText className="h-10 w-10 text-primary" />
              <span className="font-medium text-primary">
                {importFile ? importFile.name : "Clique para selecionar um arquivo"}
              </span>
              <span className="text-xs text-muted-foreground">
                CSV, XLSX ou XLS — ou arraste e solte o arquivo aqui
              </span>
            </button>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>A primeira linha deve conter os cabeçalhos (ex: nome, telefone)</p>
              <p>Colunas extras viram variáveis para personalizar mensagens</p>
              <p>Apenas números válidos e sem duplicações serão salvos</p>
            </div>
            <Button
              className="w-full gap-2"
              onClick={handleImport}
              disabled={!importFile || importMut.isPending}
            >
              <Upload className="h-4 w-4" />
              {importMut.isPending ? "Importando..." : "Importar Contatos"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Contato */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-primary">Editar Contato</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Nome</label>
                <Input
                  value={editing.nome ?? ""}
                  onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Telefone</label>
                <Input
                  value={editing.telefone}
                  onChange={(e) => setEditing({ ...editing, telefone: e.target.value })}
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
