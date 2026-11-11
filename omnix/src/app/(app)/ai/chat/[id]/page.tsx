import { ChatPage } from "@/lib/server/chat-page";

export const metadata = { title: "Chat" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ChatPage conversationId={(await params).id} />;
}
