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

export interface AdvancePayment {
  id: string;
  amount: number;
  note: string;
  recordedBy: string; // userId
  createdAt: string;
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
  images: string[];          // up to 3 reference images (base64)
  instructions: string;
  expectedDelivery: string;
  priority: "Normal" | "Urgent" | "High Priority";
  status: "Waiting" | "Approved" | "Rejected" | "In Production" | "Ready" | "Dispatched" | "Delivered";
  assignedEmployeeId?: string;
  estimatedDelivery?: string;
  amount: number;
  shippingCharge: number;
  advances: AdvancePayment[];
  timeline: TimelineEntry[];
  createdAt: string;
  // Product specifications
  designNumber?: string;
  productSize?: string;
  productColor?: string;   // "Yellow" | "Rose" | "White"
  productKarats?: string;  // "14K" | "18K" | "22K" | "24K"
  // Delivery preference
  deliveryTime?: string;
  // Finishing options
  rhodium?: string;   // "No Rhodium" | "Diamond Part White" | "Full White" | "Other"
  stamping?: string;  // "No Stamping" | "KT Stamping" | "Diamond Weight + KT Stamp" | "Other"
  // CAD design image (uploaded after CAD Approved step)
  cadImage?: string;
  // Dispatch info
  courierName?: string;
  trackingNumber?: string;
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
  diamondRate: number;           // $ per carat
  metalRate: number;             // $ per gram
  defaultShippingCharge: number; // $ flat default per order
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

const KEY = "starlink_db_v2";

function emptyDb(): DB {
  return { users: [], clients: [], orders: [], messages: [], notifications: [], invoices: [], settings: { companyName: "Starlink Jewels", currency: "USD", language: "English", notifications: true, diamondRate: 3500, metalRate: 65, defaultShippingCharge: 0 }, session: { userId: null } };
}

export function loadDb(): DB {
  if (typeof window === "undefined") return emptyDb();
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    const seeded = seedDb();
    localStorage.setItem(KEY, JSON.stringify(seeded));
    return seeded;
  }
  try {
    const db = JSON.parse(raw) as DB;
    // backward-compat: fill missing fields on orders
    db.orders = db.orders.map(o => ({ shippingCharge: 0, advances: [], ...o }));
    // backward-compat: fill missing settings fields
    if (db.settings.diamondRate == null) db.settings.diamondRate = 3500;
    if (db.settings.metalRate == null) db.settings.metalRate = 65;
    if (db.settings.defaultShippingCharge == null) db.settings.defaultShippingCharge = 0;
    return db;
  } catch { return emptyDb(); }
}

export function totalAdvance(order: Order): number {
  return (order.advances || []).reduce((s, a) => s + a.amount, 0);
}

/** Jewellery value + shipping — the amount the client owes in full */
export function orderTotal(order: Order): number {
  return order.amount + (order.shippingCharge || 0);
}

export function balanceDue(order: Order): number {
  return Math.max(0, orderTotal(order) - totalAdvance(order));
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

function seedDb(): DB {
  const db = emptyDb();

  // Only the admin account — all other data is entered by the user
  db.users.push({
    id: "u_admin", username: "admin", password: "admin123", role: "admin",
    name: "Rajesh Mehta", email: "admin@starlinkjewels.com", phone: "+91 98765 43210",
    status: "active", createdAt: new Date().toISOString(),
  });

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