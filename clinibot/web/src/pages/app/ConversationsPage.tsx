import { lazy, Suspense } from "react";
import { Route, Routes, useParams } from "react-router";
import { PageHeader } from "@/components/ui";
import { SectionNotFound } from "@/components/dashboard/SectionNotFound";
import { WorkspaceSkeleton } from "@/components/conversations/WorkspaceSkeleton";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

// The inbox (list, thread, reply composer, actions) is the largest dashboard
// section, so it is its own chunk: the page title and a skeleton paint at once
// while it loads.
const ConversationsWorkspace = lazy(() =>
  import("@/components/conversations/ConversationsWorkspace").then((module) => ({
    default: module.ConversationsWorkspace,
  })),
);

function Inbox() {
  const { t } = useI18n();
  const { id } = useParams();
  useDocumentTitle(t("conversations.title"));
  return (
    <>
      <PageHeader
        title={t("conversations.title")}
        description={t("conversations.description")}
        // Phones show the open conversation full width, with its own back link and heading.
        className={cn(id && "max-lg:sr-only")}
      />
      <Suspense fallback={<WorkspaceSkeleton threadOpen={Boolean(id)} />}>
        <ConversationsWorkspace />
      </Suspense>
    </>
  );
}

/** /app/conversations (inbox) and /app/conversations/:id (inbox + open thread). */
export default function ConversationsPage() {
  return (
    <Routes>
      <Route index element={<Inbox />} />
      <Route path=":id" element={<Inbox />} />
      <Route path="*" element={<SectionNotFound backTo="/app/conversations" />} />
    </Routes>
  );
}
