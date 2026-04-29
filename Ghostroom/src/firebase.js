import { initializeApp } from "firebase/app";
import {
  getAuth, signInAnonymously, onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  collection, doc,
  addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, orderBy, limit, where,
  onSnapshot, serverTimestamp, increment,
  writeBatch, Timestamp,
} from "firebase/firestore";
import {
  getDatabase,
  ref as rtRef, set as rtSet, onValue,
  onDisconnect, serverTimestamp as rtServerTimestamp,
  increment as rtIncrement, remove,
} from "firebase/database";

/* ─── Config ──────────────────────────────────────────────── */
const firebaseConfig = {
  apiKey:            "AIzaSyDjTLUmEykkDLuBTG7RvuaopnAwbJxqASM",
  authDomain:        "msgin-7ba37.firebaseapp.com",
  projectId:         "msgin-7ba37",
  storageBucket:     "msgin-7ba37.firebasestorage.app",
  messagingSenderId: "867607015124",
  appId:             "1:867607015124:web:46cb99e6374a6af8235541",
  measurementId:     "G-G034EPZQ0H",
  // ADD your Realtime Database URL to firebaseConfig in the Firebase console
  databaseURL:       "https://msgin-7ba37-default-rtdb.firebaseio.com",
};

const app   = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
export const rtdb = getDatabase(app);

/* ════════════════════════════════════════════════════════════
   UTILS
════════════════════════════════════════════════════════════ */
/** Generate a 5-char alphanumeric room code, e.g. "X4K2M" */
export function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

/** 24 hours from now as a JS Date */
export function expiresAt24h() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

/* ════════════════════════════════════════════════════════════
   AUTH
════════════════════════════════════════════════════════════ */
export function ensureAnonymousAuth() {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub();
      if (user) return resolve(user);
      try { resolve((await signInAnonymously(auth)).user); }
      catch (e) { reject(e); }
    });
  });
}

/* ════════════════════════════════════════════════════════════
   USER PROFILE
════════════════════════════════════════════════════════════ */
export async function getOrCreateProfile(uid) {
  const ref  = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  const suffix  = Math.floor(1000 + Math.random() * 9000);
  const profile = {
    uid, handle: `ghost_${suffix}`,
    initials: "GH", tier: "anon", score: 0,
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, profile);
  return profile;
}

export async function bumpScore(uid, by = 1) {
  await updateDoc(doc(db, "users", uid), { score: increment(by) }).catch(() => {});
}

/* ════════════════════════════════════════════════════════════
   ROOMS
════════════════════════════════════════════════════════════ */
/**
 * Create a new room. All rooms expire in 24h.
 * Returns the room's Firestore document id.
 */
export async function createRoom({
  name, topic, emoji, accentColor, privacy, password,
  memberLimit, createdBy, creatorHandle,
}) {
  const code      = generateRoomCode();
  const expiresOn = expiresAt24h();

  const roomData = {
    id:             code,
    code,
    name:           name.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 32),
    displayName:    name.trim(),
    topic:          topic || "",
    emoji:          emoji || "💬",
    accentColor:    accentColor || "#EC4899",
    privacy,
    password:       privacy === "private" ? password : null,
    memberLimit:    Math.max(2, Math.min(500, Number(memberLimit) || 50)),
    createdBy,
    creatorHandle,
    createdAt:      serverTimestamp(),
    expiresAt:      Timestamp.fromDate(expiresOn),
    lastMessageAt:  serverTimestamp(),
    lastMessage:    "",
    burnOnRead:     false,
    memberCount:    0,
  };

  // Use the code as the document id so share links resolve directly
  await setDoc(doc(db, "rooms", code), roomData);
  return code;
}

export function subscribeToRooms(uid, callback) {
  const now = Timestamp.now();
  const q   = query(
    collection(db, "rooms"),
    where("expiresAt", ">", now),
    orderBy("expiresAt", "desc"),
    orderBy("lastMessageAt", "desc"),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    const rooms = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((r) => r.privacy === "public" || r.createdBy === uid);
    callback(rooms);
  });
}

export async function getRoomByCode(code) {
  const snap = await getDoc(doc(db, "rooms", code.toUpperCase()));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function verifyRoomPassword(roomId, password) {
  const snap = await getDoc(doc(db, "rooms", roomId));
  return snap.exists() && snap.data().password === password;
}

export async function toggleBurnOnRead(roomId, value) {
  await updateDoc(doc(db, "rooms", roomId), { burnOnRead: value });
}

/** Update last message preview */
export async function touchRoom(roomId, preview) {
  await updateDoc(doc(db, "rooms", roomId), {
    lastMessage:   preview.slice(0, 60),
    lastMessageAt: serverTimestamp(),
  }).catch(() => {});
}

/**
 * MELTDOWN — delete all subcollections + room doc.
 * Call from the hook when countdown hits 0.
 */
export async function purgeRoom(roomId) {
  const batch = writeBatch(db);
  const subcols = ["messages", "typing", "presence", "surveillance"];
  for (const sub of subcols) {
    const snap = await getDocs(collection(db, "rooms", roomId, sub));
    snap.docs.forEach((d) => batch.delete(d.ref));
  }
  batch.delete(doc(db, "rooms", roomId));
  await batch.commit().catch(() => {});
  // Clean RTDB presence
  await remove(rtRef(rtdb, `presence/${roomId}`)).catch(() => {});
}

/* ════════════════════════════════════════════════════════════
   MESSAGES
════════════════════════════════════════════════════════════ */
export async function sendMessage({ roomId, uid, handle, initials, text, replyTo = null, isSystem = false }) {
  const trimmed = text.trim();
  if (!trimmed) return;
  await addDoc(collection(db, "rooms", roomId, "messages"), {
    uid, handle, initials, text: trimmed,
    replyTo, isSystem, reactions: {},
    createdAt: serverTimestamp(),
    burnedAt:  null,
  });
  if (!isSystem) {
    await touchRoom(roomId, trimmed);
    await bumpScore(uid, 1);
  }
}

export function subscribeToMessages(roomId, callback) {
  const q = query(
    collection(db, "rooms", roomId, "messages"),
    orderBy("createdAt", "asc"),
    limit(100)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function deleteMessage(roomId, msgId) {
  await deleteDoc(doc(db, "rooms", roomId, "messages", msgId)).catch(() => {});
}

export async function toggleReaction(roomId, msgId, emoji, uid) {
  const ref  = doc(db, "rooms", roomId, "messages", msgId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const rx   = { ...(snap.data().reactions || {}) };
  if (!rx[emoji]) rx[emoji] = { count: 0, voters: [] };
  const already = rx[emoji].voters.includes(uid);
  if (already) {
    rx[emoji].count   = Math.max(0, rx[emoji].count - 1);
    rx[emoji].voters  = rx[emoji].voters.filter((v) => v !== uid);
  } else {
    rx[emoji].count  += 1;
    rx[emoji].voters  = [...rx[emoji].voters, uid];
  }
  await updateDoc(ref, { reactions: rx });
}

/* ════════════════════════════════════════════════════════════
   TYPING INDICATORS  (Firestore sub-collection)
════════════════════════════════════════════════════════════ */
export async function setTyping(roomId, uid, handle, isTyping) {
  const ref = doc(db, "rooms", roomId, "typing", uid);
  if (isTyping) await setDoc(ref, { uid, handle, at: serverTimestamp() });
  else await deleteDoc(ref).catch(() => {});
}

export function subscribeToTyping(roomId, myUid, callback) {
  return onSnapshot(collection(db, "rooms", roomId, "typing"), (snap) => {
    callback(snap.docs.map((d) => d.data()).filter((d) => d.uid !== myUid));
  });
}

/* ════════════════════════════════════════════════════════════
   PRESENCE  — Firebase Realtime Database for true online count
════════════════════════════════════════════════════════════ */
export function joinPresence(roomId, uid, handle) {
  const userRef = rtRef(rtdb, `presence/${roomId}/${uid}`);
  rtSet(userRef, { uid, handle, online: true, joinedAt: rtServerTimestamp() });
  // Auto-remove on disconnect
  onDisconnect(userRef).remove();
  return () => remove(userRef).catch(() => {});
}

export function subscribeToPresence(roomId, callback) {
  const r = rtRef(rtdb, `presence/${roomId}`);
  const unsub = onValue(r, (snap) => {
    const data = snap.val() || {};
    callback(Object.values(data));
  });
  return () => unsub();
}

/* ════════════════════════════════════════════════════════════
   UNREAD TRACKING  — localStorage per user/room
════════════════════════════════════════════════════════════ */
const UNREAD_KEY = (uid, roomId) => `msgin_unread_${uid}_${roomId}`;

export function markRoomRead(uid, roomId, lastMsgId) {
  localStorage.setItem(UNREAD_KEY(uid, roomId), lastMsgId || "");
}

export function getLastReadId(uid, roomId) {
  return localStorage.getItem(UNREAD_KEY(uid, roomId)) || "";
}

/* ════════════════════════════════════════════════════════════
   SURVEILLANCE LOGS
════════════════════════════════════════════════════════════ */
export async function logSurveillance(roomId, uid, handle, eventType) {
  // Write to surveillance sub-collection
  await addDoc(collection(db, "rooms", roomId, "surveillance"), {
    uid, handle, eventType, at: serverTimestamp(),
  });
  // Also post a system message so everyone in the room sees it
  const messages = {
    "tab-out":    `⚠ ${handle} left the viewport.`,
    "screenshot": `⚠ ${handle} attempted a screen capture. Room alerted.`,
    "recording":  `⚠ ${handle} attempted a screen recording. Room alerted.`,
  };
  if (messages[eventType]) {
    await sendMessage({
      roomId, uid: "system", handle: "system", initials: "SY",
      text: messages[eventType], isSystem: true,
    });
  }
}

export function subscribeSurveillance(roomId, callback) {
  const q = query(
    collection(db, "rooms", roomId, "surveillance"),
    orderBy("at", "desc"),
    limit(20)
  );
  return onSnapshot(q, (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}