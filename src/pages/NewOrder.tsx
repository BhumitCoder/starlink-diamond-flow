import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { loadDb, updateDb, uid, TIMELINE_STEPS, type Order } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { DollarSign, Building2 } from "lucide-react";

export function NewOrderPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const isAdmin    = user?.role === "admin";
  const isEmployee = user?.role === "employee";
  const isClient   = user?.role === "client";

  /* load clients list + pricing rates from settings */
  const initDb          = loadDb();
  const allClients      = isAdmin || isEmployee
    ? initDb.clients.filter(c => c.status === "active")
    : [];
  const diamondRate     = initDb.settings.diamondRate             ?? 3500;
  const metalRate       = initDb.settings.metalRate               ?? 65;
  const defaultShipping = initDb.settings.defaultShippingCharge ?? 0;

  const [f, setF] = useState({
    /* client selection (admin/employee only) */
    clientId: isClient ? (user!.clientId ?? "") : "",

    /* order fields */
    jewelleryType: "Ring",
    metal: "Gold",
    diamondType: "Natural",
    quantity: 1,
    diamondWeight: 0.5,
    metalWeight: 3,
    instructions: "",
    expectedDelivery: "",
    priority: "Normal",

    /* order value — editable, pre-seeded from auto-calc */
    orderValue: Math.round(0.5 * diamondRate + 3 * metalRate),
    valueManuallySet: false,

    /* shipping */
    shippingCharge: defaultShipping,

    /* advance */
    advanceAmount: 0,
    advanceNote: "",
  });

  const [saving, setSaving] = useState(false);

  /* auto-update order value when weights change (unless user manually typed it) */
  useEffect(() => {
    if (!f.valueManuallySet) {
      setF(prev => ({
        ...prev,
        orderValue: Math.round(Number(prev.diamondWeight) * diamondRate + Number(prev.metalWeight) * metalRate),
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.diamondWeight, f.metalWeight]);

  const set = (key: string, value: unknown) =>
    setF(prev => ({ ...prev, [key]: value }));

  const handleOrderValueChange = (raw: string) => {
    setF(prev => ({ ...prev, orderValue: Number(raw) || 0, valueManuallySet: true }));
  };

  const resetValueToAuto = () => {
    const auto = Math.round(Number(f.diamondWeight) * diamondRate + Number(f.metalWeight) * metalRate);
    setF(prev => ({ ...prev, orderValue: auto, valueManuallySet: false }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();

    /* validation */
    if (!isClient && !isAdmin && !isEmployee) {
      toast.error("You don't have permission to create orders.");
      return;
    }
    if ((isAdmin || isEmployee) && !f.clientId) {
      toast.error("Please select a client for this order.");
      return;
    }
    if (f.orderValue <= 0) {
      toast.error("Please enter a valid order value.");
      return;
    }

    setSaving(true);
    const clientId = isClient ? user!.clientId! : f.clientId;

    updateDb(d => {
      const num = `SLJ-${new Date().getFullYear()}-${String(1000 + d.orders.length + 1).padStart(4, "0")}`;
      const advance = Number(f.advanceAmount) || 0;

      const order: Order = {
        id: uid("o_"),
        orderNumber: num,
        clientId,
        contactPerson: user!.name,
        jewelleryType: f.jewelleryType as Order["jewelleryType"],
        metal: f.metal as Order["metal"],
        diamondType: f.diamondType as Order["diamondType"],
        quantity: Number(f.quantity),
        diamondWeight: Number(f.diamondWeight),
        metalWeight: Number(f.metalWeight),
        images: [],
        instructions: f.instructions,
        expectedDelivery: f.expectedDelivery || new Date(Date.now() + 45 * 86400000).toISOString(),
        priority: f.priority as Order["priority"],
        status: "Waiting",
        amount: f.orderValue,
        shippingCharge: Number(f.shippingCharge) || 0,
        advances: advance > 0 ? [{
          id: uid("adv_"),
          amount: advance,
          note: f.advanceNote || "Initial advance",
          recordedBy: user!.id,
          createdAt: new Date().toISOString(),
        }] : [],
        timeline: TIMELINE_STEPS.map((s, i) => ({
          step: s,
          status: i === 0 ? "done" : "pending" as "done" | "pending",
          date: i === 0 ? new Date().toISOString() : undefined,
        })),
        createdAt: new Date().toISOString(),
      };

      d.orders.unshift(order);

      /* notify admin (if submitted by client) */
      if (isClient) {
        const admin = d.users.find(u => u.role === "admin");
        if (admin) d.notifications.unshift({
          id: uid("n_"), userId: admin.id,
          title: "New Order Request",
          body: `${order.orderNumber} from ${d.clients.find(c => c.id === clientId)?.companyName ?? "client"}${advance > 0 ? ` · Advance $${advance}` : ""}`,
          type: "order", read: false, createdAt: new Date().toISOString(),
        });
      }

      /* notify client (if created by admin/employee) */
      if (isAdmin || isEmployee) {
        const clientUser = d.users.find(u => u.clientId === clientId && u.role === "client");
        if (clientUser) d.notifications.unshift({
          id: uid("n_"), userId: clientUser.id,
          title: "Order Created",
          body: `${order.orderNumber} has been created for your account.`,
          type: "order", read: false, createdAt: new Date().toISOString(),
        });
      }
    });

    toast.success("Order submitted successfully");
    nav("/orders");
  };

  const shipping   = Number(f.shippingCharge) || 0;
  const grandTotal = Number(f.orderValue) + shipping;
  const balanceDue = Math.max(0, grandTotal - Number(f.advanceAmount));
  const autoValue  = Math.round(Number(f.diamondWeight) * diamondRate + Number(f.metalWeight) * metalRate);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="font-display text-3xl text-brand-dark">New Order</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isClient ? "Submit a new jewellery order request" : "Create an order on behalf of a client"}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-5">

        {/* ── Client selector (admin / employee only) ── */}
        {(isAdmin || isEmployee) && (
          <div className="card-luxe p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 grid place-items-center shrink-0">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-brand-dark">Client</h2>
                <p className="text-xs text-muted-foreground">Select the client this order belongs to</p>
              </div>
            </div>

            <Field label="Select Client *">
              <Select value={f.clientId} onValueChange={v => set("clientId", v)} required>
                <SelectTrigger className="rounded-xl h-11">
                  <SelectValue placeholder="Choose a client…" />
                </SelectTrigger>
                <SelectContent>
                  {allClients.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="font-medium">{c.companyName}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{c.ownerName}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {/* Show selected client info */}
            {f.clientId && (() => {
              const c = allClients.find(x => x.id === f.clientId);
              return c ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 text-sm">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/15 to-brand-light/15 grid place-items-center shrink-0 text-primary font-bold text-xs">
                    {c.companyName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{c.companyName}</p>
                    <p className="text-xs text-muted-foreground">{c.ownerName} · {c.country}</p>
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        )}

        {/* ── Order Details ── */}
        <div className="card-luxe p-6 space-y-5">
          <h2 className="font-semibold text-brand-dark">Order Details</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Jewellery Type">
              <Select value={f.jewelleryType} onValueChange={v => set("jewelleryType", v)}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Ring","Pendant","Necklace","Bracelet","Earrings","Custom"].map(x =>
                    <SelectItem key={x} value={x}>{x}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Metal">
              <Select value={f.metal} onValueChange={v => set("metal", v)}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Gold","White Gold","Rose Gold","Platinum","Silver"].map(x =>
                    <SelectItem key={x} value={x}>{x}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Diamond Type">
              <Select value={f.diamondType} onValueChange={v => set("diamondType", v)}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Natural","Lab Grown"].map(x =>
                    <SelectItem key={x} value={x}>{x}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Priority">
              <Select value={f.priority} onValueChange={v => set("priority", v)}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Normal","High Priority","Urgent"].map(x =>
                    <SelectItem key={x} value={x}>{x}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Quantity">
              <Input type="number" min={1} value={f.quantity}
                onChange={e => set("quantity", +e.target.value)}
                className="rounded-xl h-11" />
            </Field>

            <Field label="Diamond Weight (ct)">
              <Input type="number" step="0.01" min={0} value={f.diamondWeight}
                onChange={e => set("diamondWeight", +e.target.value)}
                className="rounded-xl h-11" />
            </Field>

            <Field label="Metal Weight (g)">
              <Input type="number" step="0.01" min={0} value={f.metalWeight}
                onChange={e => set("metalWeight", +e.target.value)}
                className="rounded-xl h-11" />
            </Field>

            <Field label="Expected Delivery">
              <Input type="date" value={f.expectedDelivery}
                onChange={e => set("expectedDelivery", e.target.value)}
                className="rounded-xl h-11" />
            </Field>
          </div>

          <Field label="Special Instructions">
            <Textarea
              value={f.instructions}
              onChange={e => set("instructions", e.target.value)}
              rows={3} className="rounded-xl"
              placeholder="Design notes, stone preferences, reference details" />
          </Field>
        </div>

        {/* ── Order Value ── */}
        <div className="card-luxe p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-brand-light/15 grid place-items-center shrink-0">
              <DollarSign className="h-4 w-4 text-brand-dark" />
            </div>
            <div>
              <h2 className="font-semibold text-brand-dark">Order Value</h2>
              <p className="text-xs text-muted-foreground">Set the agreed order amount</p>
            </div>
          </div>

          <Field label="Order Value ($) *">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">$</span>
              <Input
                type="number" min={0} step="0.01" required
                value={f.orderValue || ""}
                onChange={e => handleOrderValueChange(e.target.value)}
                className="rounded-xl h-11 pl-7 text-base font-semibold"
                placeholder="0"
              />
            </div>
          </Field>

          {/* Auto-calc hint */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Auto-estimate based on weights:&nbsp;
              <span className="font-medium text-foreground">${autoValue.toLocaleString()}</span>
              <span className="ml-1">(Diamond {f.diamondWeight}ct × ${diamondRate.toLocaleString()} + Metal {f.metalWeight}g × ${metalRate.toLocaleString()})</span>
            </span>
            {f.valueManuallySet && (
              <button type="button" onClick={resetValueToAuto}
                className="ml-3 text-primary hover:underline shrink-0 font-medium">
                Use estimate
              </button>
            )}
          </div>
        </div>

        {/* ── Shipping Charge ── */}
        <div className="card-luxe p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-brand-light/15 grid place-items-center shrink-0">
              <DollarSign className="h-4 w-4 text-brand-dark" />
            </div>
            <div>
              <h2 className="font-semibold text-brand-dark">Shipping Charge</h2>
              <p className="text-xs text-muted-foreground">Freight / courier cost added to this order</p>
            </div>
          </div>
          <Field label="Shipping Charge ($)">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">$</span>
              <Input
                type="number" min={0} step="0.01"
                value={f.shippingCharge || ""}
                onChange={e => set("shippingCharge", +e.target.value)}
                className="rounded-xl h-11 pl-7"
                placeholder="0"
              />
            </div>
          </Field>
        </div>

        {/* ── Advance Payment ── */}
        <div className="card-luxe p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-success/10 grid place-items-center shrink-0">
              <DollarSign className="h-4 w-4 text-success" />
            </div>
            <div>
              <h2 className="font-semibold text-brand-dark">Advance Payment</h2>
              <p className="text-xs text-muted-foreground">Optional — enter any amount paid upfront</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Advance Amount ($)">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">$</span>
                <Input
                  type="number" min={0} max={grandTotal} step="0.01"
                  value={f.advanceAmount || ""}
                  onChange={e => set("advanceAmount", +e.target.value)}
                  className="rounded-xl h-11 pl-7"
                  placeholder="0"
                />
              </div>
            </Field>
            <Field label="Payment Note">
              <Input
                value={f.advanceNote}
                onChange={e => set("advanceNote", e.target.value)}
                className="rounded-xl h-11"
                placeholder="e.g. Cash, Bank transfer, Cheque"
              />
            </Field>
          </div>

          {/* Balance preview — 4 tiles when shipping > 0, 3 when zero */}
          <div className={`grid gap-3 ${shipping > 0 ? "grid-cols-4" : "grid-cols-3"}`}>
            <div className="p-3 rounded-xl bg-secondary text-center">
              <p className="text-xs text-muted-foreground mb-1">Order Value</p>
              <p className="font-semibold text-brand-dark">${Number(f.orderValue).toLocaleString()}</p>
            </div>
            {shipping > 0 && (
              <div className="p-3 rounded-xl bg-secondary text-center">
                <p className="text-xs text-muted-foreground mb-1">Shipping</p>
                <p className="font-semibold text-brand-dark">${shipping.toLocaleString()}</p>
              </div>
            )}
            <div className={`p-3 rounded-xl text-center ${f.advanceAmount > 0 ? "bg-success/5 border border-success/20" : "bg-secondary"}`}>
              <p className="text-xs text-muted-foreground mb-1">Advance Paid</p>
              <p className={`font-semibold ${f.advanceAmount > 0 ? "text-success" : "text-muted-foreground"}`}>
                ${Number(f.advanceAmount || 0).toLocaleString()}
              </p>
            </div>
            <div className={`p-3 rounded-xl text-center ${balanceDue > 0 ? "bg-destructive/5 border border-destructive/20" : "bg-success/5 border border-success/20"}`}>
              <p className="text-xs text-muted-foreground mb-1">Balance Due</p>
              <p className={`font-semibold ${balanceDue > 0 ? "text-destructive" : "text-success"}`}>
                {balanceDue > 0 ? `${balanceDue.toLocaleString()}` : "✓ Cleared"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pb-4">
          <Button type="button" variant="outline" onClick={() => nav(-1)} className="rounded-xl">
            Cancel
          </Button>
          <Button type="submit" disabled={saving} className="btn-hero rounded-xl px-8">
            {saving ? "Submitting…" : "Submit Order"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
