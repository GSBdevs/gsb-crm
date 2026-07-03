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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useDebounce } from "@/hooks/use-debounce";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Contact, Lead, LeadStatus, Opportunity, Page } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const STATUS_LABEL: Record<LeadStatus, { label: string; variant: "default" | "secondary" | "success" | "destructive" | "warning" }> = {
  new: { label: "Novo", variant: "default" },
  qualified: { label: "Qualificado", variant: "warning" },
  converted: { label: "Convertido", variant: "success" },
  lost: { label: "Perdido", variant: "destructive" },
};

interface LeadForm {
  name: string;
  email: string;
  phone: string;
  company: string;
  source: string;
  score: number;
  notes: string;
  status?: LeadStatus;
}

const EMPTY_FORM: LeadForm = {
  name: "",
  email: "",
  phone: "",
  company: "",
  source: "",
  score: 0,
  notes: "",
};

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState<LeadForm>(EMPTY_FORM);

  const [convertTarget, setConvertTarget] = useState<Lead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["leads", { q: debouncedSearch, status: statusFilter, page }],
    queryFn: () =>
      api<Page<Lead>>("/leads", {
        params: {
          q: debouncedSearch,
          lead_status: statusFilter === "all" ? undefined : statusFilter,
          page,
          size: 15,
        },
      }),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["leads"] });
    void queryClient.invalidateQueries({ queryKey: ["reports"] });
  };

  const saveMutation = useMutation({
    mutationFn: (payload: LeadForm) =>
      editing
        ? api<Lead>(`/leads/${editing.id}`, { method: "PATCH", json: payload })
        : api<Lead>("/leads", { method: "POST", json: payload }),
    onSuccess: () => {
      toast.success(editing ? "Lead atualizado" : "Lead criado");
      setFormOpen(false);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: (lead: Lead) => api(`/leads/${lead.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Lead excluído");
      setDeleteTarget(null);
      invalidate();
    },
    onError: () => toast.error("Erro ao excluir"),
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(lead: Lead) {
    setEditing(lead);
    setForm({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      source: lead.source,
      score: lead.score,
      notes: lead.notes,
      status: lead.status,
    });
    setFormOpen(true);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.total} lead(s)` : "Carregando…"}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus /> Novo lead
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email, empresa…"
            className="pl-8"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="new">Novo</SelectItem>
            <SelectItem value="qualified">Qualificado</SelectItem>
            <SelectItem value="converted">Convertido</SelectItem>
            <SelectItem value="lost">Perdido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="hidden md:table-cell">Empresa</TableHead>
              <TableHead className="hidden lg:table-cell">Origem</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Criado</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && (data?.items ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Nenhum lead encontrado.
                </TableCell>
              </TableRow>
            )}
            {(data?.items ?? []).map((lead) => {
              const status = STATUS_LABEL[lead.status];
              return (
                <TableRow key={lead.id}>
                  <TableCell>
                    <p className="font-medium">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">{lead.email || "—"}</p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{lead.company || "—"}</TableCell>
                  <TableCell className="hidden capitalize lg:table-cell">
                    {lead.source || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.min(lead.score, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {lead.score}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {formatDate(lead.created_at)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(lead)}>
                          <Pencil /> Editar
                        </DropdownMenuItem>
                        {lead.status !== "converted" && (
                          <DropdownMenuItem onClick={() => setConvertTarget(lead)}>
                            <ArrowRightLeft /> Converter
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteTarget(lead)}
                        >
                          <Trash2 /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}

      {/* Dialog criar/editar */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar lead" : "Novo lead"}</DialogTitle>
            <DialogDescription>
              {editing ? "Atualize as informações do lead." : "Cadastre um novo lead no funil."}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate(form);
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Nome *</Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Empresa</Label>
                <Input
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Origem</Label>
                <Input
                  placeholder="site, indicação, evento…"
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Score (0–100)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.score}
                  onChange={(e) => setForm({ ...form, score: Number(e.target.value) })}
                />
              </div>
              {editing && (
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm({ ...form, status: v as LeadStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Novo</SelectItem>
                      <SelectItem value="qualified">Qualificado</SelectItem>
                      <SelectItem value="lost">Perdido</SelectItem>
                      {editing.status === "converted" && (
                        <SelectItem value="converted">Convertido</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Notas</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog conversão */}
      <ConvertDialog
        lead={convertTarget}
        onClose={() => setConvertTarget(null)}
        onConverted={invalidate}
      />

      {/* Dialog exclusão */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir lead</DialogTitle>
            <DialogDescription>
              Excluir <strong>{deleteTarget?.name}</strong>? Esta ação não pode ser desfeita.
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

function ConvertDialog({
  lead,
  onClose,
  onConverted,
}: {
  lead: Lead | null;
  onClose: () => void;
  onConverted: () => void;
}) {
  const [createOpp, setCreateOpp] = useState(true);
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [accountName, setAccountName] = useState("");

  const convertMutation = useMutation({
    mutationFn: () =>
      api<{ lead: Lead; contact: Contact; opportunity: Opportunity | null }>(
        `/leads/${lead!.id}/convert`,
        {
          method: "POST",
          json: {
            create_opportunity: createOpp,
            opportunity_title: title || null,
            value: value ? Number(value) : null,
            account_name: accountName || null,
          },
        },
      ),
    onSuccess: (result) => {
      toast.success(
        result.opportunity
          ? `Convertido: contato "${result.contact.full_name}" + oportunidade criados`
          : `Convertido: contato "${result.contact.full_name}" criado`,
      );
      onConverted();
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao converter"),
  });

  return (
    <Dialog open={lead !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Converter lead</DialogTitle>
          <DialogDescription>
            Cria um contato a partir de <strong>{lead?.name}</strong>
            {lead?.company ? ` (conta: ${lead.company})` : ""} e, opcionalmente, uma oportunidade
            no pipeline.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--primary)]"
              checked={createOpp}
              onChange={(e) => setCreateOpp(e.target.checked)}
            />
            Criar oportunidade no pipeline
          </label>
          {createOpp && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Título da oportunidade</Label>
                <Input
                  placeholder={lead ? `Oportunidade — ${lead.name}` : ""}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
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
                <Label>Conta (empresa)</Label>
                <Input
                  placeholder={lead?.company || "opcional"}
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={convertMutation.isPending} onClick={() => convertMutation.mutate()}>
            <ArrowRightLeft /> Converter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
