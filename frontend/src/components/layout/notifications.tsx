import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { cn, formatDateTime } from "@/lib/utils";
import type { AppNotification } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";

export function NotificationsBell() {
  const queryClient = useQueryClient();

  const { data: unread } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => api<{ count: number }>("/notifications/unread-count"),
    refetchInterval: 30_000,
  });

  const { data: notifications } = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: () => api<AppNotification[]>("/notifications", { params: { limit: 15 } }),
    refetchInterval: 30_000,
  });

  const markAll = useMutation({
    mutationFn: () => api("/notifications/read-all", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const count = unread?.count ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-4" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between pr-1">
          <DropdownMenuLabel>Notificações</DropdownMenuLabel>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => markAll.mutate()}
            disabled={count === 0}
          >
            <CheckCheck className="size-3.5" /> Ler todas
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {(notifications ?? []).length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              Nenhuma notificação.
            </p>
          )}
          {(notifications ?? []).map((n) => (
            <div
              key={n.id}
              className={cn(
                "border-b border-border/60 px-2 py-2 last:border-0",
                !n.is_read && "bg-primary/5",
              )}
            >
              <div className="flex items-start gap-2">
                {!n.is_read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{n.title}</p>
                  {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                  <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                    {formatDateTime(n.created_at)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
