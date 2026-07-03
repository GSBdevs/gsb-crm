import { NotificationsBell } from "@/components/layout/notifications";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/auth";
import { cn, initials } from "@/lib/utils";
import {
  Building2,
  CalendarCheck,
  Contact,
  Hexagon,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Menu,
  UserPlus,
  Workflow,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/leads", label: "Leads", icon: UserPlus },
  { to: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { to: "/contatos", label: "Contatos", icon: Contact },
  { to: "/contas", label: "Contas", icon: Building2 },
  { to: "/atividades", label: "Atividades", icon: CalendarCheck },
  { to: "/workflows", label: "Workflows", icon: Workflow },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <Hexagon className="size-6 fill-primary/20 text-primary" />
        <span className="text-sm font-bold tracking-tight">
          GrupoSB <span className="text-primary">CRM</span>
        </span>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                isActive && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
              )
            }
          >
            <Icon className="size-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-border p-3 text-[11px] text-muted-foreground">
        v0.1.0 — FastAPI + React
      </div>
    </>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-card/40 md:flex">
        <SidebarContent />
      </aside>

      {/* Drawer de navegação para telas estreitas */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-card shadow-xl">
            <button
              className="absolute right-3 top-4 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileNavOpen(false)}
            >
              <X className="size-5" />
            </button>
            <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/40 px-4">
          <div className="flex items-center gap-2 md:hidden">
            <Button variant="ghost" size="icon" onClick={() => setMobileNavOpen(true)}>
              <Menu className="size-5" />
            </Button>
            <Hexagon className="size-6 fill-primary/20 text-primary" />
          </div>
          <div className="hidden text-sm text-muted-foreground md:block">
            {new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(new Date())}
          </div>
          <div className="flex items-center gap-2">
            <NotificationsBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <span className="flex size-7 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                    {initials(user?.full_name || user?.email || "?")}
                  </span>
                  <span className="hidden max-w-32 truncate text-sm sm:block">
                    {user?.full_name || user?.email}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>
                  <p className="truncate">{user?.email}</p>
                  <p className="font-normal capitalize text-muted-foreground">{user?.role}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
