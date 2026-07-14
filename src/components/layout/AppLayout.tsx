import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Package, Users, Briefcase, MessageSquare, Bell, FileText, BarChart3, Settings, Search, LogOut, Plus, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { motion } from "framer-motion";
import { loadDb } from "@/lib/db";
import { useEffect, useState } from "react";

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

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const calc = () => { const db = loadDb(); setUnread(db.notifications.filter(n => n.userId === user?.id && !n.read).length); };
    calc();
    window.addEventListener("starlink-db-updated", calc);
    return () => window.removeEventListener("starlink-db-updated", calc);
  }, [user?.id]);

  const nav = NAV.filter(n => !n.roles || n.roles.includes(user!.role));
  const canCreateOrder = user?.role === "client" || user?.role === "admin";

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-sidebar sticky top-0 h-screen">
        <div className="p-6 flex items-center gap-3">
          <img src="/logo.png" alt="Starlink" className="h-10 w-10 rounded-xl object-contain bg-white p-1 shadow-soft" />
          <div className="min-w-0">
            <p className="font-display text-lg leading-none font-semibold text-brand-dark">Starlink</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">Jewels</p>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {nav.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-primary text-primary-foreground shadow-soft" : "text-foreground/70 hover:bg-secondary hover:text-foreground"}`}>
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
              {item.to === "/notifications" && unread > 0 && (
                <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5 rounded-full">{unread}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t">
          <button onClick={() => { logout(); navigate("/login"); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-secondary">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 glass border-b px-4 md:px-8 h-16 flex items-center gap-3">
          <div className="md:hidden flex items-center gap-2">
            <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg object-contain bg-white p-0.5 shadow-soft" />
            <span className="font-display font-semibold text-brand-dark">Starlink</span>
          </div>
          <button onClick={() => navigate("/search")} className="ml-auto md:ml-0 md:flex-1 md:max-w-md flex items-center gap-2 px-3 h-10 rounded-xl border bg-white/70 text-sm text-muted-foreground hover:border-primary transition">
            <Search className="h-4 w-4" /> <span className="hidden sm:inline">Search orders, clients…</span>
          </button>
          <button onClick={() => navigate("/notifications")} className="relative p-2 rounded-xl hover:bg-secondary">
            <Bell className="h-5 w-5" />
            {unread > 0 && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />}
          </button>
          <button onClick={() => navigate("/profile")} className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-brand-dark text-white text-sm font-semibold grid place-items-center shadow-soft">
            {user?.name.charAt(0)}
          </button>
        </header>

        <motion.main key={loc.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="flex-1 pb-24 md:pb-8 px-4 md:px-8 pt-6">
          <Outlet />
        </motion.main>

        {/* Bottom nav (mobile) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 glass border-t px-2 py-2 flex items-center justify-around" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}>
          {MOBILE_NAV.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"}
              className={({ isActive }) => `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[10px] font-medium transition ${isActive ? "text-primary" : "text-muted-foreground"}`}>
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* FAB */}
        {canCreateOrder && (
          <button onClick={() => navigate("/orders/new")} className="md:hidden fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full btn-hero grid place-items-center" style={{ bottom: "calc(env(safe-area-inset-bottom) + 5rem)" }}>
            <Plus className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>
  );
}