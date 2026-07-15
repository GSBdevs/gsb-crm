import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailField, DetailGrid, DetailSection, orDash } from "@/components/ui/detail";
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
import { formatDateTime } from "@/lib/utils";
import type {
  Contact,
  Lead,
  LeadInterest,
  LeadStatus,
  Opportunity,
  Page,
  PrinterType,
} from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const STATUS_LABEL: Record<LeadStatus, { label: string; variant: "default" | "secondary" | "success" | "destructive" | "warning" }> = {
  new: { label: "Novo", variant: "default" },
  qualified: { label: "Qualificado", variant: "warning" },
  converted: { label: "Convertido", variant: "success" },
  lost: { label: "Perdido", variant: "destructive" },
};

const INTEREST_LABEL: Record<LeadInterest, string> = {
  printer_rental: "Locação de impressoras",
  it_outsourcing: "Outsourcing de TI",
  both: "Locação + TI",
};

const PRINTER_TYPE_LABEL: Record<string, string> = {
  a4_mono: "A4 mono",
  a4_color: "A4 color",
  a3_mono: "A3 mono",
  a3_color: "A3 color",
  mixed: "Misto (A4 + A3)",
};

const wantsPrinting = (interest: LeadInterest) => interest !== "it_outsourcing";
const wantsIT = (interest: LeadInterest) => interest !== "printer_rental";

interface LeadForm {
  name: string;
  email: string;
  phone: string;
  company: string;
  cnpj: string;
  city: string;
  state: string;
  source: string;
  notes: string;
  interest: LeadInterest;
  current_provider: string;
  printer_type: PrinterType;
  printer_count: number;
  monthly_volume_mono: number;
  monthly_volume_color: number;
  it_product: string;
  it_quantity: number;
  it_specs: string;
  status?: LeadStatus;
}

const EMPTY_FORM: LeadForm = {
  name: "",
  email: "",
  phone: "",
  company: "",
  cnpj: "",
  city: "",
  state: "",
  source: "",
  notes: "",
  interest: "printer_rental",
  current_provider: "",
  printer_type: "",
  printer_count: 0,
  monthly_volume_mono: 0,
  monthly_volume_color: 0,
  it_product: "",
  it_quantity: 0,
  it_specs: "",
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

  const [detailTarget, setDetailTarget] = useState<Lead | null>(null);
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
    mutationFn: (payload: LeadForm) => {
      return editing
        ? api<Lead>(`/leads/${editing.id}`, { method: "PATCH", json: payload })
        : api<Lead>("/leads", { method: "POST", json: payload });
    },
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
      cnpj: lead.cnpj,
      city: lead.city,
      state: lead.state,
      source: lead.source,
      notes: lead.notes,
      interest: lead.interest,
      current_provider: lead.current_provider,
      printer_type: lead.printer_type,
      printer_count: lead.printer_count,
      monthly_volume_mono: lead.monthly_volume_mono,
      monthly_volume_color: lead.monthly_volume_color,
      it_product: lead.it_product,
      it_quantity: lead.it_quantity,
      it_specs: lead.it_specs,
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
              <TableHead>Interesse</TableHead>
              <TableHead className="hidden lg:table-cell">Cidade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && (data?.items ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Nenhum lead encontrado.
                </TableCell>
              </TableRow>
            )}
            {(data?.items ?? []).map((lead) => {
              const status = STATUS_LABEL[lead.status];
              return (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer"
                  onClick={() => setDetailTarget(lead)}
                >
                  <TableCell>
                    <p className="font-medium">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">{lead.email || "—"}</p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <p>{lead.company || "—"}</p>
                    {lead.printer_count > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {lead.printer_count} impressora(s)
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{INTEREST_LABEL[lead.interest]}</Badge>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {lead.city ? `${lead.city}${lead.state ? ` — ${lead.state}` : ""}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
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

      {/* Dialog de detalhes (somente leitura) */}
      <LeadDetailDialog
        lead={detailTarget}
        onClose={() => setDetailTarget(null)}
        onEdit={(lead) => {
          setDetailTarget(null);
          openEdit(lead);
        }}
      />

      {/* Dialog criar/editar */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar lead" : "Novo lead"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Atualize as informações do lead."
                : "Etapa 1 — dados básicos. Etapa 2 — especificação do serviço."}
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
              <div className="space-y-1.5">
                <Label>Contato (quem procurou) *</Label>
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
                <Label>Razão social / Empresa</Label>
                <Input
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>CNPJ</Label>
                <Input
                  placeholder="00.000.000/0000-00"
                  value={form.cnpj}
                  onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-[1fr_5rem] gap-2">
                <div className="space-y-1.5">
                  <Label>Cidade</Label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>UF</Label>
                  <Input
                    maxLength={2}
                    placeholder="SP"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
                  />
                </div>
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
                <Label>Interesse</Label>
                <Select
                  value={form.interest}
                  onValueChange={(v) => setForm({ ...form, interest: v as LeadInterest })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="printer_rental">Locação de impressoras</SelectItem>
                    <SelectItem value="it_outsourcing">Outsourcing de TI</SelectItem>
                    <SelectItem value="both">Locação + TI</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {wantsPrinting(form.interest) && (
                <>
                  <div className="sm:col-span-2 mt-1 border-t border-border pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Especificação — impressão
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tipo de máquina</Label>
                    <Select
                      value={form.printer_type || "unset"}
                      onValueChange={(v) =>
                        setForm({ ...form, printer_type: (v === "unset" ? "" : v) as PrinterType })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unset">A definir</SelectItem>
                        <SelectItem value="a4_mono">A4 mono</SelectItem>
                        <SelectItem value="a4_color">A4 color</SelectItem>
                        <SelectItem value="a3_mono">A3 mono</SelectItem>
                        <SelectItem value="a3_color">A3 color</SelectItem>
                        <SelectItem value="mixed">Misto (A4 + A3)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nº de impressoras</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.printer_count}
                      onChange={(e) => setForm({ ...form, printer_count: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Franquia mensal P&B (págs)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.monthly_volume_mono}
                      onChange={(e) =>
                        setForm({ ...form, monthly_volume_mono: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Franquia mensal color (págs)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.monthly_volume_color}
                      onChange={(e) =>
                        setForm({ ...form, monthly_volume_color: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Fornecedor atual</Label>
                    <Input
                      placeholder="quem atende hoje (se houver)"
                      value={form.current_provider}
                      onChange={(e) => setForm({ ...form, current_provider: e.target.value })}
                    />
                  </div>
                </>
              )}

              {wantsIT(form.interest) && (
                <>
                  <div className="sm:col-span-2 mt-1 border-t border-border pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Especificação — outsourcing de tecnologia
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Produto</Label>
                    <Input
                      placeholder="notebooks, desktops, firewall…"
                      value={form.it_product}
                      onChange={(e) => setForm({ ...form, it_product: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Quantidade</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.it_quantity}
                      onChange={(e) => setForm({ ...form, it_quantity: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Especificações</Label>
                    <Textarea
                      placeholder="configuração, requisitos, observações técnicas…"
                      value={form.it_specs}
                      onChange={(e) => setForm({ ...form, it_specs: e.target.value })}
                    />
                  </div>
                </>
              )}

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

      {/* Dialog conversão — key remonta o form a cada lead (evita estado herdado) */}
      <ConvertDialog
        key={convertTarget?.id ?? "closed"}
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

function LeadDetailDialog({
  lead,
  onClose,
  onEdit,
}: {
  lead: Lead | null;
  onClose: () => void;
  onEdit: (lead: Lead) => void;
}) {
  if (lead === null) return null;
  const status = STATUS_LABEL[lead.status];
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
            {lead.name}
            <Badge variant={status.variant}>{status.label}</Badge>
          </DialogTitle>
          <DialogDescription>
            {INTEREST_LABEL[lead.interest]} · criado em {formatDateTime(lead.created_at)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <DetailGrid>
            <DetailField label="Razão social / Empresa">{orDash(lead.company)}</DetailField>
            <DetailField label="CNPJ">{orDash(lead.cnpj)}</DetailField>
            <DetailField label="Localização">
              {lead.city ? `${lead.city}${lead.state ? ` — ${lead.state}` : ""}` : "—"}
            </DetailField>
            <DetailField label="Origem">{orDash(lead.source)}</DetailField>
            <DetailField label="Email">{orDash(lead.email)}</DetailField>
            <DetailField label="Telefone">{orDash(lead.phone)}</DetailField>
          </DetailGrid>

          {wantsPrinting(lead.interest) && (
            <DetailSection title="Especificação — impressão">
              <DetailGrid>
                <DetailField label="Tipo de máquina">
                  {PRINTER_TYPE_LABEL[lead.printer_type] ?? "A definir"}
                </DetailField>
                <DetailField label="Nº de impressoras">
                  {lead.printer_count || "—"}
                </DetailField>
                <DetailField label="Franquia mensal P&B">
                  {lead.monthly_volume_mono ? `${lead.monthly_volume_mono} págs` : "—"}
                </DetailField>
                <DetailField label="Franquia mensal color">
                  {lead.monthly_volume_color ? `${lead.monthly_volume_color} págs` : "—"}
                </DetailField>
                <DetailField label="Fornecedor atual" full>
                  {orDash(lead.current_provider)}
                </DetailField>
              </DetailGrid>
            </DetailSection>
          )}

          {wantsIT(lead.interest) && (
            <DetailSection title="Especificação — outsourcing de tecnologia">
              <DetailGrid>
                <DetailField label="Produto">{orDash(lead.it_product)}</DetailField>
                <DetailField label="Quantidade">{lead.it_quantity || "—"}</DetailField>
                <DetailField label="Especificações" full>
                  {orDash(lead.it_specs)}
                </DetailField>
              </DetailGrid>
            </DetailSection>
          )}

          {lead.notes && (
            <DetailSection title="Notas">
              <p className="whitespace-pre-wrap text-sm">{lead.notes}</p>
            </DetailSection>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button onClick={() => onEdit(lead)}>
            <Pencil /> Editar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const [contractMonths, setContractMonths] = useState("36");

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
            contract_months: Number(contractMonths) || 12,
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
                <Label>Valor mensal (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Prazo (meses)</Label>
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={contractMonths}
                  onChange={(e) => setContractMonths(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
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
