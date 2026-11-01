import type { Metadata } from "next";
import { getServerClient } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/auth";
import { AdminPage, NoAccess } from "@/components/admin/ui";
import { GalleryManager } from "@/components/admin/GalleryManager";
import type { GalleryItem } from "@/lib/types";

export const metadata: Metadata = { title: "معرض الصور" };

export default async function AdminGalleryPage() {
  if ((await getStaffContext())?.role !== "admin") return <NoAccess />;
  const supabase = (await getServerClient())!;
  const { data } = await supabase.from("gallery_items").select("*").order("sort_order").order("created_at", { ascending: false });
  return (
    <AdminPage title="معرض الصور" description="ارفع صور أعمالك وصنّفها. الصور المميزة تظهر أولاً في الصفحة الرئيسية.">
      <GalleryManager items={(data ?? []) as GalleryItem[]} />
    </AdminPage>
  );
}
