import { useState } from "react";
import { loadDb, saveDb } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export function SettingsPage() {
  const [db, setDb] = useState(loadDb());
  const save = () => { saveDb(db); toast.success("Saved"); };
  const exp = () => { const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "starlink-backup.json"; a.click(); };
  const imp = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const d = JSON.parse(r.result as string); localStorage.setItem("starlink_db_v1", JSON.stringify(d)); window.dispatchEvent(new Event("starlink-db-updated")); toast.success("Restored"); setDb(d); } catch { toast.error("Invalid file"); } }; r.readAsText(f); };
  const clear = () => { if (!confirm("Wipe all data and reload seed?")) return; localStorage.removeItem("starlink_db_v1"); location.reload(); };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="font-display text-3xl text-brand-dark">Settings</h1>
      <div className="card-luxe p-6 space-y-4">
        <h3 className="font-semibold">Company</h3>
        <div><Label className="text-xs">Company Name</Label><Input value={db.settings.companyName} onChange={e => setDb({ ...db, settings: { ...db.settings, companyName: e.target.value } })} className="rounded-xl mt-1" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Currency</Label><Input value={db.settings.currency} onChange={e => setDb({ ...db, settings: { ...db.settings, currency: e.target.value } })} className="rounded-xl mt-1" /></div>
          <div><Label className="text-xs">Language</Label><Input value={db.settings.language} onChange={e => setDb({ ...db, settings: { ...db.settings, language: e.target.value } })} className="rounded-xl mt-1" /></div>
        </div>
        <label className="flex items-center justify-between"><span className="text-sm">Push notifications</span><Switch checked={db.settings.notifications} onCheckedChange={v => setDb({ ...db, settings: { ...db.settings, notifications: v } })} /></label>
        <Button onClick={save} className="btn-hero rounded-xl w-full">Save Settings</Button>
      </div>
      <div className="card-luxe p-6 space-y-3">
        <h3 className="font-semibold">Data</h3>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={exp} className="rounded-xl">Backup</Button>
          <label className="cursor-pointer"><input type="file" accept="application/json" onChange={imp} className="hidden" /><span className="inline-flex items-center justify-center w-full h-9 rounded-xl border text-sm hover:bg-secondary">Restore</span></label>
        </div>
        <Button variant="outline" onClick={clear} className="rounded-xl w-full text-destructive">Clear Data & Reset Seed</Button>
      </div>
    </div>
  );
}
