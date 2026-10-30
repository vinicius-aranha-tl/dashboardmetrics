import { CheckCircle2, CircleAlert, FlaskConical } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ProjectData, SourceStatus } from "@/lib/sources.functions";
import type { Product } from "@/lib/metrics";
import { cn } from "@/lib/utils";

export function SourceStatusPill({ s, label }: { s: SourceStatus; label: string }) {
  const meta = {
    github: { icon: CheckCircle2, cls: "border-success/40 text-success", text: "GitHub" },
    demo: { icon: FlaskConical, cls: "border-warning/40 text-warning", text: "Demonstração" },
    error: { icon: CircleAlert, cls: "border-danger/50 text-danger", text: "Erro" },
  }[s.mode];
  const Icon = meta.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs", meta.cls)}>
          <Icon className="h-3 w-3" /> {label}: {meta.text}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">
        {s.mode === "demo" && "Fonte não configurada — exibindo dados de demonstração."}
        {s.mode === "github" && `${s.records ?? 0} registros lidos de ${s.url}`}
        {s.mode === "error" && `${s.message} — nenhum dado exibido para esta fonte.`}
      </TooltipContent>
    </Tooltip>
  );
}

export function SourceBadges({ projects, product }: { projects: ProjectData[]; product: Product }) {
  return (
    <div className="flex flex-wrap gap-2">
      {projects.map((p) => (
        <div key={p.project.id} className="flex flex-wrap items-center gap-1.5">
          {projects.length > 1 && <span className="text-xs font-medium text-muted-foreground">{p.project.name}</span>}
          <SourceStatusPill s={p.sources[product].executions} label="Execuções" />
          <SourceStatusPill s={p.sources[product].evolution} label="Evolução" />
        </div>
      ))}
    </div>
  );
}
