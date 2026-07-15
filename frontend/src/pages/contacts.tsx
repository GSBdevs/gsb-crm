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
import { DetailField, DetailGrid, orDash } from "@/components/ui/detail";
import { useDebounce } from "@/hooks/use-debounce";
import { api, ApiError } from "@/lib/api";
import { formatDateTime, initials } from "@/lib/utils";
import type { Account, Contact, Page } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ContactForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  tags: string;
  account_id: string;
}

const EMPTY: ContactForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  tags: "",
  account_id: "none",
};

export default function ContactsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebounce(search);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState<ContactForm>(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [detailTarget, setDetailTarget] = useState<Contact | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["contacts", { q: debounced, page }],
    queryFn: () => api<Page<Contact>>("/contacts", { params: { q: debounced, page, size: 15 } }),
  });

  const accounts = useQuery({
    queryKey: ["accounts", "picker"],
    queryFn: () => api<Page<Account>>("/accounts", { params: { size: 100 } }),
  });

  const accountName = (id: string | null) =>
    accounts.data?.items.find((a) => a.id === id)?.name ?? "—";

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["contacts"] });

  const saveMutation = useMutation({
    mutationFn: (payload: ContactForm) => {
      const json = {
        first_name: payload.first_name,
        last_name: payload.last_name,
        email: payload.email || null,
        phone: payload.phone,
        tags: payload.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        account_id: payload.account_id === "none" ? null : payload.account_id,
      };
      return editing
        ? api<Contact>(`/contacts/${editing.id}`, { method: "PATCH", json })
        : api<Contact>("/contacts", { method: "POST", json });
    },
    onSuccess: () => {
      toast.success(editing ? "Contato atualizado" : "Contato criado");
      setFormOpen(false);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: (contact: Contact) => api(`/contacts/${contact.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Contato excluído");
      setDeleteTarget(null);
      invalidate();
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setFormOpen(true);
  }

  function openEdit(contact: Contact) {
    setEditing(contact);
    setForm({
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email ?? "",
      phone: contact.phone,
      tags: contact.tags.join(", "),
      account_id: contact.account_id ?? "none",
    });
    setFormOpen(true);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contatos</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.total} contato(s)` : "Carregando…"}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus /> Novo contato
        </Button>
      </div>

      <div className="relative w-full max-w-xs">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou email…"
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
              <TableHead className="hidden md:table-cell">Telefone</TableHead>
              <TableHead className="hidden lg:table-cell">Conta</TableHead>
              <TableHead className="hidden md:table-cell">Tags</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && (data?.items ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Nenhum contato encontrado.
                </TableCell>
              </TableRow>
            )}
            {(data?.items ?? []).map((contact) => (
              <TableRow
                key={contact.id}
                className="cursor-pointer"
                onClick={() => setDetailTarget(contact)}
              >
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                      {initials(contact.full_name)}
                    </span>
                    <div>
                      <p className="font-medium">{contact.full_name}</p>
                      <p className="text-xs text-muted-foreground">{contact.email ?? "—"}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">{contact.phone || "—"}</TableCell>
                <TableCell className="hidden lg:table-cell">
                  {accountName(contact.account_id)}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {contact.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => openEdit(contact)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 hover:text-destructive"
                      onClick={() => setDeleteTarget(contact)}
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
            <DialogTitle>{editing ? "Editar contato" : "Novo contato"}</DialogTitle>
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
                <Label>Nome *</Label>
                <Input
                  required
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sobrenome</Label>
                <Input
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
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
                <Label>Conta</Label>
                <Select
                  value={form.account_id}
                  onValueChange={(v) => setForm({ ...form, account_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem conta</SelectItem>
                    {(accounts.data?.items ?? []).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Tags (separadas por vírgula)</Label>
                <Input
                  placeholder="vip, decisor, newsletter"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
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

      {/* Dialog de detalhes (somente leitura) */}
      {detailTarget && (
        <Dialog open onOpenChange={(open) => !open && setDetailTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="pr-6">{detailTarget.full_name}</DialogTitle>
              <DialogDescription>
                Contato · criado em {formatDateTime(detailTarget.created_at)}
              </DialogDescription>
            </DialogHeader>
            <DetailGrid>
              <DetailField label="Email">{orDash(detailTarget.email)}</DetailField>
              <DetailField label="Telefone">{orDash(detailTarget.phone)}</DetailField>
              <DetailField label="Conta (empresa)">
                {accountName(detailTarget.account_id)}
              </DetailField>
              <DetailField label="Tags">
                {detailTarget.tags.length > 0 ? (
                  <span className="flex flex-wrap gap-1">
                    {detailTarget.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </span>
                ) : (
                  "—"
                )}
              </DetailField>
            </DetailGrid>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailTarget(null)}>
                Fechar
              </Button>
              <Button
                onClick={() => {
                  const contact = detailTarget;
                  setDetailTarget(null);
                  openEdit(contact);
                }}
              >
                <Pencil /> Editar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir contato</DialogTitle>
            <DialogDescription>
              Excluir <strong>{deleteTarget?.full_name}</strong>?
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
