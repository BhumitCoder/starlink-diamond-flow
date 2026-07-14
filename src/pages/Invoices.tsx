import { useAuth } from "@/lib/auth";
import { loadDb, fmtMoney, fmtDate, totalAdvance, balanceDue } from "@/lib/db";
import { Link } from "react-router-dom";
import { FileText, TrendingUp, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import { PaginationBar } from "@/components/PaginationBar";

export function InvoicesPage() {
  const { user } = useAuth();
  const db = loadDb();

  let list = db.invoices;
  if (user!.role === "client") list = list.filter(i => i.clientId === user!.clientId);
  list = [...list].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  // Orders with advances (all roles see their own)
  let ordersWithAdvance = db.orders.filter(o => (o.advances || []).length > 0);
  if (user!.role === "client") ordersWithAdvance = ordersWithAdvance.filter(o => o.clientId === user!.clientId);
  if (user!.role === "employee") ordersWithAdvance = ordersWithAdvance.filter(o => o.assignedEmployeeId === user!.id);

  const totalPaid = list.filter(i => i.paid).reduce((s, i) => s + i.amount, 0);
  const totalPending = list.filter(i => !i.paid).reduce((s, i) => s + i.amount, 0);
  const totalAdvancePaid = ordersWithAdvance.reduce((s, o) => s + totalAdvance(o), 0);

  const PAGE_SIZE = 10;
  const { paged: pagedInvoices, page: invPage, setPage: setInvPage, totalPages: invTotalPages, start: invStart, end: invEnd } = usePagination(list, PAGE_SIZE);
  const { paged: pagedLedger, page: ledPage, setPage: setLedPage, totalPages: ledTotalPages, start: ledStart, end: ledEnd } = usePagination(ordersWithAdvance, PAGE_SIZE);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <h1 className="font-display text-3xl text-brand-dark">Invoices</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Invoices", value: list.length, icon: FileText, color: "text-primary", bg: "bg-primary/10" },
          { label: "Paid", value: fmtMoney(totalPaid), icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
          { label: "Pending", value: fmtMoney(totalPending), icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10" },
          { label: "Advances Collected", value: fmtMoney(totalAdvancePaid), icon: TrendingUp, color: "text-brand-dark", bg: "bg-brand-light/10" },
        ].map(s => (
          <div key={s.label} className="card-luxe p-4">
            <div className={`h-8 w-8 rounded-lg ${s.bg} grid place-items-center mb-3`}>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <p className="text-lg font-display font-bold text-brand-dark">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Invoices table */}
      <div className="card-luxe overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between gap-2 flex-wrap">
          <h2 className="font-semibold text-brand-dark">All Invoices</h2>
          {list.length > 0 && <p className="text-xs text-muted-foreground">Showing {invStart + 1}–{invEnd} of {list.length}</p>}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-5 py-3">Invoice</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Order</th>
              <th className="text-left px-4 py-3 hidden sm:table-cell">Date</th>
              <th className="text-right px-4 py-3">Amount</th>
              <th className="text-right px-4 py-3 hidden md:table-cell">Advance</th>
              <th className="text-right px-4 py-3 hidden md:table-cell">Balance</th>
              <th className="text-left px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {pagedInvoices.map(inv => {
              const o = db.orders.find(o => o.id === inv.orderId);
              const adv = o ? totalAdvance(o) : 0;
              const bal = o ? balanceDue(o) : inv.amount;
              return (
                <tr key={inv.id} className="border-t border-border/40 hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-medium">{inv.number}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    {o && <Link to={`/orders/${o.id}`} className="text-primary hover:underline font-mono text-xs">{o.orderNumber}</Link>}
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell text-muted-foreground text-xs">{fmtDate(inv.createdAt)}</td>
                  <td className="px-4 py-3.5 text-right font-semibold">{fmtMoney(inv.amount)}</td>
                  <td className="px-4 py-3.5 text-right hidden md:table-cell">
                    {adv > 0
                      ? <span className="text-success font-medium text-xs">{fmtMoney(adv)}</span>
                      : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-right hidden md:table-cell">
                    <span className={`text-xs font-medium ${bal > 0 ? "text-destructive" : "text-success"}`}>
                      {bal > 0 ? fmtMoney(bal) : "Cleared"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {inv.paid
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium text-success"><CheckCircle2 className="h-3 w-3" />Paid</span>
                      : <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-foreground"><Clock className="h-3 w-3" />Pending</span>}
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">No invoices yet.</td></tr>
            )}
          </tbody>
        </table>
        {invTotalPages > 1 && (
          <div className="px-5 border-t border-border/60">
            <PaginationBar
              page={invPage}
              totalPages={invTotalPages}
              onPageChange={setInvPage}
              label={`${invStart + 1}–${invEnd} of ${list.length} invoices`}
            />
          </div>
        )}
      </div>

      {/* Advance Payments section */}
      {ordersWithAdvance.length > 0 && (
        <div className="card-luxe overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h2 className="font-semibold text-brand-dark">Advance Payment Ledger</h2>
              <p className="text-xs text-muted-foreground mt-0.5">All recorded advance payments per order</p>
            </div>
            {ordersWithAdvance.length > 0 && <p className="text-xs text-muted-foreground">Showing {ledStart + 1}–{ledEnd} of {ordersWithAdvance.length}</p>}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-3">Order</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Client</th>
                <th className="text-right px-4 py-3">Order Total</th>
                <th className="text-right px-4 py-3">Advance Paid</th>
                <th className="text-right px-4 py-3">Balance Due</th>
              </tr>
            </thead>
            <tbody>
              {pagedLedger.map(o => {
                const client = db.clients.find(c => c.id === o.clientId);
                const adv = totalAdvance(o);
                const bal = balanceDue(o);
                return (
                  <tr key={o.id} className="border-t border-border/40 hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link to={`/orders/${o.id}`} className="text-primary hover:underline font-mono text-xs font-semibold">{o.orderNumber}</Link>
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell text-muted-foreground text-xs">{client?.companyName || "—"}</td>
                    <td className="px-4 py-3.5 text-right font-semibold">{fmtMoney(o.amount)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-success font-semibold">{fmtMoney(adv)}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`font-semibold ${bal > 0 ? "text-destructive" : "text-success"}`}>
                        {bal > 0 ? fmtMoney(bal) : "✓ Cleared"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {ledTotalPages > 1 && (
            <div className="px-5 border-t border-border/60">
              <PaginationBar
                page={ledPage}
                totalPages={ledTotalPages}
                onPageChange={setLedPage}
                label={`${ledStart + 1}–${ledEnd} of ${ordersWithAdvance.length} entries`}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
