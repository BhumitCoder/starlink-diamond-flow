import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { loadDb, updateDb } from "@/lib/db";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotificationsPage() {
  const { user } = useAuth();
  const [db, setDb] = useState(loadDb());
  useEffect(() => { const h = () => setDb(loadDb()); window.addEventListener("starlink-db-updated", h); return () => window.removeEventListener("starlink-db-updated", h); }, []);
  const list = db.notifications.filter(n => n.userId === user!.id).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  const markAll = () => updateDb(d => d.notifications.forEach(n => { if (n.userId === user!.id) n.read = true; }));

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="font-display text-3xl text-brand-dark">Notifications</h1><p className="text-sm text-muted-foreground">{list.filter(n => !n.read).length} unread</p></div>
        <Button variant="outline" onClick={markAll} className="rounded-xl">Mark all read</Button>
      </div>
      <div className="space-y-2">
        {list.length === 0 && <div className="card-luxe p-12 text-center text-muted-foreground">No notifications.</div>}
        {list.map(n => (
          <div key={n.id} className={`card-luxe p-4 flex items-start gap-3 ${!n.read ? "border-l-4 border-l-primary" : ""}`}>
            <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center shrink-0"><Bell className="h-5 w-5 text-primary" /></div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{n.title}</p>
              <p className="text-sm text-muted-foreground">{n.body}</p>
              <p className="text-xs text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
