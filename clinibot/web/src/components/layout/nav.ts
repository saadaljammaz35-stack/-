import {
  BookOpen,
  Bot,
  CalendarClock,
  CreditCard,
  LayoutDashboard,
  MessageCircle,
  MessagesSquare,
  ScrollText,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { MessageKey } from "@/i18n";
import type { MemberRole } from "@/org/context";
import { MANAGER_ROLES } from "@/org/roles";

export interface NavItem {
  /** Absolute path under /app. */
  to: string;
  label: MessageKey;
  icon: LucideIcon;
  /** Only these roles see the item (all roles when omitted). */
  roles?: readonly MemberRole[];
}

/** Sidebar / mobile menu entries, in display order. Routes are in src/routes.tsx. */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: "/app", label: "common.navOverview", icon: LayoutDashboard },
  { to: "/app/conversations", label: "common.navConversations", icon: MessagesSquare },
  { to: "/app/appointments", label: "common.navAppointments", icon: CalendarClock },
  { to: "/app/knowledge", label: "common.navKnowledge", icon: BookOpen },
  { to: "/app/assistant", label: "common.navAssistant", icon: Bot },
  { to: "/app/whatsapp", label: "common.navWhatsapp", icon: MessageCircle },
  { to: "/app/staff", label: "common.navStaff", icon: Users },
  { to: "/app/billing", label: "common.navBilling", icon: CreditCard },
  { to: "/app/settings", label: "common.navSettings", icon: Settings },
  { to: "/app/audit", label: "common.navAudit", icon: ScrollText, roles: MANAGER_ROLES },
];
