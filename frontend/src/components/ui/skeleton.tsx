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

/** Filas de tabla en carga: úsese dentro de <tbody> mientras llegan los datos. */
function FilasSkeleton({ columnas, filas = 5 }: { columnas: number; filas?: number }) {
  return (
    <>
      {Array.from({ length: filas }, (_, i) => (
        <tr key={i} aria-hidden="true">
          {Array.from({ length: columnas }, (_, j) => (
            <td key={j} className="p-3">
              <Skeleton className="h-4 w-full max-w-[9rem]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export { Skeleton, FilasSkeleton }
