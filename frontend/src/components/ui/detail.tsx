import { cn } from "@/lib/utils";

/**
 * Blocos de leitura para dialogs de detalhe (não editáveis).
 * DetailGrid organiza pares rótulo/valor em duas colunas.
 */
export function DetailGrid({ className, ...props }: React.HTMLAttributes<HTMLDListElement>) {
  return <dl className={cn("grid gap-x-6 gap-y-3 sm:grid-cols-2", className)} {...props} />;
}

export function DetailField({
  label,
  children,
  full = false,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={cn("min-w-0", full && "sm:col-span-2")}>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm">{children ?? "—"}</dd>
    </div>
  );
}

export function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2 border-t border-border pt-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Valor textual com fallback para campos vazios. */
export function orDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}
