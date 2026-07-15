import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { loadDb, fmtMoney, fmtDate, currentUserOrders } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { TrackingModal } from "@/components/TrackingModal";
import { Package, Plus, Search, Filter, Truck, ExternalLink } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePagination } from "@/hooks/usePagination";
import { PaginationBar } from "@/components/PaginationBar";
import type { Order } from "@/lib/db";

const PAGE_SIZE = 10;

/** Most recent tracking step: whichever step is in progress, else the last completed one, else the first step. */
function lastTrackingStep(o: Order): string {
  const inProgress = o.timeline.find(t => t.status === "in_progress");
  if (inProgress) return inProgress.step;
  const done = o.timeline.filter(t => t.status === "done");
  if (done.length) return done[done.length - 1].step;
  return o.timeline[0]?.step ?? "";
}

export function OrdersPage() {
  const { user } = useAuth();
  const db = loadDb();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [trackingOrder, setTrackingOrder] = useState<Order | null>(null);

  const orders = useMemo(() => {
    let list = currentUserOrders(db, user!);
    if (status !== "all") list = list.filter(o => o.status === status);
    if (q) list = list.filter(o =>
      o.orderNumber.toLowerCase().includes(q.toLowerCase()) ||
      o.jewelleryType.toLowerCase().includes(q.toLowerCase())
    );
    return list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [db, user, q, status]);

  const { paged, page, setPage, totalPages, total, start, end } = usePagination(orders, PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-brand-dark">Orders</h1>
          <p className="text-sm text-muted-foreground">{total} order{total !== 1 ? "s" : ""}</p>
        </div>
        {(user!.role === "client" || user!.role === "admin") && (
          <Button asChild className="btn-hero h-11 rounded-xl px-5">
            <Link to="/orders/new"><Plus className="h-4 w-4 mr-2" />New Order</Link>
          </Button>
        )}
      </div>

      <div className="card-luxe p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search orders..." className="pl-9 h-11 rounded-xl" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-48 h-11 rounded-xl"><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            {["Waiting","Approved","In Production","Ready","Dispatched","Delivered","Rejected"].map(s =>
              <SelectItem key={s} value={s}>{s}</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3">
        {paged.map(o => {
          const client = db.clients.find(c => c.id === o.clientId);
          const progress = Math.round(o.timeline.filter(t => t.status === "done").length / o.timeline.length * 100);
          return (
            <Link key={o.id} to={`/orders/${o.id}`} className="card-luxe p-4 md:p-5 hover:shadow-luxe hover:-translate-y-0.5 transition-all">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/15 to-brand-light/15 grid place-items-center shrink-0">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{o.orderNumber}</p>
                      <p className="text-xs text-muted-foreground truncate">{o.jewelleryType} · {o.metal} · {o.diamondType} Diamond · {o.quantity} pcs{o.designNumber ? ` · Design #${o.designNumber}` : ""}</p>
                      {user!.role !== "client" && <p className="text-xs text-muted-foreground mt-0.5">{client?.companyName}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={o.status} />
                        <span className="font-semibold text-sm">{fmtMoney(o.amount)}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg gap-1.5 h-8"
                          onClick={e => { e.preventDefault(); e.stopPropagation(); setTrackingOrder(o); }}
                        >
                          <Truck className="h-3.5 w-3.5" /> Track
                        </Button>
                      </div>
                      {o.status !== "Delivered" && o.status !== "Rejected" && (
                        <span className="flex items-center gap-1 text-xs font-medium text-success whitespace-nowrap">
                          <Truck className="h-3 w-3" /> Last update: {lastTrackingStep(o)}
                        </span>
                      )}
                      {(o.status === "Dispatched" || o.status === "Delivered") && o.courierName && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Truck className="h-3 w-3 shrink-0" />
                          {o.courierName} · <span className="font-mono">{o.trackingNumber}</span>
                          {o.trackingLink && (
                            <a
                              href={o.trackingLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="inline-flex items-center gap-0.5 text-primary hover:underline ml-1"
                            >
                              <ExternalLink className="h-3 w-3" /> Track
                            </a>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-brand-light transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
                      <span>{progress}% complete</span>
                      <span>Due {fmtDate(o.expectedDelivery)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
        {total === 0 && (
          <div className="card-luxe p-12 text-center text-muted-foreground">No orders match your filters.</div>
        )}
      </div>

      <PaginationBar
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        label={total > 0 ? `Showing ${start + 1}–${end} of ${total} orders` : undefined}
      />

      <TrackingModal order={trackingOrder} onClose={() => setTrackingOrder(null)} />
    </div>
  );
}
