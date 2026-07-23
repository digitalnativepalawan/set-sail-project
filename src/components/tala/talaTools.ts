import type { BookingSource, CmsData, Payment, PaymentMethod } from "@/types/cms";
import { supabase, isSupabaseConnected } from "@/lib/supabase";
import { uid, generateReference, todayISO } from "@/admin/ops/opsUtils";

// ---------------------------------------------------------------------------
// TALA's tools — this is what makes her an actual agent rather than a chat
// completion wrapped in a system prompt. She decides when to call these; we
// execute them against real data and hand the result back to her so her
// reply is grounded in something that just happened, not just what's baked
// into the prompt text.
//
// READ tools (guest + owner): run entirely in the browser against loaded cms.
// WRITE tools (owner only): mutate cms_data via useCms().update so the change
// is persisted the same way the admin managers save. They are hard-gated to
// owner mode — the guest orb never passes owner:true, so it can't write.
// ---------------------------------------------------------------------------

export interface TalaToolContext {
  cms: CmsData;
  /** Persist a cms mutation the same way the admin managers do. Owner only. */
  update?: (updater: (draft: CmsData) => CmsData) => void;
  owner?: boolean;
}

/** OpenAI/OpenRouter-compatible function-calling schema. */
export const TALA_TOOL_SCHEMAS = [
  {
    type: "function",
    function: {
      name: "check_room_availability",
      description:
        "Check which named rooms/stays are free for a given date range, using live booking records. Use this whenever a guest asks about availability, booking a specific room, or dates — never guess from memory.",
      parameters: {
        type: "object",
        properties: {
          checkIn: { type: "string", description: "Check-in date, ISO format YYYY-MM-DD." },
          checkOut: { type: "string", description: "Check-out date, ISO format YYYY-MM-DD." },
          roomName: {
            type: "string",
            description:
              "Optional: a specific room or package name to check. Omit to check all rooms.",
          },
        },
        required: ["checkIn", "checkOut"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_interested_guest",
      description:
        "Save a guest's interest so the human team can follow up, when they've shared enough to be worth a callback (at least a name or a way to reach them) but the conversation is ending before they reach WhatsApp themselves. Never call this without at least a contact method or name.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Guest's name, if given." },
          contact: {
            type: "string",
            description: "Email, phone, or WhatsApp number the guest shared.",
          },
          note: {
            type: "string",
            description: "One or two sentences: what they're interested in and any useful context.",
          },
        },
        required: ["note"],
      },
    },
  },
  // ---- OWNER WRITE TOOLS (operator face only) -----------------------------
  {
    type: "function",
    function: {
      name: "create_booking",
      description:
        "OWNER ONLY. Create a new room/ stay booking in the operations system. Returns the new booking reference. Requires owner mode.",
      parameters: {
        type: "object",
        properties: {
          guestName: { type: "string", description: "Guest's name." },
          roomType: { type: "string", description: "Room or package name, e.g. 'Weekly Sprint'." },
          checkIn: { type: "string", description: "Check-in date, ISO YYYY-MM-DD." },
          checkOut: { type: "string", description: "Check-out date, ISO YYYY-MM-DD." },
          guests: { type: "number", description: "Number of guests." },
          amount: { type: "number", description: "Total amount in PHP." },
          source: {
            type: "string",
            description: "Booking source: whatsapp, direct, airbnb, agoda, booking.com, walk_in, referral, other.",
          },
          notes: { type: "string", description: "Optional notes." },
        },
        required: ["guestName", "roomType", "checkIn", "checkOut"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_booking",
      description:
        "OWNER ONLY. Update an existing booking — confirm, cancel, check-in/out, or change status/ amount. Requires owner mode. Match by reference (e.g. MT-2026-1234) or guest name.",
      parameters: {
        type: "object",
        properties: {
          reference: { type: "string", description: "Booking reference, e.g. MT-2026-1234." },
          guestName: { type: "string", description: "Guest name to match if reference unknown." },
          status: {
            type: "string",
            description: "New status: pending, confirmed, checked_in, checked_out, cancelled.",
          },
          amount: { type: "number", description: "New total amount in PHP, if changing." },
          paidAmount: { type: "number", description: "Amount paid so far in PHP, if changing." },
          notes: { type: "string", description: "Optional notes to append/replace." },
        },
        required: ["status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_tour_booking",
      description:
        "OWNER ONLY. Book a guest onto a tour departure. Requires owner mode.",
      parameters: {
        type: "object",
        properties: {
          tourName: { type: "string", description: "Tour name as listed, e.g. 'Island Hopping'." },
          guestName: { type: "string", description: "Guest's name." },
          guestPhone: { type: "string", description: "Guest's phone/WhatsApp." },
          date: { type: "string", description: "Tour date, ISO YYYY-MM-DD." },
          guests: { type: "number", description: "Number of guests." },
          amount: { type: "number", description: "Total amount in PHP." },
          notes: { type: "string", description: "Optional notes." },
        },
        required: ["tourName", "guestName", "date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_rental",
      description:
        "OWNER ONLY. Mark a motorbike as rented or returned/maintenance. Requires owner mode.",
      parameters: {
        type: "object",
        properties: {
          bikeName: { type: "string", description: "Motorbike name, e.g. 'Honda Click 125 #1'." },
          status: {
            type: "string",
            description: "New status: available, rented, maintenance.",
          },
        },
        required: ["bikeName", "status"],
      },
    },
  },
  // ---- GUEST BOOKING DRAFT (anyone, including guests) -------------------
  // When a guest wants to book, TALA first calls this to build a DRAFT booking
  // (status still 'pending'). The widget renders the draft as a verification
  // card the guest must confirm. The guest can NEVER write to the store
  // directly — confirming the card is the human action that persists it. This
  // prevents TALA from booking on its own; you (owner) still confirm in admin
  // before it becomes real. Pending already blocks availability, so no
  // double-booking while a draft waits for confirmation.
  {
    type: "function",
    function: {
      name: "request_booking",
      description:
        "GUEST-SAFE DRAFT. When a guest wants to book a room/stay (or a day/workspace pass treated as a short stay), build a booking DRAFT in status 'pending'. It is shown to the guest for confirmation — never confirmed, cancelled or paid by you. Match room names to those on the site. Requires guestName and dates.",
      parameters: {
        type: "object",
        properties: {
          guestName: { type: "string", description: "Guest's name." },
          roomType: {
            type: "string",
            description: "Room or package name as listed, e.g. 'Superior Room UNO', 'Weekly Sprint', 'Day Pass'.",
          },
          checkIn: { type: "string", description: "Check-in date, ISO YYYY-MM-DD." },
          checkOut: { type: "string", description: "Check-out date, ISO YYYY-MM-DD." },
          guests: { type: "number", description: "Number of guests." },
          amount: { type: "number", description: "Total amount in PHP if known." },
          notes: { type: "string", description: "Optional notes from the guest." },
        },
        required: ["guestName", "roomType", "checkIn", "checkOut"],
      },
    },
  },
  // ---- OPERATOR-ONLY: PAYROLL + PAYMENTS ---------------------------------
  // These write to the store, so they require ctx.owner (operator face only).
  {
    type: "function",
    function: {
      name: "run_payroll",
      description:
        "OPERATOR ONLY. Compute payroll for a date range from logged shifts x each staff member's pay rate, and create (pending, unpaid) PayRecord rows for every active staff member with hours/days in that range. Say the totals after.",
      parameters: {
        type: "object",
        properties: {
          periodStart: { type: "string", description: "Period start date, ISO YYYY-MM-DD." },
          periodEnd: { type: "string", description: "Period end date, ISO YYYY-MM-DD." },
        },
        required: ["periodStart", "periodEnd"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_pay_record_paid",
      description:
        "OPERATOR ONLY. Mark a staff PayRecord as paid (cash or gcash). Provide the payRecordId from run_payroll output.",
      parameters: {
        type: "object",
        properties: {
          payRecordId: { type: "string", description: "The id of the PayRecord to mark paid." },
          method: { type: "string", description: "Payment method: 'cash' or 'gcash'." },
        },
        required: ["payRecordId", "method"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_payment",
      description:
        "OPERATOR ONLY. Record a money movement: revenue (booking/tour/rental/other) or expense. Creates a Payment row.",
      parameters: {
        type: "object",
        properties: {
          direction: { type: "string", description: "'in' for revenue, 'out' for expense." },
          category: { type: "string", description: "'booking' | 'tour' | 'rental' | 'other' | 'expense'." },
          amount: { type: "number", description: "Amount in PHP." },
          method: { type: "string", description: "Payment method: 'cash' | 'card' | 'gcash' | 'bank' | 'other'." },
          description: { type: "string", description: "Short human description." },
          relatedId: { type: "string", description: "Optional related booking/tour/rental id." },
        },
        required: ["direction", "category", "amount", "method", "description"],
      },
    },
  },
] as const;

export interface TalaToolCall {
  id: string;
  name: string;
  arguments: string; // raw JSON string, as returned by the model
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v.trim() : fallback;
}
function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

function bookingSource(value: unknown): BookingSource {
  const source = str(value, "whatsapp");
  const allowed: BookingSource[] = [
    "whatsapp",
    "direct",
    "airbnb",
    "agoda",
    "booking.com",
    "walk_in",
    "referral",
    "other",
  ];
  return allowed.includes(source as BookingSource) ? (source as BookingSource) : "other";
}

function paymentMethod(value: unknown, fallback: PaymentMethod = "cash"): PaymentMethod {
  const method = str(value, fallback);
  if (method === "bank") return "bank_transfer";
  const allowed: PaymentMethod[] = ["cash", "gcash", "bank_transfer", "card", "paypal", "other"];
  return allowed.includes(method as PaymentMethod) ? (method as PaymentMethod) : fallback;
}

function checkRoomAvailability(args: Record<string, unknown>, cms: CmsData) {
  const checkIn = parseDate(args.checkIn);
  const checkOut = parseDate(args.checkOut);
  if (!checkIn || !checkOut || checkOut <= checkIn) {
    return { error: "checkIn and checkOut must be valid dates, with checkOut after checkIn." };
  }

  const roomNameFilter =
    typeof args.roomName === "string" && args.roomName.trim()
      ? args.roomName.trim().toLowerCase()
      : null;

  const rooms = cms.homepage.rooms.filter((r) => r.visible);
  const relevantRooms = roomNameFilter
    ? rooms.filter((r) => r.name.toLowerCase().includes(roomNameFilter))
    : rooms;

  if (relevantRooms.length === 0) {
    return { error: `No room matching "${args.roomName}" was found.` };
  }

  // Only bookings that actually hold a room block availability. Cancelled or
  // already-departed guests don't. No guest names, contact info, or amounts
  // are included in the result — TALA never needs or sees that to answer.
  const blockingStatuses = new Set(["pending", "confirmed", "checked_in"]);
  const bookings = cms.operations.bookings.filter((b) => blockingStatuses.has(b.status));

  const overlaps = (bookingStart: string, bookingEnd: string) => {
    const start = parseDate(bookingStart);
    const end = parseDate(bookingEnd);
    if (!start || !end) return false;
    return start < checkOut && end > checkIn;
  };

  return {
    checkIn: args.checkIn,
    checkOut: args.checkOut,
    rooms: relevantRooms.map((room) => {
      const conflicting = bookings.filter(
        (b) =>
          b.roomType.toLowerCase().includes(room.name.toLowerCase()) &&
          overlaps(b.checkIn, b.checkOut),
      );
      return {
        name: room.name,
        capacity: room.capacity,
        price: room.price,
        available: conflicting.length === 0,
      };
    }),
  };
}

async function logInterestedGuest(args: Record<string, unknown>) {
  const name = str(args.name).slice(0, 200);
  const contact = str(args.contact).slice(0, 200);
  const note = str(args.note).slice(0, 1000);

  if (!note && !name && !contact) {
    return { error: "Nothing to save — need at least a name, contact, or note." };
  }
  if (!isSupabaseConnected() || !supabase) {
    return { error: "Lead capture isn't available right now." };
  }

  try {
    const { error } = await supabase
      .from("tala_leads")
      .insert({ name, contact, note, source: "tala_chat" });
    if (error) return { error: "Couldn't save that right now." };
    return { success: true };
  } catch {
    return { error: "Couldn't save that right now." };
  }
}

// ---- OWNER WRITE TOOLS ----------------------------------------------------

function findBooking(
  cms: CmsData,
  ref?: string,
  guestName?: string,
): CmsData["operations"]["bookings"][number] | undefined {
  const refL = str(ref).toLowerCase();
  const nameL = str(guestName).toLowerCase();
  return cms.operations.bookings.find(
    (b) =>
      (refL && b.reference.toLowerCase() === refL) ||
      (nameL && b.guestName.toLowerCase().includes(nameL)),
  );
}

function createBooking(args: Record<string, unknown>, ctx: TalaToolContext) {
  if (!ctx.owner || !ctx.update) {
    return { error: "create_booking is owner-only and requires live owner mode." };
  }
  const checkIn = str(args.checkIn);
  const checkOut = str(args.checkOut);
  if (!checkIn || !checkOut) {
    return { error: "checkIn and checkOut are required." };
  }
  const booking: CmsData["operations"]["bookings"][number] = {
    id: uid("bkg"),
    reference: generateReference("MT"),
    guestId: "",
    guestName: str(args.guestName),
    roomType: str(args.roomType, "Weekly Sprint"),
    checkIn,
    checkOut,
    guests: num(args.guests, 1),
    amount: num(args.amount, 0),
    paidAmount: 0,
    status: "confirmed",
    source: bookingSource(args.source),
    notes: str(args.notes),
    createdAt: new Date().toISOString(),
  };
  ctx.update((d) => ({
    ...d,
    operations: { ...d.operations, bookings: [...d.operations.bookings, booking] },
  }));
  return {
    success: true,
    reference: booking.reference,
    guestName: booking.guestName,
    roomType: booking.roomType,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
  };
}

function updateBooking(args: Record<string, unknown>, ctx: TalaToolContext) {
  if (!ctx.owner || !ctx.update) {
    return { error: "update_booking is owner-only and requires live owner mode." };
  }
  const found = findBooking(ctx.cms, str(args.reference), str(args.guestName));
  if (!found) {
    return { error: "No booking matched that reference or guest name." };
  }
  const status = str(args.status) as CmsData["operations"]["bookings"][number]["status"];
  const allowed = ["pending", "confirmed", "checked_in", "checked_out", "cancelled"];
  if (!allowed.includes(status)) {
    return { error: `Invalid status '${status}'. Use one of: ${allowed.join(", ")}.` };
  }
  ctx.update((d) => ({
    ...d,
    operations: {
      ...d.operations,
      bookings: d.operations.bookings.map((b) =>
        b.id === found.id
          ? {
              ...b,
              status,
              amount: args.amount !== undefined ? num(args.amount, b.amount) : b.amount,
              paidAmount:
                args.paidAmount !== undefined ? num(args.paidAmount, b.paidAmount) : b.paidAmount,
              notes: args.notes !== undefined ? str(args.notes) : b.notes,
            }
          : b,
      ),
    },
  }));
  return {
    success: true,
    reference: found.reference,
    guestName: found.guestName,
    newStatus: status,
  };
}

function createTourBooking(args: Record<string, unknown>, ctx: TalaToolContext) {
  if (!ctx.owner || !ctx.update) {
    return { error: "create_tour_booking is owner-only and requires live owner mode." };
  }
  const tourName = str(args.tourName);
  const date = str(args.date);
  if (!tourName || !date) {
    return { error: "tourName and date are required." };
  }
  const tour = ctx.cms.operations.tours.find((t) =>
    t.name.toLowerCase().includes(tourName.toLowerCase()),
  );
  const booking: CmsData["operations"]["tourBookings"][number] = {
    id: uid("tb"),
    reference: generateReference("TR"),
    tourId: tour?.id ?? "",
    tourName: tour?.name ?? tourName,
    guestName: str(args.guestName),
    guestPhone: str(args.guestPhone),
    date,
    guests: num(args.guests, 1),
    amount: num(args.amount, 0),
    paidAmount: 0,
    status: "confirmed",
    notes: str(args.notes),
    createdAt: new Date().toISOString(),
  };
  ctx.update((d) => ({
    ...d,
    operations: {
      ...d.operations,
      tourBookings: [...d.operations.tourBookings, booking],
    },
  }));
  return {
    success: true,
    reference: booking.reference,
    tourName: booking.tourName,
    guestName: booking.guestName,
    date: booking.date,
  };
}

function updateRental(args: Record<string, unknown>, ctx: TalaToolContext) {
  if (!ctx.owner || !ctx.update) {
    return { error: "update_rental is owner-only and requires live owner mode." };
  }
  const bikeName = str(args.bikeName);
  const status = str(args.status) as "available" | "rented" | "maintenance";
  if (!["available", "rented", "maintenance"].includes(status)) {
    return { error: "status must be available, rented, or maintenance." };
  }
  const bikes = ctx.cms.operations.motorbikes;
  const match = bikes.find((b) => b.name.toLowerCase().includes(bikeName.toLowerCase()));
  if (!match) {
    return { error: `No motorbike matching '${bikeName}'.` };
  }
  ctx.update((d) => ({
    ...d,
    operations: {
      ...d.operations,
      motorbikes: d.operations.motorbikes.map((b) =>
        b.id === match.id ? { ...b, status } : b,
      ),
    },
  }));
  return { success: true, bike: match.name, newStatus: status };
}

// Guest-safe DRAFT: TALA builds the booking but does NOT write it. The
// widget renders the returned `draft` as a verification card; the guest taps
// Confirm (a real human action) which persists the pending booking via
// ctx.update. Because pending already blocks availability, no double-booking.
// If an owner calls it (ctx.owner), it persists immediately.
function requestBooking(args: Record<string, unknown>, ctx: TalaToolContext) {
  const checkIn = str(args.checkIn);
  const checkOut = str(args.checkOut);
  const roomType = str(args.roomType);
  const guestName = str(args.guestName);
  if (!checkIn || !checkOut || !roomType || !guestName) {
    return { error: "Need guestName, roomType, checkIn and checkOut." };
  }
  const booking: CmsData["operations"]["bookings"][number] = {
    id: uid("bkg"),
    reference: generateReference("MT"),
    guestId: "",
    guestName,
    roomType,
    checkIn,
    checkOut,
    guests: num(args.guests, 1),
    amount: num(args.amount, 0),
    paidAmount: 0,
    status: "pending",
    source: "other",
    notes: str(args.notes),
    createdAt: new Date().toISOString(),
  };

  // Owner (operator face) persists right away; guests only get a draft.
  if (ctx.owner && ctx.update) {
    ctx.update((d) => ({
      ...d,
      operations: { ...d.operations, bookings: [...d.operations.bookings, booking] },
    }));
    return {
      success: true,
      status: "pending",
      reference: booking.reference,
      guestName: booking.guestName,
      roomType: booking.roomType,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      message: "Booking request saved as PENDING — the team will confirm shortly.",
    };
  }

  // Guest / draft mode — hand back the draft for the widget to confirm.
  return {
    draft: {
      id: booking.id,
      reference: booking.reference,
      guestName: booking.guestName,
      roomType: booking.roomType,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      guests: booking.guests,
      amount: booking.amount,
      notes: booking.notes,
    },
    message: "Here is your booking draft — please confirm the details.",
  };
}

// Persists a guest-confirmed draft. Called by the widget's Confirm button
// (the human action). Guests can only reach this through that button, never
// via the model.
export function confirmBookingDraft(
  draft: {
    id: string;
    reference: string;
    guestName: string;
    roomType: string;
    checkIn: string;
    checkOut: string;
    guests: number;
    amount: number;
    notes: string;
  },
  update: (fn: (d: CmsData) => CmsData) => void,
) {
  update((d) => {
    const exists = d.operations.bookings.some((b) => b.id === draft.id);
    if (exists) return d;
    return {
      ...d,
      operations: {
        ...d.operations,
        bookings: [
          ...d.operations.bookings,
          {
            ...draft,
            guestId: "",
            paidAmount: 0,
            status: "pending",
            source: "other",
            createdAt: new Date().toISOString(),
          } as CmsData["operations"]["bookings"][number],
        ],
      },
    };
  });
  return { success: true, reference: draft.reference };
}

// ---- Operator-only: payroll + payments --------------------------------
function requireOwner(ctx: TalaToolContext) {
  if (!ctx.owner || !ctx.update) {
    return "OPERATOR ONLY: open TALA from the admin Operations console to run payroll or record payments.";
  }
  return null;
}

function computeHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let h = (eh + em / 60) - (sh + sm / 60);
  if (h < 0) h += 24;
  return Math.max(0, Math.round(h * 100) / 100);
}

function runPayroll(args: Record<string, unknown>, ctx: TalaToolContext) {
  const deny = requireOwner(ctx);
  if (deny) return { error: deny };
  const update = ctx.update;
  if (!update) return { error: "Owner update channel is unavailable." };
  const periodStart = str(args.periodStart);
  const periodEnd = str(args.periodEnd);
  if (!periodStart || !periodEnd) return { error: "Need periodStart and periodEnd." };
  const { operations } = ctx.cms;
  const staff = operations.staff.filter((s) => s.active);
  const created: CmsData["operations"]["payRecords"][number][] = [];
  let total = 0;
  for (const member of staff) {
    const memberShifts = operations.shifts.filter(
      (s) => s.staffId === member.id && s.date >= periodStart && s.date <= periodEnd,
    );
    const hours = memberShifts.reduce((sum, s) => sum + (s.hoursWorked || computeHours(s.startTime, s.endTime)), 0);
    const days = new Set(memberShifts.map((s) => s.date)).size;
    const amount =
      member.payType === "hourly" ? hours * member.payRate :
      member.payType === "daily" ? days * member.payRate :
      member.payRate;
    if (amount <= 0) continue;
    total += amount;
    created.push({
      id: uid("pay"),
      staffId: member.id,
      periodStart,
      periodEnd,
      hours,
      amount,
      paid: false,
      paidAt: "",
      method: "cash",
      notes: `Generated by TALA for ${member.name}`,
    });
  }
  if (created.length === 0) return { success: true, created: 0, total: 0, message: "No billable shifts in that period." };
  update((d) => ({
    ...d,
    operations: { ...d.operations, payRecords: [...d.operations.payRecords, ...created] },
  }));
  return {
    success: true,
    created: created.length,
    total,
    message: `Created ${created.length} payroll record(s) totalling ₱${total.toLocaleString()} for ${periodStart} → ${periodEnd}.`,
  };
}

function markPayRecordPaid(args: Record<string, unknown>, ctx: TalaToolContext) {
  const deny = requireOwner(ctx);
  if (deny) return { error: deny };
  const update = ctx.update;
  if (!update) return { error: "Owner update channel is unavailable." };
  const id = str(args.payRecordId);
  const method = paymentMethod(args.method);
  if (!id) return { error: "Need payRecordId." };
  let done = false;
  let amount = 0;
  let name = "";
  update((d) => {
    const rec = d.operations.payRecords.find((p) => p.id === id);
    if (!rec) return d;
    done = true;
    amount = rec.amount;
    name = d.operations.staff.find((s) => s.id === rec.staffId)?.name || "Staff";
    return {
      ...d,
      operations: {
        ...d.operations,
        payRecords: d.operations.payRecords.map((p) =>
          p.id === id ? { ...p, paid: true, paidAt: new Date().toISOString().slice(0, 10), method } : p,
        ),
        payments: [
          ...d.operations.payments,
          {
            id: uid("pay"),
            reference: generateReference("SAL"),
            date: new Date().toISOString().slice(0, 10),
            category: "expense",
            direction: "out",
            amount,
            method,
            relatedId: id,
            description: `Salary: ${name}`,
            notes: "",
          },
        ],
      },
    };
  });
  if (!done) return { error: "PayRecord not found." };
  return { success: true, method, amount, message: `Marked paid: ₱${amount.toLocaleString()} via ${method}.` };
}

function logPayment(args: Record<string, unknown>, ctx: TalaToolContext) {
  const deny = requireOwner(ctx);
  if (deny) return { error: deny };
  const update = ctx.update;
  if (!update) return { error: "Owner update channel is unavailable." };
  const direction = str(args.direction);
  const category = str(args.category);
  const amount = num(args.amount, 0);
  const method = paymentMethod(args.method);
  const description = str(args.description);
  if (!["in", "out"].includes(direction)) return { error: "direction must be 'in' or 'out'." };
  if (amount <= 0) return { error: "amount must be > 0." };
  const payment: CmsData["operations"]["payments"][number] = {
    id: uid("pay"),
    reference: generateReference("PY"),
    date: new Date().toISOString().slice(0, 10),
    category: (["booking", "tour", "rental", "other", "expense"].includes(category) ? category : "other") as Payment["category"],
    direction: direction as "in" | "out",
    amount,
    method,
    relatedId: str(args.relatedId),
    description,
    notes: "",
  };
  update((d) => ({
    ...d,
    operations: { ...d.operations, payments: [...d.operations.payments, payment] },
  }));
  return {
    success: true,
    reference: payment.reference,
    message: `Logged ${direction === "in" ? "revenue" : "expense"}: ₱${amount.toLocaleString()} (${category}).`,
  };
}

/** Runs one tool call and returns a JSON-serializable result for the model. */
export async function executeTalaTool(
  call: TalaToolCall,
  ctx: TalaToolContext,
): Promise<Record<string, unknown>> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(call.arguments || "{}");
  } catch {
    return { error: "Invalid tool arguments." };
  }

  switch (call.name) {
    case "check_room_availability":
      return checkRoomAvailability(args, ctx.cms);
    case "log_interested_guest":
      return logInterestedGuest(args);
    case "create_booking":
      return createBooking(args, ctx);
    case "update_booking":
      return updateBooking(args, ctx);
    case "create_tour_booking":
      return createTourBooking(args, ctx);
    case "update_rental":
      return updateRental(args, ctx);
    case "request_booking":
      return requestBooking(args, ctx);
    case "run_payroll":
      return runPayroll(args, ctx);
    case "mark_pay_record_paid":
      return markPayRecordPaid(args, ctx);
    case "log_payment":
      return logPayment(args, ctx);
    default:
      return { error: `Unknown tool: ${call.name}` };
  }
}
