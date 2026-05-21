import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function PageHeader({
  title,
  subtitle,
  onRefresh,
  actions,
}: {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {onRefresh && (
          <Button onClick={onRefresh} size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Atualizar
          </Button>
        )}
      </div>
    </div>
  );
}
