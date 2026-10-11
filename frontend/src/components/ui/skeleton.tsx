import { cn } from "@/lib/utils"

/** Marcador de carga: mantiene el espacio del contenido y evita saltos de diseño. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-slate-200/70", className)}
      {...props}
    />
  )
}

export { Skeleton }
