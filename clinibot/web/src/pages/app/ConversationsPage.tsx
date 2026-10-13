import { Route, Routes } from "react-router";
import { ConversationsWorkspace } from "@/components/conversations/ConversationsWorkspace";
import { SectionNotFound } from "@/components/dashboard/SectionNotFound";

/** /app/conversations (inbox) and /app/conversations/:id (inbox + open thread). */
export default function ConversationsPage() {
  return (
    <Routes>
      <Route index element={<ConversationsWorkspace />} />
      <Route path=":id" element={<ConversationsWorkspace />} />
      <Route path="*" element={<SectionNotFound backTo="/app/conversations" />} />
    </Routes>
  );
}
