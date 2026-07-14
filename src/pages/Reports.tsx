import { loadDb, fmtMoney } from "@/lib/db";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function ReportsPage() {
  const db = loadDb();
  const byDept = ["Sales","CAD","Design","Production","Diamond Setting","Polishing","QC","Packing","Dispatch","Accounts"].map(d => ({ name: d, orders: db.orders.filter(o => o.timeline.some(t => t.department === d && t.status === "done")).length }));
  const revenue = db.orders.filter(o => o.status === "Delivered").reduce((s, o) => s + o.amount, 0);

  const pdf = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text("Starlink Jewels - Business Report", 20, 25);
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text(`Generated ${new Date().toLocaleDateString()}`, 20, 32);
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("Summary", 20, 50);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    let y = 60;
    [["Total Orders", String(db.orders.length)], ["Delivered", String(db.orders.filter(o => o.status === "Delivered").length)], ["Active Clients", String(db.clients.length)], ["Employees", String(db.users.filter(u => u.role === "employee").length)], ["Total Revenue", fmtMoney(revenue)]].forEach(([k, v]) => { doc.text(`${k}:`, 25, y); doc.text(v, 100, y); y += 8; });
    doc.save("Starlink-Report.pdf");
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between"><h1 className="font-display text-3xl text-brand-dark">Reports</h1><Button onClick={pdf} className="btn-hero rounded-xl"><Download className="h-4 w-4 mr-2" />Download PDF</Button></div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card-luxe p-5"><h3 className="font-semibold mb-3">Orders by Department</h3>
          <ResponsiveContainer width="100%" height={280}><BarChart data={byDept}><XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} /><YAxis /><Tooltip /><Bar dataKey="orders" fill="oklch(0.475 0.13 264)" radius={[8,8,0,0]} /></BarChart></ResponsiveContainer>
        </div>
        <div className="card-luxe p-5"><h3 className="font-semibold mb-3">Revenue Overview</h3>
          <p className="font-display text-4xl text-brand-dark">{fmtMoney(revenue)}</p>
          <p className="text-sm text-muted-foreground mt-1">Delivered order value - all time</p>
          <div className="grid grid-cols-2 gap-3 mt-6">
            {[["Delivered", db.orders.filter(o => o.status === "Delivered").length], ["In Production", db.orders.filter(o => o.status === "In Production").length], ["Ready", db.orders.filter(o => o.status === "Ready").length], ["Waiting", db.orders.filter(o => o.status === "Waiting").length]].map(([k, v]) => <div key={String(k)} className="p-3 rounded-xl bg-secondary"><p className="text-xs text-muted-foreground">{k}</p><p className="font-display text-2xl text-brand-dark">{v}</p></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
