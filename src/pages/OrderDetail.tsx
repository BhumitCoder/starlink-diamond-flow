import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { loadDb, updateDb, fmtMoney, fmtDate, totalAdvance, balanceDue, uid } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, CheckCircle2, Circle, Loader2, Package, Download,
  DollarSign, Plus, TrendingUp, AlertCircle, Wallet,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import jsPDF from "jspdf";

export function OrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();

  // Advance form state
  const [showAdvForm, setShowAdvForm] = useState(false);
  const [advAmt, setAdvAmt] = useState("");
  const [advNote, setAdvNote] = useState("");

  const db = loadDb();
  const order = db.orders.find(o => o.id === id);
  if (!order) return <div className="text-center py-20">Order not found. <Link to="/orders" className="text-primary underline">Back</Link></div>;

  const client = db.clients.find(c => c.id === order.clientId);
  const employee = db.users.find(u => u.id === order.assignedEmployeeId);
  const advances = order.advances || [];
  const advTotal = totalAdvance(order);
  const balance = balanceDue(order);

  const canEditStage = () => user!.role === "admin" || (user!.role === "employee" && order.assignedEmployeeId === user!.id);

  const advanceStep = (idx: number) => {
    updateDb(d => {
      const o = d.orders.find(x => x.id === order.id)!;
      o.timeline[idx] = { ...o.timeline[idx], status: "done", date: new Date().toISOString(), employeeId: user!.id, department: user!.department, remarks: "Completed" };
      if (idx + 1 < o.timeline.length && o.timeline[idx + 1].status === "pending") o.timeline[idx + 1].status = "in_progress";
      const done = o.timeline.filter(t => t.status === "done").length;
      if (done >= 2 && o.status === "Waiting") o.status = "Approved";
      if (done >= 3 && done < 12) o.status = "In Production";
      if (done >= 12) o.status = "Ready";
      if (done >= 14) o.status = "Dispatched";
      if (done === o.timeline.length) o.status = "Delivered";
      const clientUser = d.users.find(u => u.clientId === o.clientId);
      if (clientUser) d.notifications.unshift({ id: "n" + Date.now(), userId: clientUser.id, title: "Timeline updated", body: `${o.orderNumber}: ${o.timeline[idx].step}`, type: "info", read: false, createdAt: new Date().toISOString() });
    });
    toast.success("Stage marked complete");
  };

  const approve = (yes: boolean) => {
    updateDb(d => {
      const o = d.orders.find(x => x.id === order.id)!;
      o.status = yes ? "Approved" : "Rejected";
      if (yes) {
        o.timeline[0].status = "done"; o.timeline[0].date = new Date().toISOString();
        o.timeline[1].status = "done"; o.timeline[1].date = new Date().toISOString();
        if (o.timeline[2]) o.timeline[2].status = "in_progress";
      }
    });
    toast.success(yes ? "Order approved" : "Order rejected");
  };

  const addAdvance = () => {
    const amt = parseFloat(advAmt);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    updateDb(d => {
      const o = d.orders.find(x => x.id === order.id)!;
      if (!o.advances) o.advances = [];
      o.advances.push({ id: uid("adv_"), amount: amt, note: advNote || "Advance payment", recordedBy: user!.id, createdAt: new Date().toISOString() });
      // notify client
      const clientUser = d.users.find(u => u.clientId === o.clientId);
      if (clientUser) d.notifications.unshift({ id: uid("n_"), userId: clientUser.id, title: "Advance Recorded", body: `${fmtMoney(amt)} advance received for ${o.orderNumber}`, type: "info", read: false, createdAt: new Date().toISOString() });
    });
    toast.success("Advance payment recorded");
    setAdvAmt(""); setAdvNote(""); setShowAdvForm(false);
  };

  const downloadInvoice = () => {
    const adv = totalAdvance(order);
    const bal = balanceDue(order);
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold"); doc.setFontSize(22);
    doc.text("STARLINK JEWELS", 20, 25);
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text("Fine Diamond Jewelry - Manufactured in India - Exported to USA", 20, 32);
    doc.setLineWidth(0.5); doc.line(20, 38, 190, 38);
    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text("INVOICE", 20, 50);
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(`Order #: ${order.orderNumber}`, 20, 60);
    doc.text(`Date: ${fmtDate(order.createdAt)}`, 20, 66);
    doc.text(`Bill To: ${client?.companyName || ""}`, 20, 76);
    doc.text(`${client?.address || ""}`, 20, 82);
    doc.text(`${client?.email || ""}  ${client?.phone || ""}`, 20, 88);
    doc.line(20, 100, 190, 100);
    doc.setFont("helvetica", "bold"); doc.text("Item", 20, 108); doc.text("Qty", 130, 108); doc.text("Amount", 165, 108);
    doc.setFont("helvetica", "normal");
    doc.text(`${order.jewelleryType} - ${order.metal} - ${order.diamondType}`, 20, 118);
    doc.text(String(order.quantity), 130, 118);
    doc.text(fmtMoney(order.amount), 165, 118);
    doc.line(20, 128, 190, 128);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text("Order Total:", 120, 138); doc.text(fmtMoney(order.amount), 165, 138);
    if (adv > 0) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      doc.text("Advance Paid:", 120, 148); doc.text(`- ${fmtMoney(adv)}`, 165, 148);
      doc.setFont("helvetica", "bold"); doc.setFontSize(12);
      doc.text("Balance Due:", 120, 160); doc.text(fmtMoney(bal), 165, 160);
    }
    doc.setFontSize(9); doc.setFont("helvetica", "italic");
    doc.text("Thank you for choosing Starlink Jewels.", 20, 260);
    doc.save(`Invoice-${order.orderNumber}.pdf`);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <button onClick={() => nav(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back</button>

      {/* Order Header */}
      <div className="card-luxe p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/15 to-brand-light/15 grid place-items-center">
              <Package className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{order.orderNumber}</p>
              <h1 className="font-display text-2xl md:text-3xl text-brand-dark">{order.jewelleryType} in {order.metal}</h1>
              <p className="text-sm text-muted-foreground mt-1">{client?.companyName} · {order.contactPerson}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={order.status} />
            <Button variant="outline" onClick={downloadInvoice} className="rounded-xl"><Download className="h-4 w-4 mr-2" />Invoice</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 text-sm">
          {[
            ["Quantity", `${order.quantity} pcs`],
            ["Diamond", `${order.diamondWeight} ct (${order.diamondType})`],
            ["Metal Weight", `${order.metalWeight} g`],
            ["Priority", order.priority],
            ["Amount", fmtMoney(order.amount)],
            ["Expected", fmtDate(order.expectedDelivery)],
            ["Assigned to", employee?.name || "—"],
            ["Created", fmtDate(order.createdAt)],
          ].map(([k, v]) => (
            <div key={k}><p className="text-xs text-muted-foreground">{k}</p><p className="font-medium mt-0.5">{v}</p></div>
          ))}
        </div>

        {order.instructions && (
          <div className="mt-4 p-3 rounded-xl bg-secondary text-sm">
            <p className="text-xs text-muted-foreground mb-1">Special Instructions</p>
            {order.instructions}
          </div>
        )}

        {user!.role === "admin" && order.status === "Waiting" && (
          <div className="mt-5 flex gap-3">
            <Button onClick={() => approve(true)} className="btn-hero rounded-xl">Approve Order</Button>
            <Button variant="outline" onClick={() => approve(false)} className="rounded-xl">Reject</Button>
          </div>
        )}
      </div>

      {/* ── Advance Payment Card ── */}
      <div className="card-luxe p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-success/10 grid place-items-center">
              <Wallet className="h-5 w-5 text-success" />
            </div>
            <div>
              <h3 className="font-display text-lg text-brand-dark">Advance Payments</h3>
              <p className="text-xs text-muted-foreground">{advances.length} payment{advances.length !== 1 ? "s" : ""} recorded</p>
            </div>
          </div>
          {user!.role === "admin" && (
            <Button size="sm" onClick={() => setShowAdvForm(v => !v)} className="btn-hero rounded-xl gap-2">
              <Plus className="h-4 w-4" /> Add Advance
            </Button>
          )}
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-secondary text-center">
            <p className="text-xs text-muted-foreground mb-1">Order Total</p>
            <p className="font-semibold text-sm">{fmtMoney(order.amount)}</p>
          </div>
          <div className="p-3 rounded-xl bg-success/8 border border-success/20 text-center">
            <p className="text-xs text-muted-foreground mb-1">Advance Paid</p>
            <p className="font-semibold text-sm text-success">{fmtMoney(advTotal)}</p>
          </div>
          <div className={`p-3 rounded-xl text-center border ${balance > 0 ? "bg-destructive/5 border-destructive/20" : "bg-success/8 border-success/20"}`}>
            <p className="text-xs text-muted-foreground mb-1">Balance Due</p>
            <p className={`font-semibold text-sm ${balance > 0 ? "text-destructive" : "text-success"}`}>
              {balance > 0 ? fmtMoney(balance) : "✓ Cleared"}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        {order.amount > 0 && (
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Payment progress</span>
              <span>{Math.min(100, Math.round(advTotal / order.amount * 100))}%</span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-success to-emerald-400 transition-all"
                style={{ width: `${Math.min(100, (advTotal / order.amount) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Add advance form */}
        <AnimatePresence>
          {showAdvForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-2 border-t border-border/60 space-y-3">
                <p className="text-sm font-medium text-brand-dark">Record New Advance</p>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Amount ($)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number" min="1" step="0.01"
                        value={advAmt} onChange={e => setAdvAmt(e.target.value)}
                        className="pl-9 rounded-xl h-10"
                        placeholder="0.00"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Payment Note</Label>
                    <Input
                      value={advNote} onChange={e => setAdvNote(e.target.value)}
                      className="rounded-xl h-10"
                      placeholder="e.g. Cash, Bank transfer, Cheque #"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addAdvance} className="btn-hero rounded-xl">Save Payment</Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowAdvForm(false); setAdvAmt(""); setAdvNote(""); }} className="rounded-xl">Cancel</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Advance ledger */}
        {advances.length > 0 ? (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment History</p>
            {advances.map((a, i) => {
              const recorder = db.users.find(u => u.id === a.recordedBy);
              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-secondary/50 border border-border/40"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-success/15 grid place-items-center shrink-0">
                      <TrendingUp className="h-4 w-4 text-success" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{a.note}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(a.createdAt)} · by {recorder?.name || "Admin"}
                      </p>
                    </div>
                  </div>
                  <p className="font-semibold text-success shrink-0">{fmtMoney(a.amount)}</p>
                </motion.div>
              );
            })}

            {/* Running total row */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2">
                {balance <= 0
                  ? <CheckCircle2 className="h-4 w-4 text-success" />
                  : <AlertCircle className="h-4 w-4 text-warning-foreground" />}
                <span className="text-sm font-semibold">{balance <= 0 ? "Fully paid" : "Outstanding balance"}</span>
              </div>
              <span className={`font-bold ${balance > 0 ? "text-destructive" : "text-success"}`}>
                {balance > 0 ? fmtMoney(balance) : "Cleared"}
              </span>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-muted-foreground">
            <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No advance payments recorded yet.</p>
          </div>
        )}
      </div>

      {/* Production Timeline */}
      <div className="card-luxe p-6">
        <h3 className="font-display text-xl text-brand-dark mb-5">Production Timeline</h3>
        <div className="relative pl-8 space-y-4">
          <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border" />
          {order.timeline.map((t, idx) => {
            const isDone = t.status === "done";
            const isActive = t.status === "in_progress";
            const emp = db.users.find(u => u.id === t.employeeId);
            return (
              <motion.div key={idx} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }} className="relative">
                <div className={`absolute -left-8 top-0.5 h-6 w-6 rounded-full grid place-items-center border-2 ${isDone ? "bg-success border-success text-white" : isActive ? "bg-primary border-primary text-white animate-pulse" : "bg-white border-border text-muted-foreground"}`}>
                  {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : isActive ? <Loader2 className="h-3 w-3 animate-spin" /> : <Circle className="h-2 w-2" />}
                </div>
                <div className={`p-3 rounded-xl border ${isActive ? "border-primary bg-primary/5" : isDone ? "border-success/30 bg-success/5" : "border-border"}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className={`font-medium text-sm ${isDone || isActive ? "text-foreground" : "text-muted-foreground"}`}>{t.step}</p>
                    {t.date && <span className="text-xs text-muted-foreground">{new Date(t.date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
                  </div>
                  {(emp || t.department || t.remarks) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {emp?.name && <>By {emp.name}</>}{t.department && <> · {t.department}</>}{t.remarks && <> · {t.remarks}</>}
                    </p>
                  )}
                  {canEditStage() && !isDone && (
                    <Button size="sm" variant="outline" onClick={() => advanceStep(idx)} className="mt-2 h-7 rounded-lg text-xs">Mark complete</Button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
