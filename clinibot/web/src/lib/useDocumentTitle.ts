import { useEffect } from "react";

/** Sets the browser tab title: "<title> · CliniBot". */
export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    document.title = title ? `${title} · CliniBot` : "CliniBot";
  }, [title]);
}
