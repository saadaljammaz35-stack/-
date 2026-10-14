import { useParams } from "react-router";
import { PatientChat } from "@/components/chat/PatientChat";

/**
 * Patient web chat at /c/:slug (public, no sign-in). Talks to the
 * `public-chat` Edge Function; see src/components/chat/.
 */
export default function PatientChatPage() {
  const { slug = "" } = useParams();
  const normalized = slug.trim().toLowerCase();
  // A different clinic is a different chat: remount with fresh state.
  return <PatientChat key={normalized} slug={normalized} />;
}
