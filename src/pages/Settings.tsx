import { useState } from "react";
import { loadDb, saveDb } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Diamond, Weight, Truck } from "lucide-react";

export function SettingsPage() {
  const { user } = useAuth();
  const [db, setDb] = useState(loadDb());

  const save = () => { saveDb(db); toast.success("Settings saved"); };
  const saveRates = () => { saveDb(db); toast.success("Pricing rates updated"); };

  const exp = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "starlink-backup.json";
    a.click();
  };
  const imp = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result as string);
        localStorage.setItem("starlink_db_v2", JSON.stringify(d));
        window.dispatchEvent(new Event("starlink-db-updated"));
        toast.success("Restored");
        setDb(d);
      } catch { toast.error("Invalid file"); }
    };
    r.readAsText(f);
  };
  const clear = () => {
    if (!confirm("Wipe all data and reload seed?")) return;
    localStorage.removeItem("starlink_db_v2");
    location.reload();
  };

  const canEditRates = user?.role === "admin" || user?.role === "employee";

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="font-display text-3xl text-brand-dark">Settings</h1>

      {/* Company */}
      <div className="card-luxe p-6 space-y-4">
        <h3 className="font-semibold">Company</h3>
        <div>
          <Label className="text-xs">Company Name</Label>
          <Input
            value={db.settings.companyName}
            onChange={e => setDb({ ...db, settings: { ...db.settings, companyName: e.target.value } })}
            className="rounded-xl mt-1"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Currency</Label>
            <Input
              value={db.settings.currency}
              onChange={e => setDb({ ...db, settings: { ...db.settings, currency: e.target.value } })}
              className="rounded-xl mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Language</Label>
            <Input
              value={db.settings.language}
              onChange={e => setDb({ ...db, settings: { ...db.settings, language: e.target.value } })}
              className="rounded-xl mt-1"
            />
          </div>
        </div>
        <label className="flex items-center justify-between">
          <span className="text-sm">Push notifications</span>
          <Switch
            checked={db.settings.notifications}
            onCheckedChange={v => setDb({ ...db, settings: { ...db.settings, notifications: v } })}
          />
        </label>
        <Button onClick={save} className="btn-hero rounded-xl w-full">Save Settings</Button>
      </div>

      {/* Pricing Rates — admin & employee only */}
      {canEditRates && (
        <div className="card-luxe p-6 space-y-5">
          <div>
            <h3 className="font-semibold">Order Value Pricing Rates</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Used to auto-estimate order value on new orders. Staff can override per order.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Diamond rate */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Diamond className="h-3.5 w-3.5 text-primary" />
                Diamond Rate ($ / ct)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number" min={0} step={1}
                  value={db.settings.diamondRate ?? 3500}
                  onChange={e => setDb({ ...db, settings: { ...db.settings, diamondRate: Math.max(0, Number(e.target.value)) } })}
                  className="rounded-xl pl-7"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">per carat</p>
            </div>

            {/* Metal rate */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Weight className="h-3.5 w-3.5 text-primary" />
                Metal Rate ($ / g)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number" min={0} step={1}
                  value={db.settings.metalRate ?? 65}
                  onChange={e => setDb({ ...db, settings: { ...db.settings, metalRate: Math.max(0, Number(e.target.value)) } })}
                  className="rounded-xl pl-7"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">per gram</p>
            </div>

            {/* Default shipping charge */}
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-primary" />
                Default Shipping Charge ($ flat)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number" min={0} step={1}
                  value={db.settings.defaultShippingCharge ?? 0}
                  onChange={e => setDb({ ...db, settings: { ...db.settings, defaultShippingCharge: Math.max(0, Number(e.target.value)) } })}
                  className="rounded-xl pl-7"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">pre-filled on every new order — staff can override per order</p>
            </div>
          </div>

          {/* Live preview */}
          <div className="rounded-xl bg-secondary/50 border border-border/60 px-4 py-3 text-sm text-muted-foreground">
            Example: 0.5 ct diamond + 3 g metal + shipping ={" "}
            <span className="font-semibold text-foreground">
              ${(
                (db.settings.diamondRate ?? 3500) * 0.5 +
                (db.settings.metalRate ?? 65) * 3 +
                (db.settings.defaultShippingCharge ?? 0)
              ).toLocaleString()}
            </span>
          </div>

          <Button onClick={saveRates} className="btn-hero rounded-xl w-full">Save Pricing Rates</Button>
        </div>
      )}

      {/* Data */}
      <div className="card-luxe p-6 space-y-3">
        <h3 className="font-semibold">Data</h3>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={exp} className="rounded-xl">Backup</Button>
          <label className="cursor-pointer">
            <input type="file" accept="application/json" onChange={imp} className="hidden" />
            <span className="inline-flex items-center justify-center w-full h-9 rounded-xl border text-sm hover:bg-secondary">
              Restore
            </span>
          </label>
        </div>
        <Button variant="outline" onClick={clear} className="rounded-xl w-full text-destructive">
          Clear Data & Reset Seed
        </Button>
      </div>
    </div>
  );
}
