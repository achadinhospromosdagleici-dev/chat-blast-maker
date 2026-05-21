import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { listDisparos, deleteDisparo } from "@/lib/disparo.functions";
import { MoreHorizontal, Trash2, Eye, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/historico")({ component: Page });

function statusClasses(s: string) {
  if (s === "concluido" || s === "finalizado")
    return "bg-primary/15 text-primary border border-primary/30";
  if (s === "ativo" || s === "em_andamento")
    return "bg-yellow-500/10 text-yellow-500 border border-yellow-500/30";
  if (s === "pausado")
    return "bg-yellow-500/10 text-yellow-500 border border-yellow-500/30";
  if (s === "erro" || s === "falha")
    return "bg-destructive/15 text-destructive border border-destructive/30";
  return "bg-muted text-muted-foreground border border-border";
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    concluido: "Finalizado",
    finalizado: "Finalizado",
    ativo: "Em andamento",
    em_andamento: "Em andamento",
    pausado: "Pausado",
    erro: "Erro",
    falha: "Falha",
    pendente: "Pendente",
  };
  return map[s] ?? s;
}

function Page() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listDisparos);
  const fetchDelete = useServerFn(deleteDisparo);
  const [tipo, setTipo] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [menuFor, setMenuFor] = useState<number | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["disparos"],
    queryFn: () => fetchList(),
    refetchInterval: 5000,
  });

  const filtered = useMemo(() => {
    return (data as any[]).filter((d) => {
      if (tipo && d.tipo !== tipo) return false;
      if (status && d.status !== status) return false;
      return true;
    });
  }, [data, tipo, status]);

  const del = useMutation({
    mutationFn: (id: number) => fetchDelete({ data: { id } }),
    onSuccess: () => {
      toast.success("Disparo excluído");
      qc.invalidateQueries({ queryKey: ["disparos"] });
      setMenuFor(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <PageHeader
        title="Histórico de Disparos"
        subtitle="Visualize e acompanhe todos os seus disparos em tempo real"
        onRefresh={() => qc.invalidateQueries({ queryKey: ["disparos"] })}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Tipo de Disparo
          </label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="">Todos os tipos</option>
            <option value="individual">Individual</option>
            <option value="grupo">Grupo</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="">Todos os status</option>
            <option value="ativo">Em andamento</option>
            <option value="pausado">Pausado</option>
            <option value="concluido">Finalizado</option>
            <option value="erro">Erro</option>
          </select>
        </div>
        {(tipo || status) && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              setTipo("");
              setStatus("");
            }}
          >
            <X className="h-3 w-3" /> Limpar Filtros
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-4">Data / Hora</th>
              <th className="px-5 py-4">Tipo</th>
              <th className="px-5 py-4 text-center">Total</th>
              <th className="px-5 py-4 text-center">Enviados</th>
              <th className="px-5 py-4">Progresso</th>
              <th className="px-5 py-4 text-center">Status</th>
              <th className="px-5 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">
                  Nenhum disparo encontrado.
                </td>
              </tr>
            )}
            {filtered.map((d: any) => {
              const pct =
                d.total && d.total > 0
                  ? Math.min(100, Math.round(((d.enviados ?? 0) / d.total) * 100))
                  : 0;
              const date = new Date(d.created_at);
              return (
                <tr key={d.id} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-4">
                    <div className="text-sm">{date.toLocaleDateString("pt-BR")}</div>
                    <div className="text-xs text-muted-foreground">
                      {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      {d.tipo === "grupo" ? "Grupo" : "Individual"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center font-semibold text-primary">
                    {(d.total ?? 0).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-5 py-4 text-center font-semibold text-primary">
                    {(d.enviados ?? 0).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-5 py-4">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{pct}%</div>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${statusClasses(d.status)}`}
                    >
                      {statusLabel(d.status)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="relative flex justify-end">
                      <button
                        onClick={() => setMenuFor(menuFor === d.id ? null : d.id)}
                        className="rounded-md p-2 text-muted-foreground hover:bg-accent"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {menuFor === d.id && (
                        <div
                          className="absolute right-0 top-full z-20 mt-1 w-44 rounded-md border border-border bg-popover py-1 shadow-lg"
                          onMouseLeave={() => setMenuFor(null)}
                        >
                          <Link
                            to="/historico/$id"
                            params={{ id: String(d.id) }}
                            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                          >
                            <Eye className="h-4 w-4" /> Ver detalhes
                          </Link>
                          <button
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (confirm(`Excluir disparo #${d.id}?`)) del.mutate(d.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" /> Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
