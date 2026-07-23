import type { CmsData } from "@/types/cms";
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
    source: (str(args.source, "whatsapp") as CmsData["operations"]["bookings"][number]["source"]) || "whatsapp",
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
  const found = findBooking(ctx.cms, args.reference, args.guestName);
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
    default:
      return { error: `Unknown tool: ${call.name}` };
  }
}
