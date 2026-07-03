import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import { cn, formatDateTime } from "@/lib/utils";
import type { Activity, ActivityType, Contact, Lead, Opportunity, Page } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Link2, Mail, Phone, Plus, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const TYPE_META: Record<ActivityType, { label: string; icon: React.ElementType }> = {
  call: { label: "Ligação", icon: Phone },
  email: { label: "Email", icon: Mail },
  meeting: { label: "Reunião", icon: Users },
  task: { label: "Tarefa", icon: CalendarCheck },
};

type StateFilter = "open" | "overdue" | "done" | "all";

export default function ActivitiesPage() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<StateFilter>("open");
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["activities", state],
    queryFn: () => api<Page<Activity>>("/activities", { params: { state, size: 100 } }),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["activities"] });
    void queryClient.invalidateQueries({ queryKey: ["reports"] });
  };

  const toggleMutation = useMutation({
    mutationFn: (activity: Activity) =>
      api<Activity>(`/activities/${activity.id}`, {
        method: "PATCH",
        json: { done: activity.done_at === null },
      }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (activity: Activity) => api(`/activities/${activity.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Atividade excluída");
      invalidate();
    },
  });

  const now = new Date();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Atividades</h1>
          <p className="text-sm text-muted-foreground">
            Ligações, emails, reuniões e tarefas — suas e das automações.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus /> Nova atividade
        </Button>
      </div>

      <div className="flex gap-1 rounded-lg bg-muted/50 p-1 text-sm w-fit">
        {(
          [
            ["open", "Abertas"],
            ["overdue", "Atrasadas"],
            ["done", "Concluídas"],
            ["all", "Todas"],
          ] as [StateFilter, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setState(value)}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium text-muted-foreground transition-colors",
              state === value && "bg-card text-foreground shadow-sm",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        {!isLoading && (data?.items ?? []).length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            Nenhuma atividade aqui.
          </div>
        )}
        {(data?.items ?? []).map((activity) => {
          const meta = TYPE_META[activity.type];
          const Icon = meta.icon;
          const done = activity.done_at !== null;
          const overdue = !done && activity.due_at !== null && new Date(activity.due_at) < now;
          return (
            <div
              key={activity.id}
              className={cn(
                "group flex items-center gap-3 rounded-xl border border-border bg-card p-3.5",
                done && "opacity-60",
              )}
            >
              <input
                type="checkbox"
                className="size-4 shrink-0 accent-[var(--primary)]"
                checked={done}
                onChange={() => toggleMutation.mutate(activity)}
                title={done ? "Reabrir" : "Concluir"}
              />
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary",
                  overdue && "bg-destructive/10 text-destructive",
                )}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm font-medium", done && "line-through")}>
                  {activity.title}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{meta.label}</span>
                  {activity.due_at && (
                    <span className={cn(overdue && "font-medium text-destructive")}>
                      {overdue ? "Venceu em " : "Vence em "}
                      {formatDateTime(activity.due_at)}
                    </span>
                  )}
                  {activity.entity_label && (
                    <span className="flex items-center gap-1">
                      <Link2 className="size-3" />
                      {activity.entity_label}
                    </span>
                  )}
                </div>
              </div>
              {overdue && <Badge variant="destructive">Atrasada</Badge>}
              <Button
                variant="ghost"
                size="icon"
                className="size-8 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                onClick={() => deleteMutation.mutate(activity)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        })}
      </div>

      <ActivityFormDialog open={formOpen} onClose={() => setFormOpen(false)} onSaved={invalidate} />
    </div>
  );
}

function ActivityFormDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<ActivityType>("task");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [entityType, setEntityType] = useState<string>("none");
  const [entityId, setEntityId] = useState<string>("none");

  const leads = useQuery({
    queryKey: ["leads", "picker"],
    queryFn: () => api<Page<Lead>>("/leads", { params: { size: 100 } }),
    enabled: open && entityType === "lead",
  });
  const contacts = useQuery({
    queryKey: ["contacts", "picker"],
    queryFn: () => api<Page<Contact>>("/contacts", { params: { size: 100 } }),
    enabled: open && entityType === "contact",
  });
  const opportunities = useQuery({
    queryKey: ["opportunities", "picker"],
    queryFn: () => api<Opportunity[]>("/opportunities"),
    enabled: open && entityType === "opportunity",
  });

  const entityOptions: { id: string; label: string }[] =
    entityType === "lead"
      ? (leads.data?.items ?? []).map((l) => ({ id: l.id, label: l.name }))
      : entityType === "contact"
        ? (contacts.data?.items ?? []).map((c) => ({ id: c.id, label: c.full_name }))
        : entityType === "opportunity"
          ? (opportunities.data ?? []).map((o) => ({ id: o.id, label: o.title }))
          : [];

  const createMutation = useMutation({
    mutationFn: () =>
      api<Activity>("/activities", {
        method: "POST",
        json: {
          type,
          title,
          notes,
          due_at: dueAt ? new Date(dueAt).toISOString() : null,
          entity_type: entityType === "none" ? null : entityType,
          entity_id: entityId === "none" ? null : entityId,
        },
      }),
    onSuccess: () => {
      toast.success("Atividade criada");
      setTitle("");
      setNotes("");
      setDueAt("");
      setEntityType("none");
      setEntityId("none");
      onSaved();
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao criar"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova atividade</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as ActivityType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">Tarefa</SelectItem>
                  <SelectItem value="call">Ligação</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="meeting">Reunião</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Vencimento</Label>
              <Input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Título *</Label>
              <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Vincular a</Label>
              <Select
                value={entityType}
                onValueChange={(v) => {
                  setEntityType(v);
                  setEntityId("none");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nada</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="contact">Contato</SelectItem>
                  <SelectItem value="opportunity">Oportunidade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {entityType !== "none" && (
              <div className="space-y-1.5">
                <Label>Registro</Label>
                <Select value={entityId} onValueChange={setEntityId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione…</SelectItem>
                    {entityOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Notas</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
