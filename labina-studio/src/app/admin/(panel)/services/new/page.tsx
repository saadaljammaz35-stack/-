import type { Metadata } from "next";
import { getStaffContext } from "@/lib/auth";
import { AdminPage, NoAccess } from "@/components/admin/ui";
import { ServiceForm } from "@/components/admin/ServiceForm";

export const metadata: Metadata = { title: "خدمة جديدة" };

export default async function NewServicePage() {
  if ((await getStaffContext())?.role !== "admin") return <NoAccess />;
  return (
    <AdminPage title="خدمة جديدة">
      <ServiceForm />
    </AdminPage>
  );
}
