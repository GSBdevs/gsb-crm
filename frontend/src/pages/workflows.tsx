import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type {
  ActionSpec,
  ActionType,
  Condition,
  WorkflowExecution,
  WorkflowMeta,
  WorkflowRule,
} from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Pencil, Plus, Trash2, Workflow, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ACTION_LABEL: Record<ActionType, string> = {
  create_activity: "Criar atividade",
  notify: "Notificação in-app",
  send_email: "Enviar email",
  webhook: "Webhook",
};

const OPS = [
  ["eq", "="],
  ["neq", "≠"],
  ["gt", ">"],
  ["gte", "≥"],
  ["lt", "<"],
  ["lte", "≤"],
  ["contains", "contém"],
  ["not_contains", "não contém"],
  ["is_empty", "está vazio"],
  ["not_empty", "não está vazio"],
] as const;

export default function WorkflowsPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WorkflowRule | null>(null);
  const [executionsFor, setExecutionsFor] = useState<WorkflowRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkflowRule | null>(null);

  const { data: rules, isLoading } = useQuery({
    queryKey: ["workflows"],
    queryFn: () => api<WorkflowRule[]>("/workflows"),
  });
  const { data: meta } = useQuery({
    queryKey: ["workflows", "meta"],
    queryFn: () => api<WorkflowMeta>("/workflows/meta"),
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["workflows"] });

  const toggleMutation = useMutation({
    mutationFn: (rule: WorkflowRule) =>
      api<WorkflowRule>(`/workflows/${rule.id}`, {
        method: "PATCH",
        json: { is_active: !rule.is_active },
      }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (rule: WorkflowRule) => api(`/workflows/${rule.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Regra excluída");
      setDeleteTarget(null);
      invalidate();
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
          <p className="text-sm text-muted-foreground">
            Automações: evento → condições → ações.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus /> Nova regra
        </Button>
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      )}

      {!isLoading && (rules ?? []).length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          Nenhuma regra criada ainda. Comece com "Novo lead → tarefa de follow-up".
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {(rules ?? []).map((rule) => (
          <Card key={rule.id} className={rule.is_active ? "" : "opacity-60"}>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div className="space-y-1.5">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Workflow className="size-4 text-primary" />
                  {rule.name}
                </CardTitle>
                <Badge variant="default" className="font-mono text-[11px]">
                  <Zap className="mr-1 size-3" />
                  {rule.trigger_event}
                </Badge>
              </div>
              <Switch
                checked={rule.is_active}
                onCheckedChange={() => toggleMutation.mutate(rule)}
              />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">
                <p>
                  {rule.conditions.length === 0
                    ? "Sem condições (sempre executa)"
                    : `${rule.conditions.length} condição(ões)`}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {rule.actions.map((action, i) => (
                    <Badge key={i} variant="secondary">
                      {ACTION_LABEL[action.type] ?? action.type}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(rule);
                    setFormOpen(true);
                  }}
                >
                  <Pencil /> Editar
                </Button>
                <Button variant="outline" size="sm" onClick={() => setExecutionsFor(rule)}>
                  <History /> Execuções
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hover:text-destructive"
                  onClick={() => setDeleteTarget(rule)}
                >
                  <Trash2 />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {meta && (
        <RuleFormDialog
          key={formOpen ? (editing?.id ?? "new") : "closed"}
          open={formOpen}
          meta={meta}
          rule={editing}
          onClose={() => setFormOpen(false)}
          onSaved={invalidate}
        />
      )}

      <ExecutionsDialog rule={executionsFor} onClose={() => setExecutionsFor(null)} />

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir regra</DialogTitle>
            <DialogDescription>
              Excluir <strong>{deleteTarget?.name}</strong> e seu histórico de execuções?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RuleFormDialog({
  open,
  meta,
  rule,
  onClose,
  onSaved,
}: {
  open: boolean;
  meta: WorkflowMeta;
  rule: WorkflowRule | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const triggers = Object.keys(meta.triggers);
  const [name, setName] = useState(rule?.name ?? "");
  const [trigger, setTrigger] = useState(rule?.trigger_event ?? triggers[0] ?? "");
  const [conditions, setConditions] = useState<Condition[]>(rule?.conditions ?? []);
  const [actions, setActions] = useState<ActionSpec[]>(
    rule?.actions ?? [{ type: "notify", params: {} }],
  );

  const fields = meta.triggers[trigger] ?? [];

  const saveMutation = useMutation({
    mutationFn: () => {
      const json = { name, trigger_event: trigger, conditions, actions };
      return rule
        ? api<WorkflowRule>(`/workflows/${rule.id}`, { method: "PATCH", json })
        : api<WorkflowRule>("/workflows", { method: "POST", json });
    },
    onSuccess: () => {
      toast.success(rule ? "Regra atualizada" : "Regra criada");
      onSaved();
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao salvar"),
  });

  function updateCondition(index: number, patch: Partial<Condition>) {
    setConditions((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function updateAction(index: number, patch: Partial<ActionSpec>) {
    setActions((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  function updateActionParam(index: number, key: string, value: string) {
    setActions((prev) =>
      prev.map((a, i) => (i === index ? { ...a, params: { ...a.params, [key]: value } } : a)),
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{rule ? "Editar regra" : "Nova regra de automação"}</DialogTitle>
          <DialogDescription>
            Use <code className="rounded bg-muted px-1">{"{campo}"}</code> nos textos para
            interpolar dados do evento (ex.: {"{name}"}, {"{value}"}).
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Evento (trigger)</Label>
              <Select
                value={trigger}
                onValueChange={(v) => {
                  setTrigger(v);
                  setConditions([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {triggers.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Condições (todas devem valer)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setConditions([...conditions, { field: fields[0] ?? "", op: "eq", value: "" }])
                }
              >
                <Plus /> Condição
              </Button>
            </div>
            {conditions.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Sem condições — a regra executa para todo evento.
              </p>
            )}
            {conditions.map((condition, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <Select
                  value={condition.field}
                  onValueChange={(v) => updateCondition(index, { field: v })}
                >
                  <SelectTrigger className="w-40 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={condition.op}
                  onValueChange={(v) => updateCondition(index, { op: v })}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPS.map(([op, label]) => (
                      <SelectItem key={op} value={op}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!["is_empty", "not_empty"].includes(condition.op) && (
                  <Input
                    className="min-w-32 flex-1"
                    placeholder="valor"
                    value={String(condition.value ?? "")}
                    onChange={(e) => updateCondition(index, { value: e.target.value })}
                  />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 hover:text-destructive"
                  onClick={() => setConditions(conditions.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Ações</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActions([...actions, { type: "notify", params: {} }])}
              >
                <Plus /> Ação
              </Button>
            </div>
            {actions.map((action, index) => (
              <div key={index} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <Select
                    value={action.type}
                    onValueChange={(v) => updateAction(index, { type: v as ActionType, params: {} })}
                  >
                    <SelectTrigger className="w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ACTION_LABEL) as ActionType[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {ACTION_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex-1" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 hover:text-destructive"
                    onClick={() => setActions(actions.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(meta.actions[action.type] ?? {}).map(([param, hint]) => (
                    <div key={param} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        {param} <span className="font-normal">({hint})</span>
                      </Label>
                      <Input
                        value={String(action.params[param] ?? "")}
                        onChange={(e) => updateActionParam(index, param, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saveMutation.isPending || actions.length === 0}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ExecutionsDialog({
  rule,
  onClose,
}: {
  rule: WorkflowRule | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["workflows", rule?.id, "executions"],
    queryFn: () => api<WorkflowExecution[]>(`/workflows/${rule!.id}/executions`),
    enabled: rule !== null,
  });

  return (
    <Dialog open={rule !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Execuções — {rule?.name}</DialogTitle>
          <DialogDescription>Últimas 50 execuções desta regra.</DialogDescription>
        </DialogHeader>
        {isLoading && <Skeleton className="h-32" />}
        {!isLoading && (data ?? []).length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Esta regra ainda não foi executada.
          </p>
        )}
        {(data ?? []).length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Detalhe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((execution) => (
                <TableRow key={execution.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(execution.executed_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={execution.status === "success" ? "success" : "destructive"}>
                      {execution.status === "success" ? "OK" : "Erro"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {execution.detail}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
