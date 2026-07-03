import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatBRL } from "@/lib/utils";
import type {
  ActivityDayPoint,
  ForecastPoint,
  StageMetric,
  Summary,
  TimeSeriesPoint,
} from "@/types";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, DollarSign, KanbanSquare, UserPlus } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TOOLTIP_STYLE = {
  backgroundColor: "oklch(0.19 0.018 285)",
  border: "1px solid oklch(0.26 0.018 285)",
  borderRadius: 8,
  fontSize: 12,
};

function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
  tone = "text-primary",
}: {
  title: string;
  value: string;
  hint?: string;
  icon: React.ElementType;
  tone?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`rounded-lg bg-primary/10 p-2.5 ${tone}`}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="truncate text-xl font-bold">{value}</p>
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function monthLabel(period: string): string {
  const [year, month] = period.split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[Number(month) - 1]}/${year?.slice(2)}`;
}

export default function DashboardPage() {
  const summary = useQuery({
    queryKey: ["reports", "summary"],
    queryFn: () => api<Summary>("/reports/summary"),
  });
  const byStage = useQuery({
    queryKey: ["reports", "pipeline-by-stage"],
    queryFn: () => api<StageMetric[]>("/reports/pipeline-by-stage"),
  });
  const timeline = useQuery({
    queryKey: ["reports", "leads-timeline"],
    queryFn: () => api<TimeSeriesPoint[]>("/reports/leads-timeline"),
  });
  const activityDays = useQuery({
    queryKey: ["reports", "activities-by-day"],
    queryFn: () => api<ActivityDayPoint[]>("/reports/activities-by-day"),
  });
  const forecast = useQuery({
    queryKey: ["reports", "forecast"],
    queryFn: () => api<ForecastPoint[]>("/reports/forecast"),
  });

  const s = summary.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral do funil e das atividades.</p>
      </div>

      {!s ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="Pipeline aberto"
            value={formatBRL(s.open_value)}
            hint={`${s.open_opportunities} negócio(s) em andamento`}
            icon={KanbanSquare}
          />
          <KpiCard
            title="Ganho no mês"
            value={formatBRL(s.won_value_month)}
            icon={DollarSign}
            tone="text-success"
          />
          <KpiCard
            title="Leads a trabalhar"
            value={String(s.open_leads + s.qualified_leads)}
            hint={`${s.qualified_leads} qualificado(s)`}
            icon={UserPlus}
          />
          <KpiCard
            title="Atividades hoje"
            value={String(s.activities_due_today)}
            hint={s.activities_overdue > 0 ? `${s.activities_overdue} atrasada(s)` : "em dia"}
            icon={s.activities_overdue > 0 ? AlertTriangle : CalendarClock}
            tone={s.activities_overdue > 0 ? "text-warning" : "text-primary"}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Valor em pipeline por estágio</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byStage.data ?? []} margin={{ left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.26 0.018 285)" />
                <XAxis dataKey="stage" tick={{ fontSize: 11 }} interval={0} angle={-15} dy={8} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value) => [formatBRL(Number(value)), "Valor"]}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {(byStage.data ?? []).map((entry) => (
                    <Cell key={entry.stage} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads criados × convertidos (6 meses)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline.data ?? []}>
                <defs>
                  <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.62 0.21 289)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.62 0.21 289)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gConverted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.72 0.17 162)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.72 0.17 162)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.26 0.018 285)" />
                <XAxis dataKey="period" tickFormatter={monthLabel} tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={monthLabel} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="created"
                  name="Criados"
                  stroke="oklch(0.62 0.21 289)"
                  fill="url(#gCreated)"
                />
                <Area
                  type="monotone"
                  dataKey="converted"
                  name="Convertidos"
                  stroke="oklch(0.72 0.17 162)"
                  fill="url(#gConverted)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Atividades por dia (14 dias)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityDays.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.26 0.018 285)" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(d: string) => d.slice(8)}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend />
                <Bar dataKey="call" name="Ligações" stackId="a" fill="oklch(0.62 0.21 289)" />
                <Bar dataKey="email" name="Emails" stackId="a" fill="oklch(0.7 0.15 230)" />
                <Bar dataKey="meeting" name="Reuniões" stackId="a" fill="oklch(0.8 0.16 84)" />
                <Bar
                  dataKey="task"
                  name="Tarefas"
                  stackId="a"
                  fill="oklch(0.72 0.17 162)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Forecast de receita (6 meses)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecast.data ?? []}>
                <defs>
                  <linearGradient id="gWeighted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.8 0.16 84)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.8 0.16 84)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.26 0.018 285)" />
                <XAxis dataKey="period" tickFormatter={monthLabel} tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={monthLabel}
                  formatter={(value, name) => [formatBRL(Number(value)), String(name)]}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Total no funil"
                  stroke="oklch(0.66 0.015 285)"
                  fill="transparent"
                  strokeDasharray="4 4"
                />
                <Area
                  type="monotone"
                  dataKey="weighted"
                  name="Ponderado (probabilidade)"
                  stroke="oklch(0.8 0.16 84)"
                  fill="url(#gWeighted)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
