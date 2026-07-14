import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Package, Users, Briefcase, MessageSquare, Bell, FileText, BarChart3, Settings, Search, LogOut, Plus, User, ChevronDown, UserCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { loadDb } from "@/lib/db";
import { useEffect, useRef, useState } from "react";

interface NavItem { to: string; label: string; icon: any; roles?: string[]; }
const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/orders", label: "Orders", icon: Package },
  { to: "/clients", label: "Clients", icon: Users, roles: ["admin","employee"] },
  { to: "/employees", label: "Employees", icon: Briefcase, roles: ["admin"] },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/messages", label: "Messages", icon: MessageSquare },
  { to: "/notifications", label: "Alerts", icon: Bell },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["admin"] },
  { to: "/settings", label: "Settings", icon: Settings },
];

const MOBILE_NAV: NavItem[] = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/orders", label: "Orders", icon: Package },
  { to: "/messages", label: "Chat", icon: MessageSquare },
  { to: "/notifications", label: "Alerts", icon: Bell },
  { to: "/profile", label: "Me", icon: User },
];

/* Map routes → page titles */
const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/orders": "Orders",
  "/orders/new": "New Order",
  "/clients": "Clients",
  "/employees": "Employees",
  "/invoices": "Invoices",
  "/messages": "Messages",
  "/notifications": "Notifications",
  "/reports": "Reports",
  "/settings": "Settings",
  "/search": "Search",
  "/profile": "My Profile",
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrator",
  employee: "Employee",
  client: "Client",
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [unread, setUnread] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const calc = () => { const db = loadDb(); setUnread(db.notifications.filter(n => n.userId === user?.id && !n.read).length); };
    calc();
    window.addEventListener("starlink-db-updated", calc);
    return () => window.removeEventListener("starlink-db-updated", calc);
  }, [user?.id]);

  /* Close profile dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const nav = NAV.filter(n => !n.roles || n.roles.includes(user!.role));
  const canCreateOrder = user?.role === "client" || user?.role === "admin";

  /* Resolve page title — handle dynamic segments like /orders/:id */
  const pageTitle = PAGE_TITLES[loc.pathname] ??
    (loc.pathname.startsWith("/orders/") ? "Order Detail" :
     loc.pathname.startsWith("/clients/") ? "Client History" : "");

  const initials = user?.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() ?? "?";

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Sidebar (desktop) ── */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-sidebar sticky top-0 h-screen">
        <div className="px-5 py-5 flex items-center">
          <img src="/starlink-logo.png" alt="Starlink Jewels" className="h-10 w-auto object-contain" />
        </div>
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {nav.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                 ${isActive ? "bg-primary text-primary-foreground shadow-soft" : "text-foreground/70 hover:bg-secondary hover:text-foreground"}`}>
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
              {item.to === "/notifications" && unread > 0 && (
                <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar user card */}
        <div className="p-3 border-t space-y-1">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-secondary/50">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-brand-dark text-white text-xs font-bold grid place-items-center shrink-0 shadow-soft">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{user?.name}</p>
              <p className="text-[11px] text-muted-foreground">{ROLE_LABEL[user?.role ?? ""] ?? user?.role}</p>
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* ── Top bar ── */}
        <header className="sticky top-0 z-30 glass border-b px-4 md:px-6 h-16 flex items-center gap-4">

          {/* Mobile logo */}
          <div className="md:hidden flex items-center shrink-0">
            <img src="/starlink-logo.png" alt="Starlink Jewels" className="h-8 w-auto object-contain" />
          </div>

          {/* Page title (desktop) */}
          {pageTitle && (
            <div className="hidden md:flex flex-col justify-center shrink-0">
              <h1 className="text-base font-semibold text-brand-dark leading-tight">{pageTitle}</h1>
              <p className="text-[11px] text-muted-foreground leading-tight capitalize">{user?.role} portal</p>
            </div>
          )}

          {/* Divider (desktop) */}
          {pageTitle && <div className="hidden md:block h-6 w-px bg-border/60 shrink-0" />}

          {/* Search bar */}
          <button
            onClick={() => navigate("/search")}
            className="flex-1 max-w-xs md:max-w-sm flex items-center gap-2 px-3 h-9 rounded-xl border border-border/80 bg-white/70 text-sm text-muted-foreground hover:border-primary hover:bg-white transition-all ml-auto md:ml-0">
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline truncate">Search orders, clients…</span>
          </button>

          {/* Spacer */}
          <div className="flex-1 hidden md:block" />

          {/* Notification bell */}
          <button
            onClick={() => navigate("/notifications")}
            className="relative h-9 w-9 rounded-xl hover:bg-secondary flex items-center justify-center transition-colors shrink-0">
            <Bell className="h-4.5 w-4.5 h-[18px] w-[18px]" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center leading-none">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>

          {/* Profile dropdown */}
          <div className="relative shrink-0" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(v => !v)}
              className="flex items-center gap-2.5 pl-1 pr-2.5 py-1 rounded-xl hover:bg-secondary transition-colors group">
              {/* Avatar */}
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-brand-dark text-white text-xs font-bold grid place-items-center shadow-soft">
                {initials}
              </div>
              {/* Name + role (desktop only) */}
              <div className="hidden md:flex flex-col items-start leading-tight">
                <span className="text-sm font-semibold text-foreground">{user?.name.split(" ")[0]}</span>
                <span className="text-[10px] text-muted-foreground capitalize">{user?.role}</span>
              </div>
              <ChevronDown className={`hidden md:block h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Dropdown menu */}
            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-border/80 bg-white shadow-lg overflow-hidden z-50">

                  {/* User info header */}
                  <div className="px-4 py-3 bg-secondary/40 border-b border-border/60">
                    <p className="text-sm font-semibold text-brand-dark truncate">{user?.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{ROLE_LABEL[user?.role ?? ""] ?? user?.role}</p>
                  </div>

                  {/* Actions */}
                  <div className="p-1.5 space-y-0.5">
                    <button
                      onClick={() => { setProfileOpen(false); navigate("/profile"); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-foreground hover:bg-secondary transition-colors text-left">
                      <UserCircle className="h-4 w-4 text-muted-foreground" /> My Profile
                    </button>
                    <button
                      onClick={() => { setProfileOpen(false); navigate("/settings"); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-foreground hover:bg-secondary transition-colors text-left">
                      <Settings className="h-4 w-4 text-muted-foreground" /> Settings
                    </button>
                    <div className="h-px bg-border/60 my-1" />
                    <button
                      onClick={() => { logout(); navigate("/login"); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-colors text-left">
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* ── Page content ── */}
        <motion.main
          key={loc.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex-1 pb-24 md:pb-8 px-4 md:px-8 pt-6">
          <Outlet />
        </motion.main>

        {/* ── Bottom nav (mobile) ── */}
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-40 glass border-t px-2 py-2 flex items-center justify-around"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}>
          {MOBILE_NAV.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[10px] font-medium transition
                 ${isActive ? "text-primary" : "text-muted-foreground"}`}>
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* ── FAB (mobile) ── */}
        {canCreateOrder && (
          <button
            onClick={() => navigate("/orders/new")}
            className="md:hidden fixed right-4 z-40 h-14 w-14 rounded-full btn-hero grid place-items-center shadow-lg"
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 5rem)" }}>
            <Plus className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>
  );
}