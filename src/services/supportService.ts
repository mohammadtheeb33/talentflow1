import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { getClientFirestore, ensureUid, getClientAuth } from "@/lib/firebase";

export type TicketStatus = "open" | "in_progress" | "closed";
export type TicketPriority = "low" | "medium" | "high";
export type SenderRole = "user" | "admin";

export type Ticket = {
  id: string;
  userId: string;
  userEmail: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: any;
  lastMessageAt: any;
};

export type TicketMessage = {
  id: string;
  text: string;
  senderId: string;
  senderRole: SenderRole;
  createdAt: any;
};

export async function createTicket(subject: string, initialMessage: string, priority: TicketPriority = "medium"): Promise<string> {
  const db = getClientFirestore();
  const uid = await ensureUid();
  const auth = getClientAuth();
  const userEmail = String(auth.currentUser?.email || "");
  const ticketRef = doc(collection(db, "tickets"));
  await setDoc(ticketRef, {
    userId: uid,
    userEmail,
    subject,
    status: "open",
    priority,
    createdAt: serverTimestamp(),
    lastMessageAt: serverTimestamp()
  });
  const msgRef = collection(db, "tickets", ticketRef.id, "messages");
  await addDoc(msgRef, {
    text: initialMessage,
    senderId: uid,
    senderRole: "user",
    createdAt: serverTimestamp()
  });
  await updateDoc(ticketRef, { lastMessageAt: serverTimestamp() });
  return ticketRef.id;
}

export async function sendMessage(ticketId: string, text: string, senderRole: SenderRole = "user") {
  const db = getClientFirestore();
  const uid = await ensureUid();
  const msgRef = collection(db, "tickets", ticketId, "messages");
  await addDoc(msgRef, {
    text,
    senderId: uid,
    senderRole,
    createdAt: serverTimestamp()
  });
  await updateDoc(doc(db, "tickets", ticketId), { lastMessageAt: serverTimestamp() });
}

export function listenToTicketMessages(ticketId: string, onUpdate: (messages: TicketMessage[]) => void) {
  const db = getClientFirestore();
  const q = query(collection(db, "tickets", ticketId, "messages"), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => {
    const msgs: TicketMessage[] = [];
    snap.forEach((d) => {
      const data = d.data() as any;
      msgs.push({
        id: d.id,
        text: String(data.text || ""),
        senderId: String(data.senderId || ""),
        senderRole: (data.senderRole || "user") as SenderRole,
        createdAt: data.createdAt || null
      });
    });
    onUpdate(msgs);
  });
}

export function listenToUserTickets(userId: string, onUpdate: (tickets: Ticket[]) => void, status?: TicketStatus) {
  const db = getClientFirestore();
  const base = collection(db, "tickets");
  const q = query(base, where("userId", "==", userId));
  return onSnapshot(q, (snap) => {
    const arr: Ticket[] = [];
    snap.forEach((d) => {
      const data = d.data() as any;
      arr.push({
        id: d.id,
        userId: String(data.userId || ""),
        userEmail: String(data.userEmail || ""),
        subject: String(data.subject || ""),
        status: (data.status || "open") as TicketStatus,
        priority: (data.priority || "medium") as TicketPriority,
        createdAt: data.createdAt || null,
        lastMessageAt: data.lastMessageAt || null
      });
    });
    const getMillis = (value: any) => {
      if (!value) return 0;
      if (typeof value?.toMillis === "function") return value.toMillis();
      if (typeof value?.seconds === "number") return value.seconds * 1000;
      if (value instanceof Date) return value.getTime();
      if (typeof value === "number") return value;
      return 0;
    };
    const filtered = status ? arr.filter((t) => t.status === status) : arr;
    filtered.sort((a, b) => getMillis(b.lastMessageAt || b.createdAt) - getMillis(a.lastMessageAt || a.createdAt));
    onUpdate(filtered);
  });
}

export function listenToAllTickets(onUpdate: (tickets: Ticket[]) => void) {
  const db = getClientFirestore();
  const q = query(collection(db, "tickets"), orderBy("lastMessageAt", "desc"));
  return onSnapshot(q, (snap) => {
    const arr: Ticket[] = [];
    snap.forEach((d) => {
      const data = d.data() as any;
      arr.push({
        id: d.id,
        userId: String(data.userId || ""),
        userEmail: String(data.userEmail || ""),
        subject: String(data.subject || ""),
        status: (data.status || "open") as TicketStatus,
        priority: (data.priority || "medium") as TicketPriority,
        createdAt: data.createdAt || null,
        lastMessageAt: data.lastMessageAt || null
      });
    });
    onUpdate(arr);
  });
}

export async function updateTicketStatus(ticketId: string, status: TicketStatus) {
  const db = getClientFirestore();
  await updateDoc(doc(db, "tickets", ticketId), { status });
}
