import type { CmsData } from "@/types/cms";
import { supabase, isSupabaseConnected } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// TALA's tools — this is what makes her an actual agent rather than a chat
// completion wrapped in a system prompt. She decides when to call these; we
// execute them against real data and hand the result back to her so her
// reply is grounded in something that just happened, not just what's baked
// into the prompt text.
//
// Both tools run entirely in the visitor's browser: room/booking data is
// already loaded (useCms), and Supabase writes use the same public
// anon-key client the rest of the site already uses.
// ---------------------------------------------------------------------------

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
  const name = typeof args.name === "string" ? args.name.trim().slice(0, 200) : "";
  const contact = typeof args.contact === "string" ? args.contact.trim().slice(0, 200) : "";
  const note = typeof args.note === "string" ? args.note.trim().slice(0, 1000) : "";

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

/** Runs one tool call and returns a JSON-serializable result for the model. */
export async function executeTalaTool(
  call: TalaToolCall,
  cms: CmsData,
): Promise<Record<string, unknown>> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(call.arguments || "{}");
  } catch {
    return { error: "Invalid tool arguments." };
  }

  switch (call.name) {
    case "check_room_availability":
      return checkRoomAvailability(args, cms);
    case "log_interested_guest":
      return logInterestedGuest(args);
    default:
      return { error: `Unknown tool: ${call.name}` };
  }
}
