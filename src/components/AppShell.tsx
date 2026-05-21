import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutGrid,
  FileText,
  Link2,
  Smartphone,
  Users,
  ListChecks,
  Headphones,
  Settings,
  LogOut,
  Shield,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutGrid },
  { to: "/historico", label: "Histórico de disparos", icon: FileText },
  { to: "/conexoes", label: "Conexões", icon: Link2 },
  { to: "/disparo", label: "Disparos individuais", icon: Smartphone },
  { to: "/grupos", label: "Disparos em grupo", icon: Users },
  { to: "/listas", label: "Listas", icon: ListChecks },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id);
        setIsAdmin((roles ?? []).some((r: any) => r.role === "admin"));
      }
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card/40">
        <div className="px-6 py-5">
          <h1 className="text-xl font-bold">
            <span className="text-primary">Disparador</span>
            <span className="text-foreground">Ai</span>
          </h1>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = pathname === n.to;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
                {n.label}
              </Link>
            );
          })}
          <a
            href="https://wa.me/5500000000000"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Headphones className="h-[18px] w-[18px]" />
            Suporte
          </a>
          {isAdmin && (
            <Link
              to="/admin"
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                pathname === "/admin"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Shield className="h-[18px] w-[18px]" />
              Admin
            </Link>
          )}
        </nav>

        <div className="mt-auto px-3 pb-2 text-center text-[11px] text-muted-foreground">
          Versão atual: V4.0
        </div>
        <button
          onClick={handleLogout}
          className="mx-3 mb-4 mt-1 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sair
        </button>
      </aside>

      <main className="flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
