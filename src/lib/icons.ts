import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const ICON_OPTIONS = [
  "Wifi", "Plug", "Sun", "Volume1", "Fish", "Soup", "Sparkles", "SunMedium",
  "Sunset", "Sofa", "Leaf", "Luggage", "Waves", "Clock", "User", "CalendarDays",
  "Laptop", "MapPin", "Phone", "Mail", "MessageCircle", "Star", "Coffee",
  "ShieldCheck", "Users", "Building2", "BedDouble", "ShowerHead", "UtensilsCrossed",
  "Signal", "BatteryCharging", "Wine", "Snowflake", "Tv", "Bath", "Refrigerator",
  "Fan", "Lamp", "Key", "DoorOpen", "Car", "ParkingSquare", "Waves", "Wind",
];

export function getIcon(name: string): LucideIcon {
  const icon = (Icons as unknown as Record<string, LucideIcon>)[name];
  return icon || Icons.Circle;
}
