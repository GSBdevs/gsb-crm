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
import { formatDate } from "@/lib/utils";
import type { Account, AccountSize, Page } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface AccountForm {
  name: string;
  domain: string;
  industry: string;
  size: AccountSize;
}

const EMPTY: AccountForm = { name: "", domain: "", industry: "", size: "S" };

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebounce(search);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState<AccountForm>(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["accounts", { q: debounced, page }],
    queryFn: () => api<Page<Account>>("/accounts", { params: { q: debounced, page, size: 15 } }),
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

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="hidden md:table-cell">Domínio</TableHead>
              <TableHead className="hidden lg:table-cell">Setor</TableHead>
              <TableHead>Porte</TableHead>
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
              <TableRow key={account.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Building2 className="size-4" />
                    </span>
                    <p className="font-medium">{account.name}</p>
                  </div>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {account.domain || "—"}
                </TableCell>
                <TableCell className="hidden lg:table-cell">{account.industry || "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{account.size}</Badge>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {formatDate(account.created_at)}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => {
                        setEditing(account);
                        setForm({
                          name: account.name,
                          domain: account.domain,
                          industry: account.industry,
                          size: account.size,
                        });
                        setFormOpen(true);
                      }}
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
              Excluir <strong>{deleteTarget?.name}</strong>? Contatos vinculados perdem o vínculo.
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
