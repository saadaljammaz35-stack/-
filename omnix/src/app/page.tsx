import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/session";

export default async function Home() {
  redirect((await getSession()) ? "/ai" : "/login");
}
