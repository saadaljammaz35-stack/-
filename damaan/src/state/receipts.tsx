import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { deleteAllReceipts, deleteReceipt, insertReceipt, listReceipts, updateReceipt } from '../db/receipts';
import type { Receipt, ReceiptDraft } from '../domain/receipt';
import { deleteAllImages, deleteImage } from '../services/files';
import { cancelEverything, cancelReceipt, rescheduleReceipt } from '../services/notifications';
import { useSettings } from '../services/settings';

type ReceiptsContextValue = {
  receipts: Receipt[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  create: (draft: ReceiptDraft) => Promise<Receipt>;
  save: (id: string, draft: ReceiptDraft) => Promise<Receipt>;
  remove: (id: string) => Promise<void>;
  eraseEverything: () => Promise<void>;
  /** Re-runs scheduling for every receipt — used when the alerts switch flips. */
  resyncReminders: () => Promise<void>;
};

const ReceiptsContext = createContext<ReceiptsContextValue | null>(null);

export function ReceiptsProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setReceipts(await listReceipts());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذّر قراءة الفواتير');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const rows = await listReceipts();
        if (!cancelled) {
          setReceipts(rows);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'تعذّر قراءة الفواتير');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const create = useCallback(
    async (draft: ReceiptDraft) => {
      const receipt = await insertReceipt(draft);
      await rescheduleReceipt(receipt, settings.notificationsEnabled);
      await reload();
      return receipt;
    },
    [reload, settings.notificationsEnabled],
  );

  const save = useCallback(
    async (id: string, draft: ReceiptDraft) => {
      // Images dropped during editing are deleted from disk, not just unlinked.
      const previous = receipts.find((entry) => entry.id === id);
      const receipt = await updateReceipt(id, draft);
      for (const name of previous?.images ?? []) {
        if (!draft.images.includes(name)) deleteImage(name);
      }
      await rescheduleReceipt(receipt, settings.notificationsEnabled);
      await reload();
      return receipt;
    },
    [receipts, reload, settings.notificationsEnabled],
  );

  const remove = useCallback(
    async (id: string) => {
      const receipt = receipts.find((entry) => entry.id === id);
      await cancelReceipt(id);
      await deleteReceipt(id);
      for (const name of receipt?.images ?? []) deleteImage(name);
      await reload();
    },
    [receipts, reload],
  );

  const eraseEverything = useCallback(async () => {
    await cancelEverything();
    await deleteAllReceipts();
    deleteAllImages();
    await reload();
  }, [reload]);

  const resyncReminders = useCallback(async () => {
    await cancelEverything();
    if (!settings.notificationsEnabled) {
      for (const receipt of receipts) await cancelReceipt(receipt.id);
      return;
    }
    for (const receipt of receipts) await rescheduleReceipt(receipt, true);
  }, [receipts, settings.notificationsEnabled]);

  const value = useMemo<ReceiptsContextValue>(
    () => ({ receipts, loading, error, reload, create, save, remove, eraseEverything, resyncReminders }),
    [receipts, loading, error, reload, create, save, remove, eraseEverything, resyncReminders],
  );

  return <ReceiptsContext.Provider value={value}>{children}</ReceiptsContext.Provider>;
}

export function useReceipts(): ReceiptsContextValue {
  const value = useContext(ReceiptsContext);
  if (!value) throw new Error('useReceipts must be used inside <ReceiptsProvider>');
  return value;
}
