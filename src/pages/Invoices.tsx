import { useAuth } from "@/lib/auth";
import { loadDb, fmtMoney, fmtDate } from "@/lib/db";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";

export function InvoicesPage() {
  const { user } = useAuth();
  const db = loadDb();
  let list = db.invoices;
  if (user!.role === "client") list = list.filter(i => i.clientId === user!.clientId);
  list = [...list].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <h1 className="font-display text-3xl text-brand-dark">Invoices</h1>
      <div className="card-luxe overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="text-left p-3">Invoice</th><th className="text-left p-3 hidden md:table-cell">Order</th><th className="text-left p-3 hidden sm:table-cell">Date</th><th className="text-left p-3">Amount</th><th className="text-left p-3">Status</th></tr></thead>
          <tbody>
            {list.map(inv => { const o = db.orders.find(o => o.id === inv.orderId); return (
              <tr key={inv.id} className="border-t hover:bg-secondary/50">
                <td className="p-3"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /><span className="font-medium">{inv.number}</span></div></td>
                <td className="p-3 hidden md:table-cell">{o && <Link to={`/orders/${o.id}`} className="text-primary hover:underline">{o.orderNumber}</Link>}</td>
                <td className="p-3 hidden sm:table-cell text-muted-foreground">{fmtDate(inv.createdAt)}</td>
                <td className="p-3 font-semibold">{fmtMoney(inv.amount)}</td>
                <td className="p-3">{inv.paid ? <span className="text-success text-xs font-medium">Paid</span> : <span className="text-warning text-xs font-medium">Pending</span>}</td>
              </tr>
            );})}
            {list.length === 0 && <tr><td colSpan={5} className="p-12 text-center text-muted-foreground">No invoices yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
