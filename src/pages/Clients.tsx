import { useState } from "react";
import { Link } from "react-router-dom";
import { loadDb, updateDb, uid, fmtMoney, fmtDate, type Client, type Order } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Mail, Phone, MapPin, Search, Trash2, Package, Eye, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ClientsPage() {
  const { user } = useAuth();
  const db = loadDb();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Partial<Client>>({ companyName: "", ownerName: "", email: "", phone: "", country: "USA", gstVat: "", address: "", username: "", password: "" });

  // Orders panel state
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [orderStatus, setOrderStatus] = useState("all");
  const [orderQ, setOrderQ] = useState("");

  const list = db.clients.filter(c =>
    c.companyName.toLowerCase().includes(q.toLowerCase()) ||
    c.ownerName.toLowerCase().includes(q.toLowerCase())
  );

  const openOrders = (c: Client) => {
    setSelectedClient(c);
    setOrderStatus("all");
    setOrderQ("");
    setOrdersOpen(true);
  };

  const clientOrders = (): Order[] => {
    if (!selectedClient) return [];
    let orders = db.orders.filter(o => o.clientId === selectedClient.id);
    if (orderStatus !== "all") orders = orders.filter(o => o.status === orderStatus);
    if (orderQ) orders = orders.filter(o =>
      o.orderNumber.toLowerCase().includes(orderQ.toLowerCase()) ||
      o.jewelleryType.toLowerCase().includes(orderQ.toLowerCase())
    );
    return orders.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  };

  const create = () => {
    if (!f.companyName || !f.username || !f.password) { toast.error("Fill required fields"); return; }
    const id = uid("c_");
    updateDb(d => {
      d.clients.unshift({ ...f, id, status: "active", createdAt: new Date().toISOString() } as Client);
      d.users.push({ id: uid("u_"), username: f.username!, password: f.password!, role: "client", name: f.ownerName || f.username!, email: f.email || "", phone: f.phone, status: "active", clientId: id, createdAt: new Date().toISOString() });
    });
    toast.success("Client created");
    setOpen(false);
    setF({ companyName: "", ownerName: "", email: "", phone: "", country: "USA", gstVat: "", address: "", username: "", password: "" });
  };

  const toggle = (c: Client) => {
    updateDb(d => {
      const x = d.clients.find(x => x.id === c.id)!;
      x.status = x.status === "active" ? "inactive" : "active";
      const u = d.users.find(u => u.clientId === c.id);
      if (u) u.status = x.status;
    });
    toast.success("Status updated");
  };

  const del = (id: string) => {
    if (!confirm("Delete client?")) return;
    updateDb(d => {
      d.clients = d.clients.filter(c => c.id !== id);
      d.users = d.users.filter(u => u.clientId !== id);
    });
    toast.success("Deleted");
  };

  const orders = clientOrders();

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-brand-dark">Clients</h1>
          <p className="text-sm text-muted-foreground">{list.length} clients</p>
        </div>
        {user!.role === "admin" && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="btn-hero h-11 rounded-xl"><Plus className="h-4 w-4 mr-2" />New Client</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg rounded-2xl">
              <DialogHeader><DialogTitle className="font-display text-2xl">Create Client</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {(["companyName","ownerName","email","phone","country","gstVat","address","username","password"] as const).map(k => (
                  <div key={k} className={k === "address" || k === "companyName" ? "col-span-2" : ""}>
                    <Label className="text-xs capitalize">{k.replace(/([A-Z])/g, " $1")}</Label>
                    <Input value={(f as any)[k] || ""} onChange={e => setF({ ...f, [k]: e.target.value })} className="rounded-xl mt-1" type={k === "password" ? "password" : "text"} />
                  </div>
                ))}
              </div>
              <Button onClick={create} className="btn-hero rounded-xl mt-2">Create Client</Button>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search clients..." className="pl-9 h-11 rounded-xl" />
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {list.map(c => {
          const orderCount = db.orders.filter(o => o.clientId === c.id).length;
          return (
            <div key={c.id} className="card-luxe p-5 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display text-lg text-brand-dark truncate">{c.companyName}</p>
                  <p className="text-sm text-muted-foreground truncate">{c.ownerName}</p>
                </div>
                <StatusBadge status={c.status} />
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <p className="flex items-center gap-2 text-muted-foreground truncate"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{c.email}</span></p>
                <p className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{c.phone}</p>
                <p className="flex items-center gap-2 text-muted-foreground truncate"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{c.country}</span></p>
              </div>

              {/* View Orders button — always visible */}
              <div className="mt-4 pt-4 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-xl gap-2 font-medium"
                  onClick={() => openOrders(c)}
                >
                  <Package className="h-4 w-4 text-primary" />
                  View Orders
                  <span className="ml-auto bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5 rounded-full">
                    {orderCount}
                  </span>
                </Button>
              </div>

              {user!.role === "admin" && (
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" onClick={() => toggle(c)} className="rounded-lg flex-1">{c.status === "active" ? "Deactivate" : "Activate"}</Button>
                  <Button size="sm" variant="outline" onClick={() => del(c.id)} className="rounded-lg text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              )}
            </div>
          );
        })}
        {list.length === 0 && (
          <div className="col-span-full card-luxe p-12 text-center text-muted-foreground">No clients found.</div>
        )}
      </div>

      {/* Client Orders Side Panel */}
      <Sheet open={ordersOpen} onOpenChange={setOrdersOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
          {selectedClient && (
            <>
              {/* Header */}
              <div className="sticky top-0 z-10 bg-white border-b border-border/60 px-6 py-5">
                <SheetHeader className="mb-4">
                  <SheetTitle className="font-display text-2xl text-brand-dark">{selectedClient.companyName}</SheetTitle>
                  <p className="text-sm text-muted-foreground">{selectedClient.ownerName} · {selectedClient.email}</p>
                </SheetHeader>

                {/* Filters */}
                <div className="flex gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[140px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={orderQ}
                      onChange={e => setOrderQ(e.target.value)}
                      placeholder="Search orders…"
                      className="pl-8 h-9 rounded-xl text-sm"
                    />
                  </div>
                  <Select value={orderStatus} onValueChange={setOrderStatus}>
                    <SelectTrigger className="w-40 h-9 rounded-xl text-sm">
                      <SelectValue placeholder="All status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All status</SelectItem>
                      {["Waiting","Approved","In Production","Ready","Dispatched","Delivered","Rejected"].map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <p className="text-xs text-muted-foreground mt-3">
                  {orders.length} order{orders.length !== 1 ? "s" : ""} found
                </p>
              </div>

              {/* Orders List */}
              <div className="p-6 space-y-3">
                {orders.map(o => {
                  const progress = Math.round(
                    o.timeline.filter(t => t.status === "done").length / o.timeline.length * 100
                  );
                  return (
                    <Link
                      key={o.id}
                      to={`/orders/${o.id}`}
                      onClick={() => setOrdersOpen(false)}
                      className="block card-luxe p-4 hover:shadow-luxe hover:-translate-y-0.5 transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 to-brand-light/15 grid place-items-center shrink-0">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate">{o.orderNumber}</p>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {o.jewelleryType} · {o.metal} · {o.diamondType} · {o.quantity} pcs
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <StatusBadge status={o.status} />
                              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="mt-3">
                            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-primary to-brand-light transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>

                          {/* Meta row */}
                          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                            <span>{progress}% complete</span>
                            <span className="font-semibold text-foreground">{fmtMoney(o.amount)}</span>
                            <span>Due {fmtDate(o.expectedDelivery)}</span>
                          </div>

                          {/* Priority + date */}
                          <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
                            <span className={
                              o.priority === "Urgent" ? "text-red-500 font-medium" :
                              o.priority === "High Priority" ? "text-orange-500 font-medium" :
                              "text-muted-foreground"
                            }>{o.priority}</span>
                            <span>Placed {fmtDate(o.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}

                {orders.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                    <Package className="h-12 w-12 mb-3 opacity-20" />
                    <p className="font-medium">No orders found</p>
                    <p className="text-sm mt-1">
                      {orderStatus !== "all" || orderQ
                        ? "Try adjusting your filters"
                        : "This client has no orders yet"}
                    </p>
                    {user!.role === "admin" && !orderQ && orderStatus === "all" && (
                      <Button asChild size="sm" className="mt-4 btn-hero rounded-xl">
                        <Link to="/orders/new" onClick={() => setOrdersOpen(false)}>
                          <Plus className="h-4 w-4 mr-1" /> New Order
                        </Link>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
