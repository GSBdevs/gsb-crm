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
import {
  AlertTriangle,
  CalendarClock,
  DollarSign,
  KanbanSquare,
  Printer,
  Repeat,
  UserPlus,
} from "lucide-react";
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

// Paleta dos gráficos — alinhada ao tema preto/cinza/amarelo
const CHART = {
  yellow: "oklch(0.83 0.16 90)",
  amber: "oklch(0.72 0.15 70)",
  gray: "oklch(0.62 0.006 90)",
  grayDark: "oklch(0.45 0.005 90)",
  green: "oklch(0.72 0.17 162)",
  grid: "oklch(0.26 0.005 90)",
};

const TOOLTIP_STYLE = {
  backgroundColor: "oklch(0.19 0.004 90)",
  border: `1px solid ${CHART.grid}`,
  borderRadius: 8,
  fontSize: 12,
};

// Recharts usa #666 por padrão nos eixos — ilegível no tema escuro
const AXIS_TICK = { fontSize: 11, fill: CHART.gray };
const TOOLTIP_LABEL = { color: "oklch(0.96 0 0)", fontWeight: 600 };
const LEGEND_STYLE = { fontSize: 12 };
const CURSOR_FILL = { fill: "oklch(0.26 0.012 90 / 0.35)" };

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
    <Card className="transition-colors hover:border-primary/40">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {title}
            </p>
            <p className="mt-1.5 truncate text-2xl font-bold tracking-tight">{value}</p>
            {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
          </div>
          <div className={`shrink-0 rounded-lg bg-primary/10 p-2.5 ${tone}`}>
            <Icon className="size-5" />
          </div>
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            title="Pipeline aberto (valor mensal)"
            value={formatBRL(s.open_value)}
            hint={`${s.open_opportunities} negócio(s) em andamento`}
            icon={KanbanSquare}
          />
          <KpiCard
            title="MRR em pipeline"
            value={formatBRL(s.mrr_open)}
            hint="receita recorrente mensal em negociação"
            icon={Repeat}
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
            title="Clientes ativos"
            value={String(s.active_accounts)}
            hint={`${s.machines_total} máquina(s) em campo`}
            icon={Printer}
            tone="text-success"
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
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis
                  dataKey="stage"
                  tick={AXIS_TICK}
                  interval={0}
                  angle={-15}
                  dy={8}
                  axisLine={{ stroke: CHART.grid }}
                  tickLine={{ stroke: CHART.grid }}
                />
                <YAxis
                  tick={AXIS_TICK}
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                  axisLine={{ stroke: CHART.grid }}
                  tickLine={{ stroke: CHART.grid }}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={TOOLTIP_LABEL}
                  cursor={CURSOR_FILL}
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
                    <stop offset="0%" stopColor={CHART.gray} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={CHART.gray} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gConverted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART.yellow} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={CHART.yellow} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis
                  dataKey="period"
                  tickFormatter={monthLabel}
                  tick={AXIS_TICK}
                  axisLine={{ stroke: CHART.grid }}
                  tickLine={{ stroke: CHART.grid }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={AXIS_TICK}
                  axisLine={{ stroke: CHART.grid }}
                  tickLine={{ stroke: CHART.grid }}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={TOOLTIP_LABEL}
                  labelFormatter={monthLabel}
                />
                <Legend wrapperStyle={LEGEND_STYLE} />
                <Area
                  type="monotone"
                  dataKey="created"
                  name="Criados"
                  stroke={CHART.gray}
                  fill="url(#gCreated)"
                />
                <Area
                  type="monotone"
                  dataKey="converted"
                  name="Convertidos"
                  stroke={CHART.yellow}
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
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis
                  dataKey="day"
                  tick={{ ...AXIS_TICK, fontSize: 10 }}
                  tickFormatter={(d: string) => d.slice(8)}
                  axisLine={{ stroke: CHART.grid }}
                  tickLine={{ stroke: CHART.grid }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={AXIS_TICK}
                  axisLine={{ stroke: CHART.grid }}
                  tickLine={{ stroke: CHART.grid }}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} cursor={CURSOR_FILL} />
                <Legend wrapperStyle={LEGEND_STYLE} />
                <Bar dataKey="call" name="Ligações" stackId="a" fill={CHART.yellow} />
                <Bar dataKey="email" name="Emails" stackId="a" fill={CHART.gray} />
                <Bar dataKey="meeting" name="Reuniões" stackId="a" fill={CHART.amber} />
                <Bar
                  dataKey="task"
                  name="Tarefas"
                  stackId="a"
                  fill={CHART.grayDark}
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
                    <stop offset="0%" stopColor={CHART.yellow} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={CHART.yellow} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis
                  dataKey="period"
                  tickFormatter={monthLabel}
                  tick={AXIS_TICK}
                  axisLine={{ stroke: CHART.grid }}
                  tickLine={{ stroke: CHART.grid }}
                />
                <YAxis
                  tick={AXIS_TICK}
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                  axisLine={{ stroke: CHART.grid }}
                  tickLine={{ stroke: CHART.grid }}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={TOOLTIP_LABEL}
                  labelFormatter={monthLabel}
                  formatter={(value, name) => [formatBRL(Number(value)), String(name)]}
                />
                <Legend wrapperStyle={LEGEND_STYLE} />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Total no funil"
                  stroke={CHART.gray}
                  fill="transparent"
                  strokeDasharray="4 4"
                />
                <Area
                  type="monotone"
                  dataKey="weighted"
                  name="Ponderado (probabilidade)"
                  stroke={CHART.yellow}
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
