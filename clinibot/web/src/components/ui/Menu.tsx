import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface MenuItem {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
  /** Marks the current choice (e.g. the selected clinic). */
  checked?: boolean;
  danger?: boolean;
  disabled?: boolean;
}

export interface MenuProps {
  /** Renders the trigger; spread `props` onto a <button>. */
  trigger: (props: {
    id: string;
    "aria-haspopup": "menu";
    "aria-expanded": boolean;
    "aria-controls": string;
    onClick: () => void;
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  }) => ReactNode;
  items: MenuItem[];
  /** Non-interactive content at the top (e.g. "Signed in as …"). */
  header?: ReactNode;
  /** Content below the items (e.g. a link). */
  footer?: ReactNode;
  /** Which edge of the trigger the menu lines up with. */
  align?: "start" | "end";
  /** Open upwards (for triggers at the bottom of the screen). */
  placement?: "bottom" | "top";
  className?: string;
}

/**
 * Accessible dropdown menu (button + role="menu"): arrow keys move, Enter /
 * Space select, Escape and outside clicks close, focus returns to the trigger.
 */
export function Menu({
  trigger,
  items,
  header,
  footer,
  align = "end",
  placement = "bottom",
  className,
}: MenuProps) {
  // false = closed; otherwise which item gets focus when it opens.
  const [open, setOpen] = useState<false | "first" | "last">(false);
  const baseId = useId();
  const triggerId = `${baseId}-trigger`;
  const menuId = `${baseId}-menu`;
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const menuItems = () =>
    Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])') ?? [],
    );

  useEffect(() => {
    if (!open) return;
    const list = menuItems();
    (open === "last" ? list[list.length - 1] : list[0])?.focus();

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) document.getElementById(triggerId)?.focus();
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(event.key === "ArrowUp" ? "last" : "first");
    }
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const list = menuItems();
    const index = list.indexOf(document.activeElement as HTMLElement);
    let next: HTMLElement | undefined;
    if (event.key === "ArrowDown") next = list[(index + 1) % list.length];
    else if (event.key === "ArrowUp") next = list[(index - 1 + list.length) % list.length];
    else if (event.key === "Home") next = list[0];
    else if (event.key === "End") next = list[list.length - 1];
    else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    } else if (event.key === "Tab") {
      close(false);
      return;
    }
    if (next) {
      event.preventDefault();
      next.focus();
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {trigger({
        id: triggerId,
        "aria-haspopup": "menu",
        "aria-expanded": open !== false,
        "aria-controls": menuId,
        onClick: () => setOpen((value) => (value ? false : "first")),
        onKeyDown: onTriggerKeyDown,
      })}
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          onKeyDown={onMenuKeyDown}
          className={cn(
            "absolute z-40 w-max max-w-[min(20rem,calc(100vw-2rem))] min-w-56 animate-fade-in rounded-2xl border border-slate-200 bg-white p-1.5 shadow-overlay",
            align === "end" ? "end-0" : "start-0",
            placement === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
          )}
        >
          {header && <div className="border-b border-slate-100 px-3 pt-2 pb-2.5">{header}</div>}
          <div className={cn(Boolean(header) && "pt-1.5")}>
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                role={item.checked === undefined ? "menuitem" : "menuitemradio"}
                aria-checked={item.checked}
                tabIndex={-1}
                disabled={item.disabled}
                onClick={() => {
                  close();
                  item.onSelect();
                }}
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-start text-sm font-medium outline-none disabled:opacity-50",
                  item.danger
                    ? "text-red-700 hover:bg-red-50 focus-visible:bg-red-50"
                    : "text-slate-800 hover:bg-slate-100 focus-visible:bg-slate-100",
                  item.checked && "font-bold text-primary",
                )}
              >
                {item.icon && (
                  <span className="flex size-5 shrink-0 items-center justify-center">
                    {item.icon}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.checked && (
                  <span className="size-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
          {footer && <div className="mt-1.5 border-t border-slate-100 pt-1.5">{footer}</div>}
        </div>
      )}
    </div>
  );
}
