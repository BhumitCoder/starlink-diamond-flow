import { useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { loadDb, fmtMoney, fmtDate, currentUserOrders, orderTotal, balanceDue } from "@/lib/db";
import { motion } from "framer-motion";
import { Package, Clock, CheckCircle2, Users, Briefcase, DollarSign, Factory, PackageCheck, TrendingUp, ArrowRight, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, Tooltip, PieChart, Pie, Cell } from "recharts";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import type { Order } from "@/lib/db";

/** Most recent tracking step: whichever step is in progress, else the last completed one, else the first step. */
function lastTrackingStep(o: Order): string {
  const inProgress = o.timeline.find(t => t.status === "in_progress");
  if (inProgress) return inProgress.step;
  const done = o.timeline.filter(t => t.status === "done");
  if (done.length) return done[done.length - 1].step;
  return o.timeline[0]?.step ?? "";
}

export function Dashboard() {
  const { user } = useAuth();
  const db = loadDb();
  const orders = useMemo(() => currentUserOrders(db, user!), [db, user]);

  const today = new Date().toDateString();
  const todayOrders = orders.filter(o => new Date(o.createdAt).toDateString() === today).length;
  const pending = orders.filter(o => o.status === "Waiting" || o.status === "Approved").length;
  const inProd = orders.filter(o => o.status === "In Production").length;
  const ready = orders.filter(o => o.status === "Ready" || o.status === "Dispatched").length;
  const completed = orders.filter(o => o.status === "Delivered").length;
  const revenue = orders.filter(o => o.status === "Delivered").reduce((s, o) => s + o.amount, 0);

  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
      return { m: d.toLocaleDateString("en-US", { month: "short" }), y: d.getFullYear(), month: d.getMonth() };
    });
    return months.map(({ m, y, month }) => ({
      name: m,
      orders: orders.filter(o => { const d = new Date(o.createdAt); return d.getMonth() === month && d.getFullYear() === y; }).length,
      revenue: orders.filter(o => { const d = new Date(o.createdAt); return d.getMonth() === month && d.getFullYear() === y; }).reduce((s, o) => s + o.amount, 0),
    }));
  }, [orders]);

  const statusData = [
    { name: "Waiting", value: orders.filter(o => o.status === "Waiting").length, color: "oklch(0.78 0.16 70)" },
    { name: "In Production", value: inProd, color: "oklch(0.475 0.13 264)" },
    { name: "Ready", value: ready, color: "oklch(0.68 0.11 262)" },
    { name: "Delivered", value: completed, color: "oklch(0.72 0.17 148)" },
  ];

  const client = user?.role === "client" ? db.clients.find(c => c.id === user.clientId) : null;
  const recent = [...orders].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 6);

  const stats: [string, string | number, any, string][] = user!.role === "admin"
    ? [
        ["Today's Orders", todayOrders, Clock, "text-primary"],
        ["Pending", pending, Package, "text-warning"],
        ["In Production", inProd, Factory, "text-primary"],
        ["Ready", ready, PackageCheck, "text-brand-light"],
        ["Completed", completed, CheckCircle2, "text-success"],
        ["Revenue", fmtMoney(revenue), DollarSign, "text-success"],
        ["Clients", db.clients.length, Users, "text-primary"],
        ["Employees", db.users.filter(u => u.role === "employee").length, Briefcase, "text-primary"],
      ]
    : user!.role === "employee"
    ? [
        ["Assigned", orders.length, Package, "text-primary"],
        ["Pending", pending, Clock, "text-warning"],
        ["In Production", inProd, Factory, "text-primary"],
        ["Completed", completed, CheckCircle2, "text-success"],
      ]
    : [
        ["Current Orders", orders.filter(o => o.status !== "Delivered").length, Package, "text-primary"],
        ["Completed", completed, CheckCircle2, "text-success"],
        ["Invoices", fmtMoney(orders.reduce((s, o) => s + orderTotal(o), 0)), DollarSign, "text-primary"],
        ["Pending Payment", fmtMoney(orders.reduce((s, o) => s + balanceDue(o), 0)), TrendingUp, "text-warning"],
      ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <p className="text-sm text-muted-foreground">Good day,</p>
        <h1 className="font-display text-3xl md:text-4xl text-brand-dark">{client?.companyName || user?.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">Here is what is happening today.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {stats.map(([label, val, Icon, color], i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <StatCard label={label} value={val} icon={Icon} colorClass={color} />
          </motion.div>
        ))}
      </div>

      {user!.role === "admin" && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="card-luxe p-5 lg:col-span-2">
            <h3 className="font-semibold mb-4">Monthly Orders</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData}>
                <XAxis dataKey="name" tickLine={false} axisLine={false} className="text-xs" />
                <YAxis tickLine={false} axisLine={false} className="text-xs" />
                <Tooltip cursor={{ fill: "oklch(0.955 0.015 250 / 0.5)" }} contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.92 0.012 250)" }} />
                <Bar dataKey="orders" fill="oklch(0.475 0.13 264)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card-luxe p-5">
            <h3 className="font-semibold mb-4">Production Status</h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={statusData} innerRadius={50} outerRadius={90} dataKey="value">
                  {statusData.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {statusData.map(s => <div key={s.name} className="flex items-center gap-2 text-xs"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.name}: {s.value}</div>)}
            </div>
          </div>
          <div className="card-luxe p-5 lg:col-span-3">
            <h3 className="font-semibold mb-4">Revenue Trend</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyData}>
                <XAxis dataKey="name" tickLine={false} axisLine={false} className="text-xs" />
                <YAxis tickLine={false} axisLine={false} className="text-xs" tickFormatter={v => `$${v/1000}k`} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} contentStyle={{ borderRadius: 12 }} />
                <Line type="monotone" dataKey="revenue" stroke="oklch(0.475 0.13 264)" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="card-luxe p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Recent Orders</h3>
          <Link to="/orders" className="text-sm text-primary flex items-center gap-1 hover:underline">View all <ArrowRight className="h-3 w-3" /></Link>
        </div>
        <div className="space-y-2">
          {recent.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No orders yet.</p>}
          {recent.map(o => (
            <Link key={o.id} to={`/orders/${o.id}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/10 to-brand-light/10 grid place-items-center">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{o.orderNumber} — {o.jewelleryType}</p>
                <p className="text-xs text-muted-foreground">{db.clients.find(c => c.id === o.clientId)?.companyName} · {fmtDate(o.createdAt)}{o.designNumber ? ` · Design #${o.designNumber}` : ""}</p>
              </div>
              <div className="hidden sm:block text-sm font-semibold">{fmtMoney(o.amount)}</div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge status={o.status} />
                {o.status !== "Delivered" && o.status !== "Rejected" && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-primary whitespace-nowrap">
                    <Truck className="h-3 w-3" /> {lastTrackingStep(o)}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}