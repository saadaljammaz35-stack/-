import { Route, Routes } from "react-router";
import { AppointmentDetail } from "@/components/appointments/AppointmentDetail";
import { AppointmentList } from "@/components/appointments/AppointmentList";
import { SectionNotFound } from "@/components/dashboard/SectionNotFound";

/** /app/appointments (requests by status) and /app/appointments/:id (one request). */
export default function AppointmentsPage() {
  return (
    <Routes>
      <Route index element={<AppointmentList />} />
      <Route path=":id" element={<AppointmentDetail />} />
      <Route path="*" element={<SectionNotFound backTo="/app/appointments" />} />
    </Routes>
  );
}
