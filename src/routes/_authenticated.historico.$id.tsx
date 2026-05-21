import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { getDisparoDetalhes } from "@/lib/disparo.functions";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/historico/$id")({ component: Page });

function statusColor(s: string) {
  if (s === "enviado") return "text-green-500";
  if (s === "erro") return "text-red-500";
  return "text-muted-foreground";
}

function Page() {
  const { id } = Route.useParams();
  const fetchDet = useServerFn(getDisparoDetalhes);
  const [filter, setFilter] = useState<string>("todos");
  const { data, isLoading } = useQuery({
    queryKey: ["disparo", id],
    queryFn: () => fetchDet({ data: { id: Number(id) } }),
    refetchInterval: 5000,
  });

  const disparo = data?.disparo;
  const detalhes = (data?.detalhes ?? []).filter((d: any) =>
    filter === "todos" ? true : d.Status === filter,
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <Link to="/historico" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
        </Link>

        {isLoading || !disparo ? (
          <p className="mt-6 text-muted-foreground">Carregando...</p>
        ) : (
          <>
            <h1 className="mt-4 text-3xl font-bold">Disparo #{disparo.id}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {disparo.tipo} · criado em {new Date(disparo.created_at).toLocaleString()}
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="mt-1 text-lg font-semibold capitalize">{disparo.status}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="mt-1 text-lg font-semibold">{disparo.total ?? 0}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">Enviados</p>
                <p className="mt-1 text-lg font-semibold text-green-500">{disparo.enviados ?? 0}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">Falhas</p>
                <p className="mt-1 text-lg font-semibold text-red-500">{disparo.falhas ?? 0}</p>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              {["todos", "pendente", "enviado", "erro"].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`rounded-md px-3 py-1 text-xs capitalize ${
                    filter === s ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-accent/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Telefone</th>
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Enviado em</th>
                    <th className="px-4 py-3">Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {detalhes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                        Nenhum registro.
                      </td>
                    </tr>
                  ) : (
                    detalhes.map((d: any) => (
                      <tr key={d.id} className="border-t border-border">
                        <td className="px-4 py-3 font-mono text-xs">{d.telefone}</td>
                        <td className="px-4 py-3">{d.nomeContato ?? "-"}</td>
                        <td className={`px-4 py-3 capitalize ${statusColor(d.Status)}`}>{d.Status}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {d.dataEnvio ? new Date(d.dataEnvio).toLocaleString() : "-"}
                        </td>
                        <td className="px-4 py-3 text-xs text-red-500">{d.mensagemErro ?? ""}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
