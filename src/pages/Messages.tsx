import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { loadDb, updateDb, uid } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

export function MessagesPage() {
  const { user } = useAuth();
  const [db, setDb] = useState(loadDb());
  useEffect(() => { const h = () => setDb(loadDb()); window.addEventListener("starlink-db-updated", h); return () => window.removeEventListener("starlink-db-updated", h); }, []);

  const contacts = user!.role === "admin"
    ? [...db.users.filter(u => u.id !== user!.id)]
    : user!.role === "client"
    ? db.users.filter(u => u.role === "admin" || u.role === "employee")
    : db.users.filter(u => u.role === "admin" || u.role === "client");

  const [selected, setSelected] = useState<string | null>(contacts[0]?.id || null);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const thread = db.messages.filter(m => (m.fromUserId === user!.id && m.toUserId === selected) || (m.fromUserId === selected && m.toUserId === user!.id)).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [thread.length]);

  const send = () => {
    if (!text.trim() || !selected) return;
    updateDb(d => { d.messages.push({ id: uid("m_"), fromUserId: user!.id, toUserId: selected, text: text.trim(), createdAt: new Date().toISOString(), read: false }); });
    setText("");
  };

  return (
    <div className="max-w-6xl mx-auto grid md:grid-cols-[280px_1fr] gap-4 h-[calc(100vh-10rem)]">
      <div className="card-luxe p-3 overflow-y-auto">
        <h2 className="font-display text-xl text-brand-dark px-2 mb-2">Messages</h2>
        {contacts.map(c => (
          <button key={c.id} onClick={() => setSelected(c.id)} className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition ${selected === c.id ? "bg-primary/10" : "hover:bg-secondary"}`}>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-brand-dark text-white text-sm grid place-items-center shrink-0">{c.name.charAt(0)}</div>
            <div className="min-w-0 text-left"><p className="text-sm font-medium truncate">{c.name}</p><p className="text-xs text-muted-foreground capitalize">{c.role}</p></div>
          </button>
        ))}
      </div>
      <div className="card-luxe flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {thread.length === 0 && <p className="text-center text-sm text-muted-foreground py-10">No messages yet - say hello.</p>}
          {thread.map(m => {
            const mine = m.fromUserId === user!.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${mine ? "bg-primary text-primary-foreground rounded-br-md" : "bg-secondary rounded-bl-md"}`}>
                  <p>{m.text}</p>
                  <p className={`text-[10px] mt-1 ${mine ? "text-white/70" : "text-muted-foreground"}`}>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
        <div className="p-3 border-t flex gap-2">
          <Input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Type a message..." className="rounded-xl h-11" />
          <Button onClick={send} className="btn-hero rounded-xl h-11 w-11 p-0"><Send className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}
