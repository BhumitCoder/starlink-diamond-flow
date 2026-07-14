// LocalStorage-backed fake database for Starlink Jewels
export type Role = "admin" | "employee" | "client";

export interface User {
  id: string;
  username: string;
  password: string;
  role: Role;
  name: string;
  email: string;
  phone?: string;
  photo?: string;
  status: "active" | "inactive";
  department?: string;
  clientId?: string;
  createdAt: string;
}

export interface Client {
  id: string;
  companyName: string;
  ownerName: string;
  email: string;
  phone: string;
  country: string;
  gstVat: string;
  address: string;
  username: string;
  password: string;
  status: "active" | "inactive";
  accountManagerId?: string;
  createdAt: string;
}

export const TIMELINE_STEPS = [
  "Order Submitted","Order Approved","CAD Designing","CAD Approved","Wax Model",
  "Casting","Stone Selection","Diamond Setting","Polishing","Quality Check",
  "Hallmark","Final Approval","Packing","Dispatch","Delivered",
] as const;
export type TimelineStep = (typeof TIMELINE_STEPS)[number];

export interface TimelineEntry {
  step: TimelineStep;
  status: "pending" | "in_progress" | "done";
  date?: string;
  employeeId?: string;
  department?: string;
  remarks?: string;
  photo?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  clientId: string;
  contactPerson: string;
  jewelleryType: "Ring" | "Pendant" | "Necklace" | "Bracelet" | "Earrings" | "Custom";
  metal: "Gold" | "White Gold" | "Rose Gold" | "Platinum" | "Silver";
  diamondType: "Natural" | "Lab Grown";
  quantity: number;
  diamondWeight: number;
  metalWeight: number;
  images: string[];
  instructions: string;
  expectedDelivery: string;
  priority: "Normal" | "Urgent" | "High Priority";
  status: "Waiting" | "Approved" | "Rejected" | "In Production" | "Ready" | "Dispatched" | "Delivered";
  assignedEmployeeId?: string;
  estimatedDelivery?: string;
  amount: number;
  timeline: TimelineEntry[];
  createdAt: string;
}

export interface Message {
  id: string;
  orderId?: string;
  fromUserId: string;
  toUserId: string;
  text: string;
  createdAt: string;
  read: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt: string;
}

export interface Invoice {
  id: string;
  orderId: string;
  clientId: string;
  number: string;
  amount: number;
  paid: boolean;
  createdAt: string;
}

export interface Settings {
  companyName: string;
  currency: string;
  language: string;
  notifications: boolean;
}

export interface DB {
  users: User[];
  clients: Client[];
  orders: Order[];
  messages: Message[];
  notifications: Notification[];
  invoices: Invoice[];
  settings: Settings;
  session: { userId: string | null };
}

const KEY = "starlink_db_v1";

function emptyDb(): DB {
  return { users: [], clients: [], orders: [], messages: [], notifications: [], invoices: [], settings: { companyName: "Starlink Jewels", currency: "USD", language: "English", notifications: true }, session: { userId: null } };
}

export function loadDb(): DB {
  if (typeof window === "undefined") return emptyDb();
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    const seeded = seedDb();
    localStorage.setItem(KEY, JSON.stringify(seeded));
    return seeded;
  }
  try { return JSON.parse(raw) as DB; } catch { return emptyDb(); }
}

export function saveDb(db: DB) {
  localStorage.setItem(KEY, JSON.stringify(db));
  window.dispatchEvent(new Event("starlink-db-updated"));
}

export function updateDb(fn: (db: DB) => void) {
  const db = loadDb();
  fn(db);
  saveDb(db);
  return db;
}

export function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function pick<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

const DEPTS = ["Sales","CAD","Design","Production","Diamond Setting","Polishing","QC","Packing","Dispatch","Accounts"] as const;
const COUNTRIES = ["USA","USA","USA","USA","Canada","UK"];
const COMPANY_SUFFIX = ["Diamonds","Jewels","Fine Jewelry","& Co.","Luxury","Boutique","Collection"];
const FIRST = ["James","Michael","Robert","David","Sarah","Jennifer","Emily","Christopher","Ashley","Matthew","Amanda","Daniel","Olivia","Noah","Emma","William","Sophia","Liam","Mia","Ethan"];
const LAST = ["Smith","Johnson","Williams","Brown","Jones","Miller","Davis","Garcia","Rodriguez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin","Lee","Perez","White","Harris"];
const CITIES = ["New York","Los Angeles","Chicago","Houston","Miami","Dallas","Boston","Seattle","Atlanta","San Francisco"];

function seedDb(): DB {
  const db = emptyDb();
  const now = Date.now();

  db.users.push({
    id: "u_admin", username: "admin", password: "admin123", role: "admin",
    name: "Rajesh Mehta", email: "admin@starlinkjewels.com", phone: "+91 98765 43210",
    status: "active", createdAt: new Date().toISOString(),
  });

  // 30 employees
  for (let i = 0; i < 30; i++) {
    const first = pick(FIRST), last = pick(LAST);
    const uname = (first + last).toLowerCase() + rand(10,99);
    db.users.push({
      id: uid("u_"), username: uname, password: "emp123", role: "employee",
      name: `${first} ${last}`, email: `${uname}@starlinkjewels.com`,
      phone: `+91 9${rand(100000000,999999999)}`, status: Math.random() > 0.1 ? "active" : "inactive",
      department: pick(DEPTS), createdAt: new Date(now - rand(1,300) * 86400000).toISOString(),
    });
  }

  // 15 clients
  for (let i = 0; i < 15; i++) {
    const first = pick(FIRST), last = pick(LAST);
    const company = `${last} ${pick(COMPANY_SUFFIX)}`;
    const uname = (last).toLowerCase() + rand(10,99);
    const clientId = uid("c_");
    const client: Client = {
      id: clientId, companyName: company, ownerName: `${first} ${last}`,
      email: `${uname}@${last.toLowerCase()}.com`, phone: `+1 ${rand(200,999)}-${rand(200,999)}-${rand(1000,9999)}`,
      country: pick(COUNTRIES), gstVat: `GST${rand(100000,999999)}`,
      address: `${rand(100,999)} ${pick(LAST)} St, ${pick(CITIES)}`,
      username: uname, password: "client123", status: "active",
      createdAt: new Date(now - rand(30,600) * 86400000).toISOString(),
    };
    db.clients.push(client);
    db.users.push({
      id: uid("u_"), username: uname, password: "client123", role: "client",
      name: `${first} ${last}`, email: client.email, phone: client.phone,
      status: "active", clientId, createdAt: client.createdAt,
    });
  }

  // 100 orders
  const jTypes = ["Ring","Pendant","Necklace","Bracelet","Earrings","Custom"] as const;
  const metals = ["Gold","White Gold","Rose Gold","Platinum","Silver"] as const;
  const statuses: Order["status"][] = ["Waiting","Approved","In Production","In Production","In Production","Ready","Dispatched","Delivered","Delivered"];
  for (let i = 0; i < 100; i++) {
    const client = pick(db.clients);
    const employees = db.users.filter(u => u.role === "employee" && u.status === "active");
    const emp = pick(employees);
    const status = pick(statuses);
    const createdAt = new Date(now - rand(0, 120) * 86400000);
    const stepIdx = status === "Waiting" ? 0
      : status === "Approved" ? 1
      : status === "In Production" ? rand(2, 9)
      : status === "Ready" ? 11
      : status === "Dispatched" ? 13 : 14;
    const timeline: TimelineEntry[] = TIMELINE_STEPS.map((step, idx) => ({
      step, status: idx < stepIdx ? "done" : idx === stepIdx ? "in_progress" : "pending",
      date: idx <= stepIdx ? new Date(createdAt.getTime() + idx * 86400000 * 2).toISOString() : undefined,
      employeeId: idx <= stepIdx ? emp.id : undefined,
      department: idx <= stepIdx ? emp.department : undefined,
      remarks: idx <= stepIdx ? "Stage completed as per schedule." : undefined,
    }));
    const amount = rand(1200, 25000);
    const orderId = uid("o_");
    db.orders.push({
      id: orderId, orderNumber: `SLJ-${2025}-${String(1000 + i).padStart(4, "0")}`,
      clientId: client.id, contactPerson: client.ownerName,
      jewelleryType: pick(jTypes), metal: pick(metals),
      diamondType: Math.random() > 0.5 ? "Natural" : "Lab Grown",
      quantity: rand(1, 10), diamondWeight: +(Math.random() * 3 + 0.2).toFixed(2),
      metalWeight: +(Math.random() * 10 + 2).toFixed(2), images: [],
      instructions: "Handle with care. Match reference photos.",
      expectedDelivery: new Date(createdAt.getTime() + 45 * 86400000).toISOString(),
      priority: pick(["Normal","Normal","Urgent","High Priority"] as const),
      status, assignedEmployeeId: emp.id, estimatedDelivery: new Date(createdAt.getTime() + 40 * 86400000).toISOString(),
      amount, timeline, createdAt: createdAt.toISOString(),
    });
    if (status === "Delivered" || status === "Dispatched" || status === "Ready") {
      db.invoices.push({
        id: uid("inv_"), orderId, clientId: client.id,
        number: `INV-${2025}-${String(2000 + i).padStart(4, "0")}`,
        amount, paid: Math.random() > 0.3, createdAt: new Date(createdAt.getTime() + 30 * 86400000).toISOString(),
      });
    }
  }

  // Notifications for admin
  for (let i = 0; i < 8; i++) {
    db.notifications.push({
      id: uid("n_"), userId: "u_admin",
      title: pick(["New Order Placed","Timeline Updated","Message Received","Dispatch Started","Invoice Uploaded"]),
      body: "Order " + pick(db.orders).orderNumber + " has activity.",
      type: "info", read: i > 3, createdAt: new Date(now - i * 3600000).toISOString(),
    });
  }

  return db;
}

// helpers
export function currentUserOrders(db: DB, user: User): Order[] {
  if (user.role === "admin") return db.orders;
  if (user.role === "client") return db.orders.filter(o => o.clientId === user.clientId);
  return db.orders.filter(o => o.assignedEmployeeId === user.id);
}

export function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}