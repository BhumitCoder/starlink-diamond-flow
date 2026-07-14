import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { updateDb, uid, TIMELINE_STEPS, type Order } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export function NewOrderPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({
    jewelleryType: "Ring", metal: "Gold", diamondType: "Natural",
    quantity: 1, diamondWeight: 0.5, metalWeight: 3,
    instructions: "", expectedDelivery: "", priority: "Normal",
  });
  const [saving, setSaving] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (user!.role !== "client") { toast.error("Only clients can create order requests. Admins can manage from client details."); return; }
    setSaving(true);
    const clientId = user!.clientId!;
    updateDb(d => {
      const num = `SLJ-${new Date().getFullYear()}-${String(1000 + d.orders.length + 1).padStart(4, "0")}`;
      const order: Order = {
        id: uid("o_"), orderNumber: num, clientId, contactPerson: user!.name,
        jewelleryType: f.jewelleryType as any, metal: f.metal as any, diamondType: f.diamondType as any,
        quantity: Number(f.quantity), diamondWeight: Number(f.diamondWeight), metalWeight: Number(f.metalWeight),
        images: [], instructions: f.instructions,
        expectedDelivery: f.expectedDelivery || new Date(Date.now() + 45 * 86400000).toISOString(),
        priority: f.priority as any, status: "Waiting",
        amount: Math.round(Number(f.diamondWeight) * 3500 + Number(f.metalWeight) * 65),
        timeline: TIMELINE_STEPS.map((s, i) => ({ step: s, status: i === 0 ? "done" : "pending", date: i === 0 ? new Date().toISOString() : undefined })),
        createdAt: new Date().toISOString(),
      };
      d.orders.unshift(order);
      const admin = d.users.find(u => u.role === "admin");
      if (admin) d.notifications.unshift({ id: uid("n_"), userId: admin.id, title: "New Order", body: `${order.orderNumber} from ${d.clients.find(c => c.id === clientId)?.companyName}`, type: "order", read: false, createdAt: new Date().toISOString() });
    });
    toast.success("Order submitted for approval");
    nav("/orders");
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="font-display text-3xl text-brand-dark">New Order Request</h1>
      <form onSubmit={submit} className="card-luxe p-6 space-y-5">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Jewellery Type"><Select value={f.jewelleryType} onValueChange={v => setF({ ...f, jewelleryType: v })}><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger><SelectContent>{["Ring","Pendant","Necklace","Bracelet","Earrings","Custom"].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Metal"><Select value={f.metal} onValueChange={v => setF({ ...f, metal: v })}><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger><SelectContent>{["Gold","White Gold","Rose Gold","Platinum","Silver"].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Diamond Type"><Select value={f.diamondType} onValueChange={v => setF({ ...f, diamondType: v })}><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger><SelectContent>{["Natural","Lab Grown"].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Priority"><Select value={f.priority} onValueChange={v => setF({ ...f, priority: v })}><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger><SelectContent>{["Normal","Urgent","High Priority"].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Quantity"><Input type="number" min={1} value={f.quantity} onChange={e => setF({ ...f, quantity: +e.target.value })} className="rounded-xl h-11" /></Field>
          <Field label="Diamond Weight (ct)"><Input type="number" step="0.01" min={0} value={f.diamondWeight} onChange={e => setF({ ...f, diamondWeight: +e.target.value })} className="rounded-xl h-11" /></Field>
          <Field label="Metal Weight (g)"><Input type="number" step="0.01" min={0} value={f.metalWeight} onChange={e => setF({ ...f, metalWeight: +e.target.value })} className="rounded-xl h-11" /></Field>
          <Field label="Expected Delivery"><Input type="date" value={f.expectedDelivery} onChange={e => setF({ ...f, expectedDelivery: e.target.value })} className="rounded-xl h-11" /></Field>
        </div>
        <Field label="Special Instructions"><Textarea value={f.instructions} onChange={e => setF({ ...f, instructions: e.target.value })} rows={4} className="rounded-xl" placeholder="Design notes, stone preferences, reference details" /></Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => nav(-1)} className="rounded-xl">Cancel</Button>
          <Button type="submit" disabled={saving} className="btn-hero rounded-xl px-6">Submit Order</Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>{children}</div>;
}
