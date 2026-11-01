import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/auth";
import { AdminPage, NoAccess } from "@/components/admin/ui";
import { ServiceForm } from "@/components/admin/ServiceForm";
import type { Service } from "@/lib/types";

export const metadata: Metadata = { title: "تعديل الخدمة" };

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  if ((await getStaffContext())?.role !== "admin") return <NoAccess />;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = (await getServerClient())!;
  const { data } = await supabase.from("services").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const service = { ...data, price: data.price === null ? null : Number(data.price) } as Service;
  return (
    <AdminPage title={`تعديل: ${service.name}`}>
      <ServiceForm service={service} />
    </AdminPage>
  );
}
