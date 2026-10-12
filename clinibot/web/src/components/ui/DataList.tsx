import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { cn } from "@/lib/cn";
import { Skeleton } from "./Skeleton";

export interface DataColumn<T> {
  /** Unique column id. */
  key: string;
  header: ReactNode;
  cell: (item: T) => ReactNode;
  /** The row's title: rendered first and bold on phones, and as the link when `rowHref` is set. */
  primary?: boolean;
  /** Not shown on the phone card layout. */
  hideOnMobile?: boolean;
  /** Extra classes for the <td>/<th> (e.g. "w-32 text-end"). */
  className?: string;
}

export interface DataListProps<T> {
  items: readonly T[];
  columns: DataColumn<T>[];
  getKey: (item: T) => string;
  /** Accessible table name (visually hidden). */
  caption: string;
  /** Makes each row open a page; the primary cell becomes a real link. */
  rowHref?: (item: T) => string;
  loading?: boolean;
  /** Shown when there are no items (usually an <EmptyState>). */
  empty?: ReactNode;
  className?: string;
}

/**
 * A table on desktop (md+) and a stack of cards on phones, from one column
 * definition. Keep 3–6 columns; mark one `primary`.
 */
export function DataList<T>({
  items,
  columns,
  getKey,
  caption,
  rowHref,
  loading = false,
  empty,
  className,
}: DataListProps<T>) {
  const primary = columns.find((column) => column.primary) ?? columns[0];
  const secondary = columns.filter((column) => column !== primary && !column.hideOnMobile);

  if (loading) {
    return (
      <div className={cn("flex flex-col gap-3 p-4", className)} aria-busy="true">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (items.length === 0 && empty) return <div className={className}>{empty}</div>;

  return (
    <div className={className}>
      {/* Desktop table */}
      <table className="hidden w-full border-collapse text-sm md:table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-slate-200">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-4 py-3 text-start text-xs font-bold tracking-wide text-slate-500",
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={getKey(item)} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
              {columns.map((column) => {
                const content = column.cell(item);
                const isPrimary = column === primary;
                return (
                  <td
                    key={column.key}
                    className={cn(
                      "px-4 py-3 align-middle text-slate-700",
                      isPrimary && "font-bold text-slate-900",
                      column.className,
                    )}
                  >
                    {isPrimary && rowHref ? (
                      <Link
                        to={rowHref(item)}
                        className="rounded hover:text-primary hover:underline focus-visible:outline-2"
                      >
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Phone cards */}
      <ul className="flex flex-col divide-y divide-slate-100 md:hidden" aria-label={caption}>
        {items.map((item) => {
          const body = (
            <>
              <div className="min-w-0 flex-1">
                {primary && <div className="font-bold text-slate-900">{primary.cell(item)}</div>}
                {secondary.length > 0 && (
                  <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.8125rem]">
                    {secondary.map((column) => (
                      <div key={column.key} className="contents">
                        <dt className="text-slate-500">{column.header}</dt>
                        <dd className="min-w-0 text-slate-700">{column.cell(item)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
              {rowHref && <ChevronRight className="flip-rtl size-5 shrink-0 text-slate-400" aria-hidden="true" />}
            </>
          );
          return (
            <li key={getKey(item)}>
              {rowHref ? (
                <Link
                  to={rowHref(item)}
                  className="flex items-center gap-3 px-4 py-3.5 active:bg-slate-50"
                >
                  {body}
                </Link>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3.5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
