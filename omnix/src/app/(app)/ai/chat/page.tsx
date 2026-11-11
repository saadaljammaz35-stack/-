import { ChatPage } from "@/lib/server/chat-page";

export const metadata = { title: "Chat" };

export default function Page() {
  return <ChatPage conversationId={null} />;
}
