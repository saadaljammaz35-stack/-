let override: (() => Date) | null = null;

export function now(): Date {
  return override ? override() : new Date();
}

export function nowIso(): string {
  return now().toISOString();
}

/** Tests only. */
export function setClock(fn: (() => Date) | null): void {
  override = fn;
}
