import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { getDashboardStats } from "@/lib/disparo.functions";
import { getDisparosPorDia } from "@/lib/configuracoes.functions";
import { FileText, Link2 as LinkIcon, Smartphone, BarChart2 } from "lucide-react";
import {
  AreaChart,
  Area,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/_authenticated/")({ component: Index });

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: any;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-3 text-4xl font-bold text-primary">{value}</p>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Index() {
  const qc = useQueryClient();
  const fetchStats = useServerFn(getDashboardStats);
  const fetchChart = useServerFn(getDisparosPorDia);
  const [dias, setDias] = useState(7);

  const { data } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => fetchStats(),
    refetchInterval: 10000,
  });
  const { data: chart = [] } = useQuery({
    queryKey: ["chart", dias],
    queryFn: () => fetchChart({ data: { dias } }),
    refetchInterval: 30000,
  });

  const today = new Date().toISOString().slice(0, 10);
  const start = new Date();
  start.setDate(start.getDate() - dias);

  return (
    <AppShell>
      <PageHeader
        title="Dashboard"
        subtitle="Acompanhe suas métricas e performance em tempo real"
        onRefresh={() => {
          qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
          qc.invalidateQueries({ queryKey: ["chart"] });
        }}
      />

      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Período</p>
          <div className="flex gap-1">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setDias(d)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  dias === d
                    ? "bg-primary/15 text-primary"
                    : "border border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                {d} dias
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Data Inicial
          </label>
          <input
            type="date"
            value={start.toISOString().slice(0, 10)}
            readOnly
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Data Final
          </label>
          <input
            type="date"
            value={today}
            readOnly
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total de Disparos"
          value={data?.totalDisparos ?? 0}
          hint="+0% vs período anterior"
          icon={FileText}
        />
        <StatCard
          label="Conexões Ativas"
          value={data?.conexoesConectadas ?? 0}
          hint="+0% vs período anterior"
          icon={LinkIcon}
        />
        <StatCard
          label="Total de Conexões"
          value={data?.totalConexoes ?? 0}
          hint="+0% vs período anterior"
          icon={Smartphone}
        />
        <StatCard
          label="Média por Conexão"
          value={
            data?.totalConexoes
              ? Math.round((data.totalEnviados ?? 0) / data.totalConexoes).toLocaleString("pt-BR")
              : 0
          }
          hint="+0% vs período anterior"
          icon={BarChart2}
        />
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-6">
        <h2 className="font-semibold">Disparos por Dia</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe a evolução dos seus disparos ao longo do tempo
        </p>
        <div className="mt-6 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart}>
              <defs>
                <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.72 0.18 152)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="oklch(0.72 0.18 152)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.012 240)" />
              <XAxis
                dataKey="date"
                stroke="oklch(0.68 0.02 240)"
                tickFormatter={(v) => {
                  const d = new Date(v);
                  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
                }}
                fontSize={11}
              />
              <YAxis stroke="oklch(0.68 0.02 240)" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "oklch(0.21 0.012 240)",
                  border: "1px solid oklch(0.28 0.012 240)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="oklch(0.72 0.18 152)"
                strokeWidth={2}
                fill="url(#gradGreen)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </AppShell>
  );
}
