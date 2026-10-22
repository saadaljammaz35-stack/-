import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { AppointmentDetailRow } from "./model";
import { ScheduleDialog } from "./ScheduleDialog";

// Records what useUpdateAppointment sends: one update, then its filters.
const db = vi.hoisted(() => ({
  table: "",
  updates: [] as unknown[],
  filters: [] as Array<[string, unknown]>,
}));

vi.mock("@/lib/supabase", () => {
  const builder = {
    update(patch: unknown) {
      db.updates.push(patch);
      return builder;
    },
    eq(column: string, value: unknown) {
      db.filters.push([column, value]);
      return builder;
    },
    select() {
      return Promise.resolve({ data: [{ id: "a1" }], error: null });
    },
  };
  return {
    supabase: {
      from: (table: string) => {
        db.table = table;
        return builder;
      },
    },
    isSupabaseConfigured: true,
    initialHref: "",
  };
});

const request: AppointmentDetailRow = {
  id: "a1",
  organization_id: "o1",
  conversation_id: null,
  service_id: null,
  customer_name: "Sara",
  customer_phone: "+966551234567",
  preferred_date: null,
  preferred_time_window: "any",
  customer_notes: null,
  source: "dashboard",
  status: "contacted",
  assigned_to: null,
  scheduled_for: null,
  confirmed_at: null,
  confirmed_by: null,
  cancelled_at: null,
  completed_at: null,
  customer_notified_at: null,
  created_by: "u1",
  created_at: "2026-10-13T08:00:00.000Z",
  updated_at: "2026-10-13T08:00:00.000Z",
  service: null,
  conversation: null,
};

function renderDialog(onSaved = vi.fn()) {
  renderWithProviders(
    <ScheduleDialog
      orgId="o1"
      request={request}
      mode="confirm"
      open
      onClose={() => {}}
      onSaved={onSaved}
    />,
    { lang: "en" },
  );
  const dialog = screen.getByRole("dialog");
  return {
    dialog,
    setDate: (value: string) =>
      fireEvent.change(within(dialog).getByLabelText(/^Date/), { target: { value } }),
    setTime: (value: string) =>
      fireEvent.change(within(dialog).getByLabelText(/^Time/), { target: { value } }),
    submit: () => userEvent.click(screen.getByRole("button", { name: "Confirm appointment" })),
  };
}

describe("ScheduleDialog (confirm)", () => {
  beforeEach(() => {
    db.table = "";
    db.updates = [];
    db.filters = [];
  });

  it("will not confirm without the agreed date and time", async () => {
    const { submit } = renderDialog();
    await submit();
    expect(await screen.findByText("Choose the appointment date.")).toBeInTheDocument();
    expect(db.updates).toEqual([]);
  });

  it("moves focus from the footer button to the first field to fix", async () => {
    const { dialog, setDate, submit } = renderDialog();
    await submit();
    await waitFor(() => expect(within(dialog).getByLabelText(/^Date/)).toHaveFocus());

    setDate("2099-10-20");
    await submit();
    const time = within(dialog).getByLabelText(/^Time/);
    await waitFor(() => expect(time).toHaveFocus());
    expect(time).toHaveAttribute("aria-invalid", "true");
  });

  it("stores the Riyadh time as UTC together with the confirmed status, in one guarded update", async () => {
    const onSaved = vi.fn();
    const { setDate, setTime, submit } = renderDialog(onSaved);
    setDate("2099-10-20");
    setTime("16:30");
    await submit();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(db.table).toBe("appointment_requests");
    expect(db.updates).toEqual([
      { status: "confirmed", scheduled_for: "2099-10-20T13:30:00.000Z" },
    ]);
    expect(db.filters).toEqual([
      ["id", "a1"],
      ["organization_id", "o1"],
      ["status", "contacted"],
    ]);
  });

  it("warns about a time that has passed but still allows it (a walk-in)", async () => {
    const onSaved = vi.fn();
    const { setDate, setTime, submit } = renderDialog(onSaved);
    setDate("2026-01-05");
    setTime("09:00");
    expect(await screen.findByText(/This time has already passed/)).toBeInTheDocument();
    await submit();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(db.updates).toEqual([
      { status: "confirmed", scheduled_for: "2026-01-05T06:00:00.000Z" },
    ]);
  });
});

describe("ScheduleDialog (edit time)", () => {
  beforeEach(() => {
    db.table = "";
    db.updates = [];
    db.filters = [];
  });

  // PostgREST returns timestamps as "…+00:00", not "…Z".
  const confirmed: AppointmentDetailRow = {
    ...request,
    status: "confirmed",
    scheduled_for: "2099-10-20T13:30:00+00:00",
  };

  function renderEdit(onSaved = vi.fn()) {
    renderWithProviders(
      <ScheduleDialog
        orgId="o1"
        request={confirmed}
        mode="edit"
        open
        onClose={() => {}}
        onSaved={onSaved}
      />,
      { lang: "en" },
    );
    const dialog = screen.getByRole("dialog");
    return {
      dialog,
      setTime: (value: string) =>
        fireEvent.change(within(dialog).getByLabelText(/^Time/), { target: { value } }),
      submit: () => userEvent.click(screen.getByRole("button", { name: "Save new time" })),
    };
  }

  it("starts from the current agreed time in Riyadh and refuses to save it unchanged", async () => {
    const { dialog, submit } = renderEdit();
    expect(within(dialog).getByLabelText(/^Date/)).toHaveValue("2099-10-20");
    expect(within(dialog).getByLabelText(/^Time/)).toHaveValue("16:30");
    await submit();
    expect(await screen.findByText("That is the current time already.")).toBeInTheDocument();
    expect(db.updates).toEqual([]);
  });

  it("saves a new time only while the request is still confirmed", async () => {
    const onSaved = vi.fn();
    const { setTime, submit } = renderEdit(onSaved);
    setTime("18:00");
    await submit();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(db.updates).toEqual([{ scheduled_for: "2099-10-20T15:00:00.000Z" }]);
    expect(db.filters).toEqual([
      ["id", "a1"],
      ["organization_id", "o1"],
      ["status", "confirmed"],
    ]);
  });
});
