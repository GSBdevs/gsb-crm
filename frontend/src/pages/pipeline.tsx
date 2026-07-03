import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { api, ApiError } from "@/lib/api";
import { cn, formatBRL } from "@/lib/utils";
import type { BillingType, Contact, Opportunity, Page, ServiceType, Stage } from "@/types";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CircleUser, Plus, Printer, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const SERVICE_LABEL: Record<ServiceType, string> = {
  printer_rental: "Locação de impressoras",
  it_outsourcing: "Outsourcing de TI",
  mixed: "Locação + TI",
};

export default function PipelinePage() {
  const queryClient = useQueryClient();
  const [addStage, setAddStage] = useState<Stage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Opportunity | null>(null);

  const stagesQuery = useQuery({
    queryKey: ["stages"],
    queryFn: () => api<Stage[]>("/stages"),
  });
  const oppsQuery = useQuery({
    queryKey: ["opportunities"],
    queryFn: () => api<Opportunity[]>("/opportunities"),
  });

  const byStage = useMemo(() => {
    const map = new Map<string, Opportunity[]>();
    for (const stage of stagesQuery.data ?? []) map.set(stage.id, []);
    for (const opp of oppsQuery.data ?? []) {
      map.get(opp.stage_id)?.push(opp);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [stagesQuery.data, oppsQuery.data]);

  const moveMutation = useMutation({
    mutationFn: ({ id, stageId, position }: { id: string; stageId: string; position: number }) =>
      api<Opportunity>(`/opportunities/${id}/move`, {
        method: "PATCH",
        json: { stage_id: stageId, position },
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao mover"),
  });

  const deleteMutation = useMutation({
    mutationFn: (opp: Opportunity) => api(`/opportunities/${opp.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Oportunidade excluída");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });

  function onDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    // Atualização otimista do cache do board
    queryClient.setQueryData<Opportunity[]>(["opportunities"], (old) => {
      if (!old) return old;
      const moved = old.find((o) => o.id === draggableId);
      if (!moved) return old;
      const rest = old.filter((o) => o.id !== draggableId);
      const destList = rest
        .filter((o) => o.stage_id === destination.droppableId)
        .sort((a, b) => a.position - b.position);
      destList.splice(destination.index, 0, { ...moved, stage_id: destination.droppableId });
      const repositioned = new Map(destList.map((o, i) => [o.id, i]));
      return [
        ...rest.filter((o) => o.stage_id !== destination.droppableId),
        ...destList.map((o) => ({ ...o, position: repositioned.get(o.id) ?? o.position })),
      ];
    });

    moveMutation.mutate({
      id: draggableId,
      stageId: destination.droppableId,
      position: destination.index,
    });
  }

  const isLoading = stagesQuery.isLoading || oppsQuery.isLoading;

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Arraste as oportunidades entre os estágios.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-96 w-72 shrink-0" />
          ))}
        </div>
      ) : (stagesQuery.data ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          Nenhum estágio cadastrado. Rode o seed do backend ou crie estágios via API
          (<code>POST /api/v1/stages</code>).
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex flex-1 gap-3 overflow-x-auto pb-3">
            {(stagesQuery.data ?? []).map((stage) => {
              const opportunities = byStage.get(stage.id) ?? [];
              const totalValue = opportunities.reduce((acc, o) => acc + o.value, 0);
              return (
                <div
                  key={stage.id}
                  className={cn(
                    "flex w-72 shrink-0 flex-col rounded-xl border border-border bg-card/50",
                    stage.is_won && "border-success/40",
                    stage.is_lost && "border-destructive/30",
                  )}
                >
                  <div className="flex items-center justify-between p-3 pb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="text-sm font-semibold">{stage.name}</span>
                      <Badge variant="secondary" className="px-1.5 text-[11px]">
                        {opportunities.length}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => setAddStage(stage)}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  <Droppable droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          "flex-1 space-y-2 overflow-y-auto px-2 pb-2 transition-colors",
                          snapshot.isDraggingOver && "rounded-lg bg-primary/5",
                        )}
                        style={{ minHeight: 120 }}
                      >
                        {opportunities.map((opp, index) => (
                          <Draggable key={opp.id} draggableId={opp.id} index={index}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={cn(
                                  "group rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow",
                                  dragSnapshot.isDragging && "rotate-1 shadow-lg ring-1 ring-primary/40",
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-medium leading-snug">{opp.title}</p>
                                  <button
                                    className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                                    onClick={() => setDeleteTarget(opp)}
                                    title="Excluir"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </div>
                                <div className="mt-2 flex items-center justify-between">
                                  <span className="text-sm font-bold text-primary">
                                    {formatBRL(opp.value)}
                                    {opp.billing_type === "monthly" && (
                                      <span className="font-normal text-muted-foreground">
                                        /mês · {opp.contract_months}m
                                      </span>
                                    )}
                                  </span>
                                  <Badge variant="outline" className="text-[10px]">
                                    {opp.probability}%
                                  </Badge>
                                </div>
                                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                  <Printer className="size-3" />
                                  {SERVICE_LABEL[opp.service_type]}
                                  {opp.billing_type === "monthly" && (
                                    <span className="ml-auto">
                                      total {formatBRL(opp.total_value)}
                                    </span>
                                  )}
                                </div>
                                {(opp.contact_name || opp.account_name) && (
                                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                    {opp.contact_name && (
                                      <p className="flex items-center gap-1.5">
                                        <CircleUser className="size-3" /> {opp.contact_name}
                                      </p>
                                    )}
                                    {opp.account_name && (
                                      <p className="flex items-center gap-1.5">
                                        <Building2 className="size-3" /> {opp.account_name}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                  <div className="border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
                    Total: <span className="font-semibold">{formatBRL(totalValue)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}

      <AddOpportunityDialog stage={addStage} onClose={() => setAddStage(null)} />

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir oportunidade</DialogTitle>
            <DialogDescription>
              Excluir <strong>{deleteTarget?.title}</strong>?
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

function AddOpportunityDialog({ stage, onClose }: { stage: Stage | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [contactId, setContactId] = useState<string>("none");
  const [expectedClose, setExpectedClose] = useState("");
  const [serviceType, setServiceType] = useState<ServiceType>("printer_rental");
  const [billingType, setBillingType] = useState<BillingType>("monthly");
  const [contractMonths, setContractMonths] = useState("36");

  const contacts = useQuery({
    queryKey: ["contacts", "picker"],
    queryFn: () => api<Page<Contact>>("/contacts", { params: { size: 100 } }),
    enabled: stage !== null,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api<Opportunity>("/opportunities", {
        method: "POST",
        json: {
          title,
          value: value ? Number(value) : 0,
          stage_id: stage!.id,
          contact_id: contactId === "none" ? null : contactId,
          expected_close: expectedClose || null,
          service_type: serviceType,
          billing_type: billingType,
          contract_months: Number(contractMonths) || 12,
        },
      }),
    onSuccess: () => {
      toast.success("Oportunidade criada");
      void queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
      setTitle("");
      setValue("");
      setContactId("none");
      setExpectedClose("");
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao criar"),
  });

  return (
    <Dialog open={stage !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova oportunidade</DialogTitle>
          <DialogDescription>
            Será criada no estágio <strong>{stage?.name}</strong>.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fechamento esperado</Label>
              <Input
                type="date"
                value={expectedClose}
                onChange={(e) => setExpectedClose(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Serviço</Label>
              <Select value={serviceType} onValueChange={(v) => setServiceType(v as ServiceType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="printer_rental">Locação de impressoras</SelectItem>
                  <SelectItem value="it_outsourcing">Outsourcing de TI</SelectItem>
                  <SelectItem value="mixed">Locação + TI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cobrança</Label>
              <Select value={billingType} onValueChange={(v) => setBillingType(v as BillingType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal (recorrente)</SelectItem>
                  <SelectItem value="one_time">Valor único</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prazo (meses)</Label>
              <Input
                type="number"
                min={1}
                max={120}
                disabled={billingType === "one_time"}
                value={contractMonths}
                onChange={(e) => setContractMonths(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Contato</Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem contato</SelectItem>
                {(contacts.data?.items ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
