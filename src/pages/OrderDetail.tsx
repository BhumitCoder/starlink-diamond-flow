import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { loadDb, updateDb, fmtMoney, fmtDate } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Circle, Loader2, Package, Download } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import jsPDF from "jspdf";

export function OrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const db = loadDb();
  const order = db.orders.find(o => o.id === id);
  if (!order) return <div className="text-center py-20">Order not found. <Link to="/orders" className="text-primary underline">Back</Link></div>;
  const client = db.clients.find(c => c.id === order.clientId);
  const employee = db.users.find(u => u.id === order.assignedEmployeeId);

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

  const downloadInvoice = () => {
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
    doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("Total:", 130, 138); doc.text(fmtMoney(order.amount), 165, 138);
    doc.setFontSize(9); doc.setFont("helvetica", "italic");
    doc.text("Thank you for choosing Starlink Jewels.", 20, 260);
    doc.save(`Invoice-${order.orderNumber}.pdf`);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <button onClick={() => nav(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back</button>

      <div className="card-luxe p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/15 to-brand-light/15 grid place-items-center"><Package className="h-7 w-7 text-primary" /></div>
            <div>
              <p className="text-xs text-muted-foreground">{order.orderNumber}</p>
              <h1 className="font-display text-2xl md:text-3xl text-brand-dark">{order.jewelleryType} in {order.metal}</h1>
              <p className="text-sm text-muted-foreground mt-1">{client?.companyName} · {order.contactPerson}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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

        {order.instructions && <div className="mt-4 p-3 rounded-xl bg-secondary text-sm"><p className="text-xs text-muted-foreground mb-1">Special Instructions</p>{order.instructions}</div>}

        {user!.role === "admin" && order.status === "Waiting" && (
          <div className="mt-5 flex gap-3">
            <Button onClick={() => approve(true)} className="btn-hero rounded-xl">Approve Order</Button>
            <Button variant="outline" onClick={() => approve(false)} className="rounded-xl">Reject</Button>
          </div>
        )}
      </div>

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
