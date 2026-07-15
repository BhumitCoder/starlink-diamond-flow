import { useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { loadDb, updateDb, fmtMoney, fmtDate, totalAdvance, orderTotal, balanceDue, uid } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, CheckCircle2, Circle, Loader2, Package, Download,
  DollarSign, Plus, TrendingUp, AlertCircle, Wallet,
  ImagePlus, Truck, ExternalLink, Eye,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import jsPDF from "jspdf";

/** Compress a File to a base64 JPEG ≤800px */
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = e => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const MAX = 900;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else       { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function OrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();

  // Advance form state
  const [showAdvForm, setShowAdvForm] = useState(false);
  const [advAmt, setAdvAmt] = useState("");
  const [advNote, setAdvNote] = useState("");

  // CAD image
  const cadRef = useRef<HTMLInputElement>(null);
  const [cadUploading, setCadUploading] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Dispatch form
  const [showDispatch, setShowDispatch] = useState(false);
  const [courierName, setCourierName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");

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
      const clientUser = d.users.find(u => u.clientId === o.clientId);
      if (clientUser) d.notifications.unshift({ id: uid("n_"), userId: clientUser.id, title: "Advance Recorded", body: `${fmtMoney(amt)} advance received for ${o.orderNumber}`, type: "info", read: false, createdAt: new Date().toISOString() });
    });
    toast.success("Advance payment recorded");
    setAdvAmt(""); setAdvNote(""); setShowAdvForm(false);
  };

  const saveCadImage = async (file: File) => {
    setCadUploading(true);
    try {
      const compressed = await compressImage(file);
      updateDb(d => {
        const o = d.orders.find(x => x.id === order.id)!;
        o.cadImage = compressed;
        const clientUser = d.users.find(u => u.clientId === o.clientId);
        if (clientUser) d.notifications.unshift({ id: uid("n_"), userId: clientUser.id, title: "CAD Design Ready", body: `CAD design uploaded for ${o.orderNumber}. Please review.`, type: "info", read: false, createdAt: new Date().toISOString() });
      });
      toast.success("CAD image uploaded — client notified");
    } catch { toast.error("Failed to upload image"); }
    setCadUploading(false);
  };

  const saveDispatch = () => {
    if (!courierName.trim() || !trackingNumber.trim()) {
      toast.error("Enter both courier name and tracking number");
      return;
    }
    updateDb(d => {
      const o = d.orders.find(x => x.id === order.id)!;
      o.courierName = courierName.trim();
      o.trackingNumber = trackingNumber.trim();
      const clientUser = d.users.find(u => u.clientId === o.clientId);
      if (clientUser) d.notifications.unshift({ id: uid("n_"), userId: clientUser.id, title: "Order Dispatched", body: `${o.orderNumber} dispatched via ${courierName.trim()} · Tracking: ${trackingNumber.trim()}`, type: "info", read: false, createdAt: new Date().toISOString() });
    });
    toast.success("Dispatch info saved — client notified");
    setShowDispatch(false);
  };

  // Conditions for CAD and Dispatch sections
  const cadStepIdx   = order.timeline.findIndex(t => t.step === "CAD Designing");
  const dispStepIdx  = order.timeline.findIndex(t => t.step === "Dispatch");
  const showCadSection  = cadStepIdx >= 0 && order.timeline[cadStepIdx].status !== "pending";
  const showDispSection = !!order.courierName || (
    canEditStage() && dispStepIdx >= 0 && order.timeline[dispStepIdx].status !== "pending"
  );

  const downloadInvoice = () => {
    const adv      = totalAdvance(order);
    const total    = orderTotal(order);
    const bal      = balanceDue(order);
    const shipping = order.shippingCharge || 0;

    const doc = new jsPDF();
    // Header
    doc.setFont("helvetica", "bold"); doc.setFontSize(22);
    doc.text("STARLINK JEWELS", 20, 25);
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text("Fine Diamond Jewelry - Manufactured in India - Exported to USA", 20, 32);
    doc.setLineWidth(0.5); doc.line(20, 38, 190, 38);

    // Invoice meta
    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text("INVOICE", 20, 50);
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(`Order #: ${order.orderNumber}`, 20, 60);
    doc.text(`Date: ${fmtDate(order.createdAt)}`, 20, 66);
    doc.text(`Bill To: ${client?.companyName || ""}`, 20, 76);
    doc.text(`${client?.address || ""}`, 20, 82);
    doc.text(`${client?.email || ""}  ${client?.phone || ""}`, 20, 88);

    // Line items header
    doc.line(20, 100, 190, 100);
    doc.setFont("helvetica", "bold");
    doc.text("Item", 20, 108); doc.text("Qty", 130, 108); doc.text("Amount", 165, 108);
    doc.line(20, 112, 190, 112);

    // Jewellery line
    doc.setFont("helvetica", "normal");
    doc.text(`${order.jewelleryType} - ${order.metal} - ${order.diamondType}`, 20, 121);
    doc.text(String(order.quantity), 130, 121);
    doc.text(fmtMoney(order.amount), 165, 121);

    // Shipping line (only if > 0)
    let lineY = 121;
    if (shipping > 0) {
      lineY += 10;
      doc.text("Shipping & Freight", 20, lineY);
      doc.text("—", 130, lineY);
      doc.text(fmtMoney(shipping), 165, lineY);
    }

    // Totals
    doc.line(20, lineY + 6, 190, lineY + 6);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text("Order Total:", 120, lineY + 16);
    doc.text(fmtMoney(total), 165, lineY + 16);

    if (adv > 0) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      doc.text("Advance Paid:", 120, lineY + 26);
      doc.text(`- ${fmtMoney(adv)}`, 165, lineY + 26);
      doc.setFont("helvetica", "bold"); doc.setFontSize(12);
      doc.text("Balance Due:", 120, lineY + 38);
      doc.text(fmtMoney(bal), 165, lineY + 38);
    }

    doc.setFontSize(9); doc.setFont("helvetica", "italic");
    doc.text("Thank you for choosing Starlink Jewels.", 20, 260);
    doc.save(`Invoice-${order.orderNumber}.pdf`);
  };

  return (
    <>
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
          {([
            ["Quantity", `${order.quantity} pcs`],
            ["Diamond", `${order.diamondWeight} ct (${order.diamondType})`],
            ["Priority", order.priority],
            ["Order Value", fmtMoney(order.amount)],
            ["Shipping", (order.shippingCharge || 0) > 0 ? fmtMoney(order.shippingCharge) : "—"],
            ["Delivery Date", fmtDate(order.expectedDelivery)],
            ["Assigned to", employee?.name || "—"],
            ["Created", fmtDate(order.createdAt)],
            ...(order.designNumber  ? [["Design Number",  order.designNumber]]  : []),
            ...(order.productColor  ? [["Color",          order.productColor]]  : []),
            ...(order.productKarats ? [["Karats",         order.productKarats]] : []),
            ...(order.productSize   ? [["Product Size",   order.productSize]]   : []),
            ...(order.deliveryTime  ? [["Delivery Time",  order.deliveryTime]]  : []),
            ...(order.rhodium       ? [["Rhodium",        order.rhodium]]       : []),
            ...(order.stamping      ? [["Stamping",       order.stamping]]      : []),
          ] as [string, string][]).map(([k, v]) => (
            <div key={k}><p className="text-xs text-muted-foreground">{k}</p><p className="font-medium mt-0.5">{v}</p></div>
          ))}
        </div>

        {/* Reference images */}
        {order.images && order.images.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-2">Reference Images</p>
            <div className="flex gap-2 flex-wrap">
              {order.images.map((src, i) => (
                <button key={i} type="button" onClick={() => setLightboxSrc(src)}
                  className="h-20 w-20 rounded-xl overflow-hidden border border-border hover:border-primary/50 transition-colors group relative">
                  <img src={src} alt={`Ref ${i + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Eye className="h-4 w-4 text-white" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

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

      {/* ── CAD Design Card ── */}
      {showCadSection && (
        <div className="card-luxe p-6 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
                <ImagePlus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-display text-lg text-brand-dark">CAD Design</h3>
                <p className="text-xs text-muted-foreground">
                  {order.cadImage ? "CAD image on file — visible to client" : "No CAD image uploaded yet"}
                </p>
              </div>
            </div>
            {canEditStage() && (
              <div>
                <input
                  ref={cadRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (file) await saveCadImage(file);
                    e.target.value = "";
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => cadRef.current?.click()}
                  disabled={cadUploading}
                  className="rounded-xl gap-2"
                >
                  <ImagePlus className="h-4 w-4" />
                  {cadUploading ? "Uploading…" : order.cadImage ? "Replace CAD" : "Upload CAD Image"}
                </Button>
              </div>
            )}
          </div>

          {order.cadImage && (
            <div className="relative group w-fit">
              <img
                src={order.cadImage}
                alt="CAD Design"
                className="max-h-72 rounded-xl border border-border object-contain cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setLightboxSrc(order.cadImage!)}
              />
              <button
                type="button"
                onClick={() => setLightboxSrc(order.cadImage!)}
                className="absolute top-2 right-2 h-7 w-7 rounded-lg bg-black/50 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Dispatch Information Card ── */}
      {showDispSection && (
        <div className="card-luxe p-6 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 grid place-items-center">
                <Truck className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-display text-lg text-brand-dark">Dispatch Details</h3>
                <p className="text-xs text-muted-foreground">Courier and tracking information</p>
              </div>
            </div>
            {canEditStage() && (
              <Button size="sm" variant="outline" onClick={() => {
                setCourierName(order.courierName ?? "");
                setTrackingNumber(order.trackingNumber ?? "");
                setShowDispatch(v => !v);
              }} className="rounded-xl gap-2">
                <Truck className="h-4 w-4" />
                {order.courierName ? "Update Info" : "Add Dispatch Info"}
              </Button>
            )}
          </div>

          {/* Saved dispatch info */}
          {order.courierName && !showDispatch && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-secondary">
                <p className="text-xs text-muted-foreground mb-1">Courier Company</p>
                <p className="font-semibold">{order.courierName}</p>
              </div>
              <div className="p-4 rounded-xl bg-secondary">
                <p className="text-xs text-muted-foreground mb-1">Tracking Number</p>
                <p className="font-semibold font-mono">{order.trackingNumber}</p>
              </div>
            </div>
          )}

          {/* Edit form */}
          <AnimatePresence>
            {showDispatch && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-2 border-t border-border/60 space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Courier Company Name</Label>
                      <Input
                        value={courierName}
                        onChange={e => setCourierName(e.target.value)}
                        className="rounded-xl h-10"
                        placeholder="e.g. FedEx, DHL, UPS"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tracking Number</Label>
                      <Input
                        value={trackingNumber}
                        onChange={e => setTrackingNumber(e.target.value)}
                        className="rounded-xl h-10 font-mono"
                        placeholder="e.g. 1Z999AA10123456784"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveDispatch} className="btn-hero rounded-xl">Save & Notify Client</Button>
                    <Button size="sm" variant="outline" onClick={() => setShowDispatch(false)} className="rounded-xl">Cancel</Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

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
        {(() => {
          const shipping = order.shippingCharge || 0;
          const total = orderTotal(order);
          return (
            <div className={`grid gap-3 ${shipping > 0 ? "grid-cols-4" : "grid-cols-3"}`}>
              <div className="p-3 rounded-xl bg-secondary text-center">
                <p className="text-xs text-muted-foreground mb-1">Order Value</p>
                <p className="font-semibold text-sm">{fmtMoney(order.amount)}</p>
              </div>
              {shipping > 0 && (
                <div className="p-3 rounded-xl bg-secondary text-center">
                  <p className="text-xs text-muted-foreground mb-1">Shipping</p>
                  <p className="font-semibold text-sm">{fmtMoney(shipping)}</p>
                </div>
              )}
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
              {shipping > 0 && (
                <div className="col-span-4 px-1 pt-0.5 text-xs text-muted-foreground">
                  Order Total (value + shipping): <span className="font-semibold text-foreground">{fmtMoney(total)}</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Progress bar */}
        {orderTotal(order) > 0 && (
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Payment progress</span>
              <span>{Math.min(100, Math.round(advTotal / orderTotal(order) * 100))}%</span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-success to-emerald-400 transition-all"
                style={{ width: `${Math.min(100, (advTotal / orderTotal(order)) * 100)}%` }}
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

    {/* ── Image Lightbox ── */}
    <AnimatePresence>
      {lightboxSrc && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <motion.img
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            src={lightboxSrc}
            alt="Preview"
            className="max-w-full max-h-[90vh] rounded-2xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 h-9 w-9 rounded-full bg-white/20 hover:bg-white/30 text-white grid place-items-center transition-colors"
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
