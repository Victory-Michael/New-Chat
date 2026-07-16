import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  where,
  increment,
  Timestamp,
  writeBatch,
  runTransaction
} from "firebase/firestore";

/* ─── Init ─────────────────────────────────────────────────── */
const firebaseConfig = {
  apiKey: "AIzaSyDjTLUmEykkDLuBTG7RvuaopnAwbJxqASM",
  authDomain: "msgin-7ba37.firebaseapp.com",
  projectId: "msgin-7ba37",
  storageBucket: "msgin-7ba37.firebasestorage.app",
  messagingSenderId: "867607015124",
  appId: "1:867607015124:web:46cb99e6374a6af8235541",
  measurementId: "G-G034EPZQ0H",
};

const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);

/* ════════════════════════════════════════════════════════════
   LOCAL STORAGE — Room history (link-only access)
════════════════════════════════════════════════════════════ */
const STORAGE_KEY = "msgin_joined_rooms";

export function addLocalRoomId(roomId) {
  const ids = getLocalRoomIds();
  if (!ids.includes(roomId)) {
    ids.unshift(roomId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, 20)));
  }
}

export function removeLocalRoomId(roomId) {
  const ids = getLocalRoomIds().filter(id => id !== roomId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event("storage"));
}

export function getLocalRoomIds() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

/* ════════════════════════════════════════════════════════════
   AUTH
════════════════════════════════════════════════════════════ */
export function ensureAnonymousAuth() {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub();
      if (user) return resolve(user);
      try {
        const cred = await signInAnonymously(auth);
        resolve(cred.user);
      } catch (e) {
        reject(e);
      }
    });
  });
}

/* ════════════════════════════════════════════════════════════
   USER PROFILE
════════════════════════════════════════════════════════════ */
export async function getOrCreateProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  const suffix = Math.floor(1000 + Math.random() * 9000);
  const profile = {
    uid,
    handle: `ghost_${suffix}`,
    initials: "GH",
    tier: "anon",
    score: 0,
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, profile);
  return profile;
}

export async function updateScore(uid, by = 1) {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, { score: increment(by) });
}

// ADD THIS NEW FUNCTION BELOW:
export async function updateProfile(uid, newHandle, avatarType, avatarValue) {
  if (!uid) return;
  const cleaned = newHandle.trim().slice(0, 30); // Exactly 30 characters maximum
  if (!cleaned) throw new Error("Handle cannot be empty");
  
  const ref = doc(db, "users", uid);
  const updates = {
    handle: cleaned,
    avatarType: avatarType, // "initials" or "dicebear"
    avatarValue: avatarValue, // Stores chosen seed string or initials value
  };
  
  await updateDoc(ref, updates);
  return updates;
}

/* ════════════════════════════════════════════════════════════
   ROOMS — Link-only access, 24-hour expiry
════════════════════════════════════════════════════════════ */
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

export async function createRoom(data) {
  const {
    name,
    topic,
    emoji,
    accentColor,
    privacy,
    password,
    memberLimit,
    createdBy,
    creatorHandle,
  } = data;

  const slug = name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 32);

  const existing = await getDoc(doc(db, "rooms", slug));
  const finalSlug = existing.exists()
    ? `${slug}-${Date.now().toString(36)}`
    : slug;

  const now = Date.now();
  const expiresAt = Timestamp.fromMillis(now + ROOM_TTL_MS);

  const roomData = {
    id: finalSlug,
    name,
    slug: finalSlug,
    topic: topic || "",
    emoji: emoji || "💬",
    accentColor: accentColor || "#EC4899",
    privacy,
    password: privacy === "private" ? password : null,
    memberLimit: memberLimit || 100,
    memberCount: 1,
    messageCount: 0,
    createdBy,
    creatorHandle,
    createdAt: serverTimestamp(),
    expiresAt,
    lastMessageAt: serverTimestamp(),
    lastMessage: "",
    pinned: false,
  };

  await setDoc(doc(db, "rooms", finalSlug), roomData);
  addLocalRoomId(finalSlug);
  return finalSlug;
}

export function subscribeToRooms(uid, callback) {
  const localIds = getLocalRoomIds();

  if (localIds.length === 0) {
    callback([]);
    return () => {};
  }

  const now = Date.now();
  const unsubscribers = [];
  const roomMap = new Map();

  const flush = () => {
    const live = [];
    for (const [id, room] of roomMap.entries()) {
      const expMs = room.expiresAt?.toMillis
        ? room.expiresAt.toMillis()
        : Number(room.expiresAt);

      if (expMs && now > expMs) {
        removeLocalRoomId(id);
        purgeExpiredRoom(id);
      } else {
        live.push(room);
      }
    }
    live.sort((a, b) => {
      const aT = a.lastMessageAt?.toMillis?.() ?? 0;
      const bT = b.lastMessageAt?.toMillis?.() ?? 0;
      return bT - aT;
    });
    callback(live);
  };

  for (const roomId of localIds) {
    const unsub = onSnapshot(doc(db, "rooms", roomId), (snap) => {
      if (!snap.exists()) {
        roomMap.delete(roomId);
        removeLocalRoomId(roomId);
      } else {
        roomMap.set(roomId, { id: snap.id, ...snap.data() });
      }
      flush();
    });
    unsubscribers.push(unsub);
  }

  return () => unsubscribers.forEach((u) => u());
}

export function trackRoomLocally(roomId) {
  addLocalRoomId(roomId);
}

async function purgeExpiredRoom(roomId) {
  try {
    const collections = ["messages", "typing", "presence"];
    for (const col of collections) {
      const snap = await getDocs(collection(db, "rooms", roomId, col));
      const dels = snap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(dels);
    }
    await deleteDoc(doc(db, "rooms", roomId));
  } catch (_) {}
}

export async function updateHeartbeat(roomId, uid, currentHandle, avatarType = null, avatarValue = null) {
  if (!roomId || !uid || !db) return;
  const presenceRef = doc(db, "rooms", roomId, "presence", uid);
  try {
    await setDoc(presenceRef, {
      lastSeen: serverTimestamp(),
      handle: currentHandle,
      uid: uid,
      avatarType,   // <-- Added
      avatarValue   // <-- Added
    }, { merge: true });
  } catch (e) {
    console.error("Heartbeat failed:", e);
  }
}

export async function verifyRoomPassword(roomId, password) {
  const snap = await getDoc(doc(db, "rooms", roomId));
  if (!snap.exists()) return false;
  return snap.data().password === password;
}

export async function getRoomById(roomId) {
  const snap = await getDoc(doc(db, "rooms", roomId));
  if (!snap.exists()) return null;
  const r = { id: snap.id, ...snap.data() };
  const expMs = r.expiresAt?.toMillis ? r.expiresAt.toMillis() : r.expiresAt;
  if (expMs && Date.now() > expMs) {
    purgeExpiredRoom(roomId);
    removeLocalRoomId(roomId);
    return null;
  }
  return r;
}

export async function editMessage(roomId, messageId, newText) {
  if (!roomId || !messageId) return;

  try {
    const messageRef = doc(db, "rooms", roomId, "messages", messageId);

    // 1. Update the individual message document text field
    await updateDoc(messageRef, {
      text: newText,
      edited: true,
      editedAt: new Date()
    });

    // 2. Query the latest message document to check if it's the one being edited
    const messagesRef = collection(db, "rooms", roomId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "desc"), limit(1));
    const snap = await getDocs(q);

    if (!snap.empty && snap.docs[0].id === messageId) {
      const roomRef = doc(db, "rooms", roomId);
      
      // CRITICAL FIX: Ensure you are explicitly passing the plain string variable `newText`
      // Double check that you aren't passing `messageId`, `messageRef`, or an un-destructured event.
      await updateDoc(roomRef, {
        lastMessage: String(newText) 
      });
    }

  } catch (error) {
    console.error("Error running editMessage sync sync logic:", error);
    throw error;
  }
}

export function getRoomShareLink(roomId) {
  const base = window.location.origin + window.location.pathname;
  return `${base}?room=${roomId}`;
}

async function touchRoom(roomId, preview) {
  await updateDoc(doc(db, "rooms", roomId), {
    lastMessage: preview.slice(0, 60),
    lastMessageAt: serverTimestamp(),
    messageCount: increment(1),
  });
}

/* ════════════════════════════════════════════════════════════
   MESSAGES
════════════════════════════════════════════════════════════ */
export async function sendMessage({
  roomId,
  uid,
  handle,
  initials,
  text,
  replyTo = null,
  avatarType = null,  // <-- Added
  avatarValue = null, // <-- Added
}) {
  const trimmed = text.trim();
  if (!trimmed) return;
  
  const ref = collection(db, "rooms", roomId, "messages");
  await addDoc(ref, {
    uid,
    handle,
    initials,
    text: trimmed,
    replyTo,
    reactions: {},
    createdAt: serverTimestamp(),
    edited: false,
    avatarType,   // <-- Added
    avatarValue   // <-- Added
  });

  await touchRoom(roomId, trimmed);
  await updateScore(uid, 1);
}

export function subscribeToMessages(roomId, callback) {
  const q = query(
    collection(db, "rooms", roomId, "messages"),
    orderBy("createdAt", "asc"),
    limit(100)
  );
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt ?? null,
    }));
    callback(msgs);
  });
}

export async function toggleReaction(roomId, messageId, emoji, uid) {
  const ref = doc(db, "rooms", roomId, "messages", messageId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const reactions = JSON.parse(JSON.stringify(snap.data().reactions || {}));
  let existingEmoji = null;
  for (const [e, data] of Object.entries(reactions)) {
    if (data.voters?.includes(uid)) {
      existingEmoji = e;
      break;
    }
  }

  if (existingEmoji) {
    if (!reactions[existingEmoji]) reactions[existingEmoji] = { count: 0, voters: [] };
    reactions[existingEmoji].count = Math.max(0, (reactions[existingEmoji].count || 0) - 1);
    reactions[existingEmoji].voters = (reactions[existingEmoji].voters || []).filter(v => v !== uid);
  }

  if (existingEmoji !== emoji) {
    if (!reactions[emoji]) reactions[emoji] = { count: 0, voters: [] };
    reactions[emoji].count = (reactions[emoji].count || 0) + 1;
    reactions[emoji].voters = [...(reactions[emoji].voters || []), uid];
  }

  await updateDoc(ref, { reactions });
}

export async function deleteMessage(roomId, messageId) {
  if (!roomId || !messageId) return;

  try {
    const messageRef = doc(db, "rooms", roomId, "messages", messageId);
    const messagesRef = collection(db, "rooms", roomId, "messages");

    // 1. Find out what the latest message is BEFORE we delete this one
    const preDeleteQuery = query(messagesRef, orderBy("createdAt", "desc"), limit(1));
    const preDeleteSnap = await getDocs(preDeleteQuery);
    
    const isDeletingLastMessage = !preDeleteSnap.empty && preDeleteSnap.docs[0].id === messageId;

    // 2. Delete the target message document
    await deleteDoc(messageRef);

    // 3. If we just deleted the message that was showing in the sidebar, update it
    if (isDeletingLastMessage) {
      // Query again to get the NEW latest message (the previous one in line)
      const postDeleteQuery = query(messagesRef, orderBy("createdAt", "desc"), limit(1));
      const postDeleteSnap = await getDocs(postDeleteQuery);
      const roomRef = doc(db, "rooms", roomId);

      if (!postDeleteSnap.empty) {
        // There is still a message left in the room, use its text
        const nextLatestMessageText = postDeleteSnap.docs[0].data().text;
        await updateDoc(roomRef, {
          lastMessage: nextLatestMessageText
        });
      } else {
        // The room is completely empty now! Clear out the preview text
        await updateDoc(roomRef, {
          lastMessage: "" // or "No messages yet."
        });
      }
    }

  } catch (error) {
    console.error("Error updating room fallback preview during deletion:", error);
    throw error;
  }
}

/* ════════════════════════════════════════════════════════════
   TYPING INDICATORS
════════════════════════════════════════════════════════════ */
export async function setTyping(roomId, uid, handle, isTyping) {
  const ref = doc(db, "rooms", roomId, "typing", uid);
  if (isTyping) {
    await setDoc(ref, { handle, uid, at: serverTimestamp() });
  } else {
    await deleteDoc(ref).catch(() => {});
  }
}

export function subscribeToTyping(roomId, myUid, callback) {
  return onSnapshot(collection(db, "rooms", roomId, "typing"), (snap) => {
    const typers = snap.docs
      .map((d) => d.data())
      .filter((d) => d.uid !== myUid);
    callback(typers);
  });
}

/* ════════════════════════════════════════════════════════════
   PRESENCE (Dynamically resolved connection handlers)
════════════════════════════════════════════════════════════ */

export async function joinRoom(roomId, uid, handle, avatarType = null, avatarValue = null) {
  if (!roomId || !uid) return;
  
  const roomRef = doc(db, "rooms", roomId);
  const presenceRef = doc(db, "rooms", roomId, "presence", uid);
  const presenceCollectionRef = collection(db, "rooms", roomId, "presence");

  const presenceDocsSnapshot = await getDocs(presenceCollectionRef);
  const currentActiveCount = presenceDocsSnapshot.docs.filter(doc => doc.id !== uid).length;

  await runTransaction(db, async (transaction) => {
    const roomSnap = await transaction.get(roomRef);
    const presenceSnap = await transaction.get(presenceRef);

    if (!roomSnap.exists()) return;
    const roomData = roomSnap.data();

    if (roomData.createdBy === uid) {
      transaction.set(presenceRef, { 
        uid, 
        handle: handle || "Ghost Creator", 
        joinedAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
        avatarType,  // <-- Added
        avatarValue  // <-- Added
      }, { merge: true });
      return;
    }

    if (!presenceSnap.exists() && currentActiveCount >= roomData.memberLimit) {
      throw new Error("Room is full");
    }

    transaction.set(presenceRef, { 
      uid, 
      handle: handle || "Ghost Member", 
      joinedAt: presenceSnap.exists() ? (presenceSnap.data().joinedAt || serverTimestamp()) : serverTimestamp(),
      lastSeen: serverTimestamp(),
      avatarType,  // <-- Added
      avatarValue  // <-- Added
    }, { merge: true });
    
    const finalCalculatedCount = presenceSnap.exists() ? currentActiveCount + 1 : currentActiveCount + 1;
    transaction.update(roomRef, { memberCount: finalCalculatedCount });
  });
}

export async function leaveRoom(roomId, uid) {
  if (!roomId || !uid) return;

  const roomRef = doc(db, "rooms", roomId);
  const presenceRef = doc(db, "rooms", roomId, "presence", uid);

  try {
    await runTransaction(db, async (transaction) => {
      const roomSnap = await transaction.get(roomRef);
      const presenceSnap = await transaction.get(presenceRef);
      
      if (!roomSnap.exists()) return;

      // Only decrement the counter if this user actually has an active presence record
      if (presenceSnap.exists()) {
        transaction.delete(presenceRef);
        transaction.update(roomRef, { 
          // Server-side atomic subtraction. No query snapshots required!
          memberCount: increment(-1) 
        });
      }
    });
    
    removeLocalRoomId(roomId); 
  } catch (e) {
    console.error("Leave room transaction failed safely:", e);
    throw e;
  }
}

export function subscribeToPresence(roomId, callback) {
  return onSnapshot(
    collection(db, "rooms", roomId, "presence"),
    (snap) => {
      callback(snap.docs.map((d) => d.data()));
    }
  );
}

export function subscribeToRoomStats(roomId, callback) {
  return onSnapshot(doc(db, "rooms", roomId), (snap) => {
    if (!snap.exists()) return;
    callback(snap.data());
  });
}

/**
 * Updates the user's profile data in the Firestore database
 * @param {string} uid - The user's unique authentication ID
 * @param {string} newName - The updated username (max 30 chars)
 * @param {string} avatarType - Either "dicebear" or "initials"
 * @param {string} avatarValue - The Dicebear seed string OR the calculated initials (e.g., "GHO")
 */
export async function updateUserProfile(uid, newName, avatarType, avatarValue) {
  if (!uid || !newName.trim()) throw new Error("Invalid name or user ID");
  
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    username: newName.trim().substring(0, 30),
    avatarType,
    avatarValue,
    updatedAt: serverTimestamp()
  });
}
