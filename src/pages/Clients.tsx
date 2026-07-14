import { useState } from "react";
import { Link } from "react-router-dom";
import { loadDb, updateDb, uid, type Client } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Mail, Phone, MapPin, Search, Trash2, Package, History } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { usePagination } from "@/hooks/usePagination";
import { PaginationBar } from "@/components/PaginationBar";

const PAGE_SIZE = 9;

export function ClientsPage() {
  const { user } = useAuth();
  const db = loadDb();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Partial<Client>>({
    companyName: "", ownerName: "", email: "", phone: "",
    country: "USA", gstVat: "", address: "", username: "", password: "",
  });

  const list = db.clients.filter(c =>
    c.companyName.toLowerCase().includes(q.toLowerCase()) ||
    c.ownerName.toLowerCase().includes(q.toLowerCase())
  );

  const { paged, page, setPage, totalPages, total, start, end } = usePagination(list, PAGE_SIZE);

  const create = () => {
    if (!f.companyName || !f.username || !f.password) { toast.error("Fill required fields"); return; }
    const id = uid("c_");
    updateDb(d => {
      d.clients.unshift({ ...f, id, status: "active", createdAt: new Date().toISOString() } as Client);
      d.users.push({
        id: uid("u_"), username: f.username!, password: f.password!, role: "client",
        name: f.ownerName || f.username!, email: f.email || "", phone: f.phone,
        status: "active", clientId: id, createdAt: new Date().toISOString(),
      });
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

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-brand-dark">Clients</h1>
          <p className="text-sm text-muted-foreground">{total} client{total !== 1 ? "s" : ""}</p>
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
                    <Input
                      value={(f as any)[k] || ""}
                      onChange={e => setF({ ...f, [k]: e.target.value })}
                      className="rounded-xl mt-1"
                      type={k === "password" ? "password" : "text"}
                    />
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
        {paged.map(c => {
          const orderCount = db.orders.filter(o => o.clientId === c.id).length;
          const activeCount = db.orders.filter(o => o.clientId === c.id && !["Delivered","Rejected"].includes(o.status)).length;
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
                <p className="flex items-center gap-2 text-muted-foreground truncate">
                  <Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{c.email || "—"}</span>
                </p>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />{c.phone || "—"}
                </p>
                <p className="flex items-center gap-2 text-muted-foreground truncate">
                  <MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{c.country || "—"}</span>
                </p>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">
                  <Package className="h-3.5 w-3.5" /> {orderCount} total
                </span>
                {activeCount > 0 && (
                  <span className="flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                    {activeCount} active
                  </span>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-border/50">
                <Button asChild variant="outline" size="sm" className="w-full rounded-xl gap-2 font-medium">
                  <Link to={`/clients/${c.id}`}>
                    <History className="h-4 w-4 text-primary" />
                    View Order History
                  </Link>
                </Button>
              </div>

              {user!.role === "admin" && (
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" onClick={() => toggle(c)} className="rounded-lg flex-1">
                    {c.status === "active" ? "Deactivate" : "Activate"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => del(c.id)} className="rounded-lg text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
        {total === 0 && (
          <div className="col-span-full card-luxe p-12 text-center text-muted-foreground">No clients found.</div>
        )}
      </div>

      <div className="card-luxe px-4 py-1">
        <PaginationBar
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          label={total > 0 ? `Showing ${start + 1}–${end} of ${total} clients` : undefined}
        />
      </div>
    </div>
  );
}
