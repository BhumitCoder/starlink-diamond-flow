import { useState } from "react";
import { Link } from "react-router-dom";
import { loadDb, updateDb, uid, type Client } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Mail, Phone, MapPin, Search, Trash2, Package, History, Printer } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { usePagination } from "@/hooks/usePagination";
import { PaginationBar } from "@/components/PaginationBar";

const PAGE_SIZE = 9;

/** Open a new window with an A5 shipping label and auto-print it */
function printLabel(c: Client) {
  const win = window.open("", "_blank", "width=620,height=880");
  if (!win) { alert("Allow popups to print labels."); return; }
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Shipping Label – ${c.companyName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A5 portrait; margin: 0; }
    body {
      width: 148mm; height: 210mm;
      display: flex; align-items: center; justify-content: center;
      background: #fff; font-family: Arial, Helvetica, sans-serif;
    }
    .label {
      width: 136mm; height: 198mm;
      border: 2.5px solid #1a1a2e;
      border-radius: 6px;
      display: flex; flex-direction: column;
      overflow: hidden;
    }
    /* ── FROM header ── */
    .header {
      background: #1a1a2e;
      color: #fff;
      padding: 6mm 8mm 5mm;
    }
    .header-title {
      font-size: 15pt; font-weight: 800; letter-spacing: 1px;
    }
    .header-sub {
      font-size: 8pt; opacity: .75; margin-top: 1.5mm; letter-spacing: .5px;
    }
    /* ── SHIP TO ── */
    .ship-to-banner {
      background: #f0f0f0;
      padding: 3mm 8mm;
      font-size: 8pt; font-weight: 700;
      color: #555; letter-spacing: 2px; text-transform: uppercase;
      border-bottom: 1px solid #ddd;
    }
    /* ── fields ── */
    .body {
      flex: 1;
      padding: 7mm 8mm 6mm;
      display: flex; flex-direction: column; gap: 5.5mm;
    }
    .field { display: flex; align-items: baseline; gap: 3mm; }
    .field-label {
      font-size: 9pt; font-weight: 700; color: #666;
      min-width: 36mm; flex-shrink: 0;
    }
    .field-value {
      font-size: 12.5pt; font-weight: 600; color: #1a1a2e;
      line-height: 1.35;
    }
    /* ── footer ── */
    .footer {
      border-top: 1.5px solid #e0e0e0;
      padding: 3.5mm 8mm;
      font-size: 7.5pt; color: #999;
      display: flex; justify-content: space-between; align-items: center;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="label">
    <div class="header">
      <div class="header-title">STARLINK JEWELS</div>
      <div class="header-sub">Fine Diamond Jewelry · India → USA</div>
    </div>
    <div class="ship-to-banner">Ship To</div>
    <div class="body">
      <div class="field">
        <div class="field-label">Name :</div>
        <div class="field-value">${c.companyName}${c.ownerName ? "<br><span style='font-size:10pt;font-weight:400;color:#555'>" + c.ownerName + "</span>" : ""}</div>
      </div>
      <div class="field">
        <div class="field-label">Address :</div>
        <div class="field-value">${(c.address || "—").replace(/\n/g, "<br>")}</div>
      </div>
      <div class="field">
        <div class="field-label">Zip :</div>
        <div class="field-value">${c.zip || "—"}</div>
      </div>
      <div class="field">
        <div class="field-label">Contact Number :</div>
        <div class="field-value">${c.phone || "—"}</div>
      </div>
    </div>
    <div class="footer">
      <span>Starlink Jewels · starlinkjewels.com</span>
      <span>${new Date().toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })}</span>
    </div>
  </div>
</body>
</html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

export function ClientsPage() {
  const { user } = useAuth();
  const db = loadDb();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Partial<Client>>({
    companyName: "", ownerName: "", email: "", phone: "",
    country: "USA", zip: "", gstVat: "", address: "", username: "", password: "",
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
    setF({ companyName: "", ownerName: "", email: "", phone: "", country: "USA", zip: "", gstVat: "", address: "", username: "", password: "" });
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
                {(["companyName","ownerName","email","phone","country","zip","gstVat","address","username","password"] as const).map(k => (
                  <div key={k} className={k === "address" || k === "companyName" ? "col-span-2" : ""}>
                    <Label className="text-xs capitalize">
                      {k === "zip" ? "ZIP / Postal Code" : k === "gstVat" ? "GST / VAT" : k.replace(/([A-Z])/g, " $1")}
                    </Label>
                    <Input
                      value={(f as Record<string, string>)[k] || ""}
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
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{[c.country, c.zip].filter(Boolean).join(" · ") || "—"}</span>
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

              <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                <Button asChild variant="outline" size="sm" className="w-full rounded-xl gap-2 font-medium">
                  <Link to={`/clients/${c.id}`}>
                    <History className="h-4 w-4 text-primary" />
                    View Order History
                  </Link>
                </Button>

                {/* Print shipping label */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => printLabel(c)}
                  className="w-full rounded-xl gap-2 font-medium text-muted-foreground hover:text-foreground"
                >
                  <Printer className="h-4 w-4" />
                  Print Shipping Label
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

      <PaginationBar
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        label={total > 0 ? `Showing ${start + 1}–${end} of ${total} clients` : undefined}
      />
    </div>
  );
}
