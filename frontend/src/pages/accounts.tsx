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
import { useDebounce } from "@/hooks/use-debounce";
import { api, ApiError } from "@/lib/api";
import { cn, formatBRL, formatDate } from "@/lib/utils";
import type {
  Account,
  AccountSize,
  AccountStatus,
  Contact,
  Machine,
  Opportunity,
  Page,
  Stage,
} from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CircleUser, Pencil, Plus, Printer, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const STATUS_META: Record<
  AccountStatus,
  { label: string; variant: "secondary" | "success" | "outline" }
> = {
  prospect: { label: "Possível cliente", variant: "secondary" },
  active: { label: "Cliente ativo", variant: "success" },
  inactive: { label: "Cliente inativo", variant: "outline" },
};

type StatusFilter = AccountStatus | "all";

interface AccountForm {
  name: string;
  domain: string;
  industry: string;
  size: AccountSize;
  status: AccountStatus;
  cnpj: string;
  city: string;
  state: string;
}

const EMPTY: AccountForm = {
  name: "",
  domain: "",
  industry: "",
  size: "S",
  status: "prospect",
  cnpj: "",
  city: "",
  state: "",
};

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const debounced = useDebounce(search);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState<AccountForm>(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [detailTarget, setDetailTarget] = useState<Account | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["accounts", { q: debounced, page, status: statusFilter }],
    queryFn: () =>
      api<Page<Account>>("/accounts", {
        params: {
          q: debounced,
          account_status: statusFilter === "all" ? undefined : statusFilter,
          page,
          size: 15,
        },
      }),
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["accounts"] });

  const saveMutation = useMutation({
    mutationFn: (payload: AccountForm) =>
      editing
        ? api<Account>(`/accounts/${editing.id}`, { method: "PATCH", json: payload })
        : api<Account>("/accounts", { method: "POST", json: payload }),
    onSuccess: () => {
      toast.success(editing ? "Conta atualizada" : "Conta criada");
      setFormOpen(false);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: (account: Account) => api(`/accounts/${account.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Conta excluída");
      setDeleteTarget(null);
      invalidate();
    },
  });

  function openEdit(account: Account) {
    setEditing(account);
    setForm({
      name: account.name,
      domain: account.domain,
      industry: account.industry,
      size: account.size,
      status: account.status,
      cnpj: account.cnpj,
      city: account.city,
      state: account.state,
    });
    setFormOpen(true);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contas</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.total} conta(s)` : "Carregando…"}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setForm(EMPTY);
            setFormOpen(true);
          }}
        >
          <Plus /> Nova conta
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou domínio…"
            className="pl-8"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex gap-1 rounded-lg bg-muted/50 p-1 text-sm">
          {(
            [
              ["all", "Todas"],
              ["prospect", "Possíveis"],
              ["active", "Ativos"],
              ["inactive", "Inativos"],
            ] as [StatusFilter, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => {
                setStatusFilter(value);
                setPage(1);
              }}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium text-muted-foreground transition-colors",
                statusFilter === value && "bg-card text-foreground shadow-sm",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Setor</TableHead>
              <TableHead className="hidden md:table-cell">Cidade</TableHead>
              <TableHead className="hidden md:table-cell">Criada</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && (data?.items ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Nenhuma conta encontrada.
                </TableCell>
              </TableRow>
            )}
            {(data?.items ?? []).map((account) => (
              <TableRow
                key={account.id}
                className="cursor-pointer"
                onClick={() => setDetailTarget(account)}
              >
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Building2 className="size-4" />
                    </span>
                    <div>
                      <p className="font-medium">{account.name}</p>
                      <p className="text-xs text-muted-foreground">{account.domain || "—"}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_META[account.status].variant}>
                    {STATUS_META[account.status].label}
                  </Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell">{account.industry || "—"}</TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {account.city ? `${account.city}${account.state ? ` — ${account.state}` : ""}` : "—"}
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {formatDate(account.created_at)}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => openEdit(account)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 hover:text-destructive"
                      onClick={() => setDeleteTarget(account)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          <span className="text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Próxima
          </Button>
        </div>
      )}

      {/* Detalhe da conta: dados, contatos, contratos e máquinas */}
      <AccountDetailDialog
        account={detailTarget}
        onClose={() => setDetailTarget(null)}
        onEdit={(account) => {
          setDetailTarget(null);
          openEdit(account);
        }}
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar conta" : "Nova conta"}</DialogTitle>
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
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as AccountStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospect">Possível cliente</SelectItem>
                    <SelectItem value="active">Cliente ativo</SelectItem>
                    <SelectItem value="inactive">Cliente inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Domínio</Label>
                <Input
                  placeholder="empresa.com.br"
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Setor</Label>
                <Input
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Porte</Label>
                <Select
                  value={form.size}
                  onValueChange={(v) => setForm({ ...form, size: v as AccountSize })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="S">S — pequena</SelectItem>
                    <SelectItem value="M">M — média</SelectItem>
                    <SelectItem value="L">L — grande</SelectItem>
                    <SelectItem value="XL">XL — enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>CNPJ</Label>
                <Input
                  placeholder="00.000.000/0000-00"
                  value={form.cnpj}
                  onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                />
              </div>
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

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir conta</DialogTitle>
            <DialogDescription>
              Excluir <strong>{deleteTarget?.name}</strong>? Contatos vinculados perdem o vínculo e
              as máquinas registradas são removidas.
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

function AccountDetailDialog({
  account,
  onClose,
  onEdit,
}: {
  account: Account | null;
  onClose: () => void;
  onEdit: (account: Account) => void;
}) {
  const queryClient = useQueryClient();
  const open = account !== null;

  const contacts = useQuery({
    queryKey: ["contacts", "by-account", account?.id],
    queryFn: () =>
      api<Page<Contact>>("/contacts", { params: { account_id: account!.id, size: 100 } }),
    enabled: open,
  });
  const opportunities = useQuery({
    queryKey: ["opportunities", "by-account", account?.id],
    queryFn: () => api<Opportunity[]>("/opportunities", { params: { account_id: account!.id } }),
    enabled: open,
  });
  const stages = useQuery({
    queryKey: ["stages"],
    queryFn: () => api<Stage[]>("/stages"),
    enabled: open,
  });
  const machines = useQuery({
    queryKey: ["accounts", account?.id, "machines"],
    queryFn: () => api<Machine[]>(`/accounts/${account!.id}/machines`),
    enabled: open,
  });

  const [machineName, setMachineName] = useState("");
  const [machineSerial, setMachineSerial] = useState("");

  const addMachine = useMutation({
    mutationFn: () =>
      api<Machine>(`/accounts/${account!.id}/machines`, {
        method: "POST",
        json: { name: machineName, serial_number: machineSerial },
      }),
    onSuccess: () => {
      toast.success("Máquina registrada");
      setMachineName("");
      setMachineSerial("");
      void queryClient.invalidateQueries({ queryKey: ["accounts", account?.id, "machines"] });
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao registrar"),
  });

  const removeMachine = useMutation({
    mutationFn: (machine: Machine) =>
      api(`/accounts/${account!.id}/machines/${machine.id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounts", account?.id, "machines"] });
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });

  if (account === null) return null;

  const stageById = new Map((stages.data ?? []).map((s) => [s.id, s]));
  const contracts = (opportunities.data ?? []).filter(
    (o) => stageById.get(o.stage_id)?.is_won,
  );
  const openOpps = (opportunities.data ?? []).filter((o) => {
    const stage = stageById.get(o.stage_id);
    return stage && !stage.is_won && !stage.is_lost;
  });
  const meta = STATUS_META[account.status];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
            {account.name}
            <Badge variant={meta.variant}>{meta.label}</Badge>
          </DialogTitle>
          <DialogDescription>
            Conta · criada em {formatDate(account.created_at)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <DetailGrid>
            <DetailField label="CNPJ">{orDash(account.cnpj)}</DetailField>
            <DetailField label="Domínio">{orDash(account.domain)}</DetailField>
            <DetailField label="Setor">{orDash(account.industry)}</DetailField>
            <DetailField label="Porte">{account.size}</DetailField>
            <DetailField label="Localização" full>
              {account.city ? `${account.city}${account.state ? ` — ${account.state}` : ""}` : "—"}
            </DetailField>
          </DetailGrid>

          <DetailSection title={`Contatos (${contacts.data?.items.length ?? 0})`}>
            {(contacts.data?.items ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum contato vinculado.</p>
            ) : (
              <ul className="space-y-1.5">
                {(contacts.data?.items ?? []).map((c) => (
                  <li key={c.id} className="flex items-center gap-2 text-sm">
                    <CircleUser className="size-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium">{c.full_name}</span>
                    <span className="truncate text-muted-foreground">
                      {c.email || c.phone || ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DetailSection>

          <DetailSection title={`Contratos (${contracts.length})`}>
            {contracts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum contrato fechado ainda
                {openOpps.length > 0 ? ` — ${openOpps.length} negociação(ões) em andamento.` : "."}
              </p>
            ) : (
              <ul className="space-y-2">
                {contracts.map((o) => (
                  <li key={o.id} className="rounded-lg border border-border bg-card/60 p-3 text-sm">
                    <p className="font-medium">{o.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {o.billing_type === "monthly"
                        ? `${formatBRL(o.value)}/mês · ${o.contract_months} meses · total ${formatBRL(o.total_value)}`
                        : `${formatBRL(o.value)} (valor único)`}
                      {o.closed_at ? ` · fechado em ${formatDate(o.closed_at)}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </DetailSection>

          <DetailSection title={`Máquinas registradas (${machines.data?.length ?? 0})`}>
            {(machines.data ?? []).length > 0 && (
              <ul className="space-y-1.5">
                {(machines.data ?? []).map((m) => (
                  <li
                    key={m.id}
                    className="group flex items-center gap-2 rounded-md border border-border/60 bg-card/60 px-2.5 py-1.5 text-sm"
                  >
                    <Printer className="size-4 shrink-0 text-primary" />
                    <span className="font-medium">{m.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {m.serial_number ? `S/N ${m.serial_number}` : ""}
                    </span>
                    <button
                      className="ml-auto opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      title="Remover máquina"
                      onClick={() => removeMachine.mutate(m)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (machineName.trim()) addMachine.mutate();
              }}
            >
              <div className="min-w-40 flex-1 space-y-1">
                <Label className="text-xs">Nome da máquina</Label>
                <Input
                  placeholder="Multifuncional A3 color — Recepção"
                  value={machineName}
                  onChange={(e) => setMachineName(e.target.value)}
                />
              </div>
              <div className="w-40 space-y-1">
                <Label className="text-xs">Nº de série</Label>
                <Input
                  placeholder="GSB-000000"
                  value={machineSerial}
                  onChange={(e) => setMachineSerial(e.target.value)}
                />
              </div>
              <Button type="submit" size="sm" disabled={addMachine.isPending || !machineName.trim()}>
                <Plus /> Registrar
              </Button>
            </form>
          </DetailSection>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button onClick={() => onEdit(account)}>
            <Pencil /> Editar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
