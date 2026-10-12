import { createContext, use, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";

interface TabsContextValue {
  baseId: string;
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs(): TabsContextValue {
  const context = use(TabsContext);
  if (!context) throw new Error("<TabList>/<TabPanel> must be inside <Tabs>");
  return context;
}

export interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}

/**
 *   <Tabs value={tab} onValueChange={setTab}>
 *     <TabList label="…" items={[{ value: "all", label: "All" }, …]} />
 *     <TabPanel value="all">…</TabPanel>
 *   </Tabs>
 * Arrow keys move between tabs (mirrored in RTL), Home/End jump.
 */
export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  const baseId = useId();
  return (
    <TabsContext value={{ baseId, value, onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext>
  );
}

export interface TabItem {
  value: string;
  label: ReactNode;
  /** Small count or badge after the label. */
  badge?: ReactNode;
  disabled?: boolean;
}

const tabId = (base: string, value: string) => `${base}-tab-${value}`;
const panelId = (base: string, value: string) => `${base}-panel-${value}`;

export function TabList({ items, label, className }: { items: TabItem[]; label: string; className?: string }) {
  const { baseId, value, onValueChange } = useTabs();
  const { dir } = useI18n();
  const listRef = useRef<HTMLDivElement>(null);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const enabled = items.filter((item) => !item.disabled);
    const index = enabled.findIndex((item) => item.value === value);
    if (index < 0) return;
    const forward = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
    const backward = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
    let next: TabItem | undefined;
    if (event.key === forward) next = enabled[(index + 1) % enabled.length];
    else if (event.key === backward) next = enabled[(index - 1 + enabled.length) % enabled.length];
    else if (event.key === "Home") next = enabled[0];
    else if (event.key === "End") next = enabled[enabled.length - 1];
    if (!next) return;
    event.preventDefault();
    onValueChange(next.value);
    listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(tabId(baseId, next.value))}`)?.focus();
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "-mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-1 [scrollbar-width:none]",
        className,
      )}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            id={tabId(baseId, item.value)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId(baseId, item.value)}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onValueChange(item.value)}
            className={cn(
              "-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-bold whitespace-nowrap transition-colors disabled:opacity-50",
              selected
                ? "border-primary text-primary"
                : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900",
            )}
          >
            {item.label}
            {item.badge !== undefined && (
              <span
                className={cn(
                  "rounded-full px-2 py-px text-xs",
                  selected ? "bg-primary-soft text-primary" : "bg-slate-100 text-slate-600",
                )}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const { baseId, value: active } = useTabs();
  if (value !== active) return null;
  return (
    <div
      id={panelId(baseId, value)}
      role="tabpanel"
      aria-labelledby={tabId(baseId, value)}
      tabIndex={0}
      className={cn("pt-5 focus-visible:outline-offset-4", className)}
    >
      {children}
    </div>
  );
}
