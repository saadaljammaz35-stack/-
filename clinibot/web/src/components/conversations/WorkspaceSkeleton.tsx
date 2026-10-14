import { Card, Skeleton } from "@/components/ui";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { WORKSPACE_GRID } from "./layout";

/** Shown while the inbox code loads: the same grid, so the page does not jump. */
export function WorkspaceSkeleton({ threadOpen }: { threadOpen: boolean }) {
  const { t } = useI18n();
  return (
    <div className={WORKSPACE_GRID} aria-busy="true">
      <p className="sr-only" role="status">
        {t("common.loading")}
      </p>
      <Card className={cn("flex flex-col gap-4 p-4", threadOpen && "max-lg:hidden")}>
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        ))}
      </Card>
      <Card className={cn("flex flex-col gap-4 p-5", !threadOpen && "max-lg:hidden")}>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64 max-w-full" />
        <Skeleton className="h-40 w-full" />
      </Card>
    </div>
  );
}
