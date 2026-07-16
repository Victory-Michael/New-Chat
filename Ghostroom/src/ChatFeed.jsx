import React, { useState, useEffect, useRef, useCallback, forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  sendMessage,
  subscribeToMessages,
  toggleReaction,
  deleteMessage,
  setTyping,
  subscribeToTyping,
  verifyRoomPassword,
  getRoomShareLink,
  subscribeToRoomStats,
  editMessage, 
} from "./firebase";
import "./ChatFeed.css";
import { joinRoom, leaveRoom } from "./firebase";
import { doc, deleteDoc } from "firebase/firestore";
import { db } from "./firebase"; 


/* ─── Copy to clipboard ──────────────────────────────────── */
function copyToClipboard(text) {
  return new Promise((resolve, reject) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(resolve).catch(() => {
        fallbackCopy(text) ? resolve() : reject();
      });
    } else {
      fallbackCopy(text) ? resolve() : reject();
    }
  });
}
function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand("copy"); document.body.removeChild(ta); return true; } catch (_) {}
  document.body.removeChild(ta);
  return false;
}

/* ─── Share Modal ────────────────────────────────────────── */
function ShareModal({ room, onClose, showToast }) {
  const link = getRoomShareLink(room.id);
  const [copied, setCopied] = useState(false);

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: `Join #${room.name} on MsgIn`,
        text: room.topic || `Anonymous chat in #${room.name}. Expires in 24h.`,
        url: link,
      });
      onClose();
    } catch (e) {
      if (e.name !== "AbortError") {
        handleCopy();
      }
    }
  };

  const handleCopy = async () => {
    try {
      await copyToClipboard(link);
      setCopied(true);
      showToast("Link copied to clipboard!", "🔗");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Failed to copy link.", "❌");
    }
  };

  const supportsShare = typeof navigator.share === "function";

  return (

    
    <div
      className="cf-share-backdrop"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      
      <div className="cf-share-modal">
        <div className="cf-share-header">
          <span className="cf-share-emoji">{room.emoji}</span>
          <div className="cf-share-info">
            <span className="cf-share-name" style={{ color: room.accentColor }}>
              #{room.name}
            </span>
            <span className="cf-share-sub">Share this room</span>
          </div>
          <button className="cf-share-close" onClick={onClose}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="cf-share-link-row">
          <span className="cf-share-link-text">{link}</span>
        </div>

        <div className="cf-share-actions">
          {supportsShare && (
            <button
              className="cf-share-btn primary"
              style={{ background: room.accentColor }}
              onClick={handleNativeShare}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              Share
            </button>
          )}
          <button
            className={`cf-share-btn ${supportsShare ? "secondary" : "primary"}`}
            style={!supportsShare ? { background: room.accentColor } : {}}
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
                Copy Link
              </>
            )}
          </button>
        </div>

        {room.privacy === "private" && (
          <p className="cf-share-hint">
            🔒 This is a private room — recipients also need the password.
          </p>
        )}
        <p className="cf-share-hint">⏳ This room expires 24h after creation.</p>
      </div>
    </div>
  );
}

/* ─── Expiry countdown ───────────────────────────────────── */
function useExpiry(expiresAt) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!expiresAt) return;
    const expMs = expiresAt?.toMillis ? expiresAt.toMillis() : Number(expiresAt);
    const tick = () => {
      const diff = expMs - Date.now();
      if (diff <= 0) { setLabel("Expired"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLabel(`${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return label;
}

/* ─── Static Time Formatter ──────────────────────────────── */
function formatMessageTime(ts) {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).toLowerCase();
}

/* ─── Skeleton loading ───────────────────────────────────── */
function SkeletonMessage({ wide }) {
  return (
    <div className="cf-msg cf-skeleton-row">
      <div className="cf-av cf-skel" style={{ borderRadius: "50%" }} />
      <div className="cf-msg-body">
        <div className="cf-msg-head">
          <div className="cf-skel" style={{ width: 70, height: 10, borderRadius: 4 }} />
          <div className="cf-skel" style={{ width: 36, height: 8, borderRadius: 4, marginLeft: 6 }} />
        </div>
        <div className="cf-skel" style={{ width: wide ? "72%" : "42%", height: 34, borderRadius: 8, marginTop: 4 }} />
      </div>
    </div>
  );
}

function SkeletonFeed() {
  return (
    <div className="cf-messages">
      {[true, false, true, false, true].map((wide, i) => (
        <SkeletonMessage key={i} wide={wide} />
      ))}
    </div>
  );
}

/* ─── Empty state ────────────────────────────────────────── */
function EmptyState({ room, onPrompt }) {
  if (!room) return null;
  const prompts = [
    "Drop something into the void.",
    "Be the first to break the silence.",
    "What's on your mind right now?",
    "Send anonymously. No traces.",
  ];
  return (
    <div className="cf-empty">
      <div className="cf-empty-icon" style={{ color: room.accentColor || "var(--pink)" }}>
        <span style={{ fontSize: 28 }}>{room.emoji || "💬"}</span>
      </div>
      <p className="cf-empty-title">#{room.name}</p>
      <p className="cf-empty-sub">
        {room.topic || "No topic set."}
        <br />
        No messages yet — start the conversation.
      </p>
      <div className="cf-empty-prompts">
        {prompts.map((p) => (
          <button key={p} className="cf-empty-prompt" onClick={() => onPrompt(p)}>{p}</button>
        ))}
      </div>
    </div>
  );
}

/* ─── Typing indicator ───────────────────────────────────── */
function TypingBar({ typers }) {
  if (!typers.length) return null;
  const label =
    typers.length === 1 ? `${typers[0].handle} is typing`
    : typers.length === 2 ? `${typers[0].handle} and ${typers[1].handle} are typing`
    : "Several people are typing";
  return (
    <div className="cf-typing">
      <span className="cf-typing-dots"><span /><span /><span /></span>
      <span className="cf-typing-text">{label}…</span>
    </div>
  );
}

/* ─── Reply quote ────────────────────────────────────────── */
function ReplyQuote({ replyTo, onClear }) {
  if (!replyTo) return null;
  return (
    <div className="cf-reply-bar">
      <div className="cf-reply-indicator" />
      <div className="cf-reply-content">
        <span className="cf-reply-who">{replyTo.handle}</span>
        <span className="cf-reply-text">{replyTo.text}</span>
      </div>
      <button className="cf-reply-clear" onClick={onClear}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}

/* ─── Single message component ───────────────────────────── */
const Message = forwardRef(({ msg, isMine, uid, roomId, prevUid, accentColor, onReply, showToast, isFocused, onToggleFocus }, ref) => {
  const isCompact = prevUid === msg.uid;
  const [optimisticReactions, setOptimisticReactions] = useState(null);
  const reactions = optimisticReactions ?? (msg.reactions || {});
  
  const exactTimeStr = formatMessageTime(msg.createdAt);

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(msg.text);
  const [savingEdit, setSavingEdit] = useState(false);

  // Desktop hover state tracker to avoid CSS emulator hover bugs
  const [isHovered, setIsHovered] = useState(false);
  const lastTapRef = useRef(0);

  const msgTime = msg.createdAt?.toMillis ? msg.createdAt.toMillis() : new Date(msg.createdAt).getTime();
  const isEditable = isMine && msgTime && (Date.now() - msgTime < 15 * 60 * 1000);

  useEffect(() => {
    setOptimisticReactions(null);
    setEditText(msg.text);
  }, [msg.reactions, msg.text]);

  // Combined Click Handler (Single to Close / Double to Open)
  const handleMessageClick = (e) => {
    e.stopPropagation(); // Stop leakages to the scroll view container

    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    
    if (now - lastTapRef.current < DOUBLE_PRESS_DELAY) {
      // 💥 DOUBLE CLICK: Toggle/Open reactions modal
      e.preventDefault();
      onToggleFocus(msg.id);
    } else {
      // 👆 SINGLE CLICK: Explicitly close any active reactions window
      if (isFocused) {
        onToggleFocus(null);
      } else {
        // Clear globally active overlays when changing paths
        onToggleFocus(null);
      }
    }
    lastTapRef.current = now;
  };

  const handleReact = async (emoji, e) => {
    if (e) e.stopPropagation();
    onToggleFocus(null); // Shut down focus context immediately

    const current = JSON.parse(JSON.stringify(msg.reactions || {}));
    let existingEmoji = null;
    for (const [eName, data] of Object.entries(current)) {
      if (data.voters?.includes(uid)) { existingEmoji = eName; break; }
    }

    if (existingEmoji) {
      current[existingEmoji].count = Math.max(0, (current[existingEmoji].count || 0) - 1);
      current[existingEmoji].voters = (current[existingEmoji].voters || []).filter(v => v !== uid);
    }
    if (existingEmoji !== emoji) {
      if (!current[emoji]) current[emoji] = { count: 0, voters: [] };
      current[emoji].count = (current[emoji].count || 0) + 1;
      current[emoji].voters = [...(current[emoji].voters || []), uid];
    }

    setOptimisticReactions(current);

    try {
      await toggleReaction(roomId, msg.id, emoji, uid);
    } catch {
      setOptimisticReactions(null);
      showToast("Failed to add reaction.", "❌");
    }
  };

  const handleSaveEdit = async () => {
    if (!editText.trim() || editText.trim() === msg.text) {
      setIsEditing(false);
      return;
    }
    setSavingEdit(true);
    try {
      await editMessage(roomId, msg.id, editText);
      setIsEditing(false);
    } catch (err) {
      showToast("Failed to save edit.", "❌");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleEditKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditText(msg.text);
    }
  };

  const handleDelete = async () => {
    await deleteMessage(roomId, msg.id, uid);
  };

  const handleCopyText = (e) => {
    e.stopPropagation();
    try {
      copyToClipboard(msg.text);
      showToast("Message copied!", "📋");
    } catch {
      showToast("Failed to copy.", "❌");
    }
  };

  return (
  <div 
    ref={ref} 
    className={`cf-msg${isMine ? " mine" : ""}${isCompact ? " compact" : ""}${isFocused ? " mobile-focus" : ""}${isHovered ? " desktop-hover" : ""}`}
    onClick={handleMessageClick}
    onMouseEnter={() => window.innerWidth > 768 && setIsHovered(true)}
    onMouseLeave={() => window.innerWidth > 768 && setIsHovered(false)}
  >
      <div
        className={`cf-av${isMine ? " mine" : ""}`}
        style={isMine ? { background: `${accentColor}20`, borderColor: `${accentColor}45`, color: accentColor, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" } : { display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
      >
        {isCompact ? null : (
          msg.avatarType === "dicebear" ? (
            <img 
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.avatarValue}`} 
              alt="avatar" 
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
      onError={(e) => {
        // Fallback gracefully if the URL is broken, unauthorized, or expired
        e.target.style.display = 'none';
        e.target.parentElement.innerText = msg.avatarValue || msg.initials || "GHO";
      }}
    />
  ) : (
    msg.avatarValue || msg.initials || "GHO"
  )
)}
      </div>

      <div className="cf-msg-body">
        <div className="cf-msg-head">
          <span className={`cf-sender${isMine ? " mine" : ""}${isCompact ? " hidden-sender" : ""}`} style={isMine ? { color: accentColor } : {}}>
            {isMine ? "You" : msg.handle}
          </span>
          <span className="cf-ts">
            {exactTimeStr} {msg.edited && <span className="cf-edited-tag">(edited)</span>}
          </span>
        </div>

        {msg.replyTo && (
          <div className="cf-msg-reply-ref">
            <div className="cf-mrr-bar" />
            <span className="cf-mrr-who">{msg.replyTo.handle}</span>
            <span className="cf-mrr-text">{msg.replyTo.text}</span>
          </div>
        )}

        <div
          className={`cf-bubble${isMine ? " mine" : ""}${isEditing ? " editing" : ""}`}
          style={isMine ? { background: `${accentColor}18`, borderColor: `${accentColor}35` } : {}}
        >
          {isEditing ? (
            <div className="cf-inline-edit-box" onClick={e => e.stopPropagation()}>
              <textarea
                className="cf-edit-textarea"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={handleEditKeyDown}
                disabled={savingEdit}
                rows={1}
                autoFocus
              />
              <div className="cf-edit-controls">
                <button onClick={() => { setIsEditing(false); setEditText(msg.text); }} className="cf-edit-btn-cancel">Cancel</button>
                <button onClick={handleSaveEdit} className="cf-edit-btn-save" style={{ color: accentColor }}>Save</button>
              </div>
            </div>
          ) : (
            <p className="cf-text">{msg.text}</p>
          )}
        </div>

        {Object.entries(reactions).filter(([, v]) => v.count > 0).length > 0 && (
          <div className="cf-reactions">
            {Object.entries(reactions)
              .filter(([, v]) => v.count > 0)
              .map(([emoji, data]) => (
                <button
                  key={emoji}
                  className={`cf-rxn${data.voters?.includes(uid) ? " active" : ""}`}
                  onClick={(e) => handleReact(emoji, e)}
                >
                  {emoji} <span>{data.count}</span>
                </button>
              ))}
          </div>
        )}
      </div>

      {!isEditing && (
        <div className="cf-actions" onClick={e => e.stopPropagation()}>
          {["👍", "🔥", "👻", "⚡"].map((e) => (
            <button
              key={e}
              className={`cf-act-btn${reactions[e]?.voters?.includes(uid) ? " active-rxn" : ""}`}
              onClick={(evt) => handleReact(e, evt)}
              title={e}
            >
              {e}
            </button>
          ))}
          <button
            className="cf-act-btn icon"
            onClick={() => onReply({ id: msg.id, handle: isMine ? "You" : msg.handle, text: msg.text })}
            title="Reply"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/>
            </svg>
          </button>
          
          {isEditable && (
            <button className="cf-act-btn icon" onClick={() => setIsEditing(true)} title="Edit Message">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </button>
          )}

          <button className="cf-act-btn icon" onClick={handleCopyText} title="Copy">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
          </button>
          {isMine && (
            <button className="cf-act-btn icon danger" onClick={handleDelete} title="Delete">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2-2H8a2 2 0 01-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
});


/* ─── Password gate for private rooms ───────────────────── */
function PasswordGate({ room, onUnlock }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    if (!pw.trim() || checking) return;
    setChecking(true);
    const ok = await verifyRoomPassword(room.id, pw);
    setChecking(false);
    if (ok) { onUnlock(); } else {
      setErr(true);
      setTimeout(() => setErr(false), 1800);
    }
  };

  return (
    <div className="cf-pw-gate">
      <div className="cf-pw-icon">🔒</div>
      <p className="cf-pw-title">Private Room</p>
      <p className="cf-pw-sub">#{room.name} requires a password to enter.</p>
      <div className={`cf-pw-row${err ? " err" : ""}`}>
        <input
          className="cf-pw-input"
          type="text"
          placeholder="Enter room password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && check()}
          autoFocus
        />
        <button className="cf-pw-btn" onClick={check} disabled={checking}>
          {checking ? "…" : "Enter"}
        </button>
      </div>
      {err && <p className="cf-pw-err">Wrong password. Try again.</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN ChatFeed
═══════════════════════════════════════════════════════════ */
export default function ChatFeed({ user, profile, room, onMenuOpen, onCreateRoom, showToast: parentShowToast, onLeaveClick, onRoomFull, onBack, activeRoom }) {
  
  const [isFull, setIsFull] = useState(false) ;
  const navigate = useNavigate(); 
  const [messages, setMessages] = useState(null);
  const [typers, setTypers] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [unlocked, setUnlocked] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [localToast, setLocalToast] = useState({ visible: false, message: "" });
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState(null);

  const firstUnreadRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const typingTimer = useRef(null);
  const isTypingRef = useRef(false);
  const prevRoomId = useRef(null);
  const lastProcessedRoomRef = useRef(null);
  const prevLengthRef = useRef(0);

  const expiryLabel = useExpiry(room?.expiresAt);

  const showToast = useCallback((message, icon) => {
    if (parentShowToast) {
      parentShowToast(message, icon);
    } else {
      setLocalToast({ visible: true, message });
      setTimeout(() => setLocalToast({ visible: false, message: "" }), 2200);
    }
  }, [parentShowToast]);

  useEffect(() => {
    if (room?.id !== prevRoomId.current) {
      setUnlocked(false);
      setMessages(null);
      setDraft("");
      setReplyTo(null);
      setShowShareModal(false);
      setIsFull(false);
      prevRoomId.current = room?.id;
    }
  }, [room?.id]);

  /* ─── Subscribe to messages ─── */
  useEffect(() => {
    if (!room || (room.privacy === "private" && !unlocked)) return;
    setMessages(null);
    const unsub = subscribeToMessages(room.id, (msgs) => setMessages(msgs));
    return unsub;
  }, [room?.id, unlocked]);

  /* ─── Subscribe to typing ─── */
  useEffect(() => {
    if (!room || !user) return;
    const unsub = subscribeToTyping(room.id, user.uid, setTypers);
    return unsub;
  }, [room?.id, user?.uid]);

  /* ─── Subscribe to Room Stats Real-Time Updates ─── */
  useEffect(() => {
    if (!room?.id) return;

    const unsub = subscribeToRoomStats(room.id, (updatedRoomData) => {
      if (updatedRoomData && room) {
        room.memberCount = updatedRoomData.memberCount;
      }
    });
    return unsub;
  }, [room?.id]);

  /* ─── CENTRAL SCROLL CONTEXT ENGINE ─── */
  useEffect(() => {
    if (!room?.id || !messages || messages.length === 0) return;

    const roomId = room.id;
    const isNewRoomSelection = lastProcessedRoomRef.current !== roomId;
    
    const isNewMessageAdded = messages.length > prevLengthRef.current;
    prevLengthRef.current = messages.length;

    if (isNewRoomSelection) {
      setTimeout(() => {
        if (firstUnreadRef.current) {
          firstUnreadRef.current.scrollIntoView({ 
            behavior: "auto", 
            block: "start" 
          });
        } else {
          bottomRef.current?.scrollIntoView({ behavior: "auto" });
        }
        
        localStorage.setItem(`room_last_viewed_${roomId}`, Date.now().toString());
        lastProcessedRoomRef.current = roomId;
      }, 80);
    } else {
      const container = scrollContainerRef.current;
      if (!container) return;

      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 180;
      const isMyMessage = messages[messages.length - 1]?.uid === user?.uid;
      
      if (isNewMessageAdded) {
        if (isMyMessage || isAtBottom) {
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
      }
      
      localStorage.setItem(`room_last_viewed_${roomId}`, Date.now().toString());
    }
  }, [messages, room?.id, user?.uid]);


  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const holdsMoreContent = container.scrollHeight > container.clientHeight;
    const isScrolledUp = container.scrollHeight - container.scrollTop > container.clientHeight + 250;
    
    setShowScrollBtn(holdsMoreContent && isScrolledUp);
  };

  const scrollToBottomExplicit = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  /* ─── Auto-resize textarea ─── */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [draft]);

  /* ─── Typing indicator management ─── */
  const handleDraftChange = useCallback((val) => {
    setDraft(val);
    if (!room || !user) return;
    if (val && !isTypingRef.current) {
      isTypingRef.current = true;
      setTyping(room.id, user.uid, profile.handle, true);
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTypingRef.current = false;
      setTyping(room.id, user.uid, profile.handle, false);
    }, 2000);
  }, [room?.id, user?.uid, profile?.handle]);

  /* ─── Cleanup typing on unmount ─── */
  useEffect(() => () => {
    if (room && user) setTyping(room.id, user.uid, profile?.handle, false);
    clearTimeout(typingTimer.current);
  }, [room?.id]);

  const handleSend = useCallback(async (text) => {
    const t = (text || draft).trim();
    if (!t || !user || !room || sending) return;

    setSending(true);
    setSendError(false);
    const originalDraft = draft;
    setDraft("");
    setReplyTo(null);
    
    try {
      await sendMessage({
        roomId: room.id,
        uid: user.uid,
        handle: profile?.handle || "ghost_0000",
        initials: (profile?.handle || "gho").slice(0, 3).toUpperCase(),
        text: t,
        replyTo: replyTo || null,
        avatarType: profile?.avatarType || null,   // <-- Added
        avatarValue: profile?.avatarValue || null, // <-- Added
      });
      setTimeout(scrollToBottomExplicit, 80);
    } catch (e) {
      console.error("Send error:", e);
      setDraft(originalDraft); 
      setSendError(true);
      showToast(e.message === "Room is full" ? "Room is full!" : "Failed to send.", "❌");
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [draft, user, room, sending, profile, replyTo, showToast]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* Presence and Member Limit Effect */
  useEffect(() => {
    if (!room?.id || !user?.uid) return;

    let isMounted = true;

    const performJoin = async () => {
      const sessionKey = `msgIn_joined_${user.uid}_${room.id}`;
      
      if (room.createdBy === user.uid || sessionStorage.getItem(sessionKey) === "true") {
        if (isMounted) setIsFull(false);
        return;
      }

      try {
        await joinRoom(
          room.id, 
          user.uid, 
          profile?.handle || "ghost_0000",
          profile?.avatarType || null,  // <-- Added
          profile?.avatarValue || null  // <-- Added
        );
        sessionStorage.setItem(sessionKey, "true");
        if (isMounted) setIsFull(false);
      } catch (e) {
        if (isMounted && e.message === "Room is full") {
          if (sessionStorage.getItem(sessionKey) === "true") {
            setIsFull(false);
          } else {
            setIsFull(true);
          }
        }
      }
    };

    performJoin();

    return () => {
      isMounted = false;
      setTyping(room.id, user.uid, profile?.handle, false);
    };
  }, [room?.id, user?.uid]);


  /* ─── Safely Update Last Viewed Timestamp on Exit ─── */
  useEffect(() => {
    if (!room?.id) return;
    
    return () => {
      localStorage.setItem(`room_last_viewed_${room.id}`, Date.now().toString());
    };
  }, [room?.id]);

  // Inside your ChatFeed component function:
useEffect(() => {
  if (!activeRoom?.id) return;

  // Subscribe to live room metadata updates
  const unsubscribe = subscribeToRoomStats(activeRoom.id, (roomData) => {
    if (!roomData || !roomData.expiresAt) return;

    // Convert the Firestore timestamp to milliseconds
    const expiresAtMs = roomData.expiresAt.toMillis 
      ? roomData.expiresAt.toMillis() 
      : Number(roomData.expiresAt);

    const checkExpiry = () => {
      if (Date.now() > expiresAtMs) {
        console.log("Room has expired! Cleaning up active view...");
        
        // 1. Alert the user gently (Optional)
        alert("This room has expired and is no longer available.");
        
        // 2. Clear the room view instantly via the central back handler
        if (typeof onBack === "function") {
          onBack();
        } else {
          // Fallback window reload if onBack isn't accessible
          window.location.reload();
        }
      }
    };

    // Check immediately on update
    checkExpiry();

    // Set a proactive countdown timer in case they are sitting idle in the room
    const timeLeft = expiresAtMs - Date.now();
    if (timeLeft > 0) {
      const timer = setTimeout(checkExpiry, timeLeft);
      return () => clearTimeout(timer);
    }
  });

  return () => unsubscribe();
}, [activeRoom?.id, onBack]);

  const handleCloseFullModal = () => {
    setIsFull(false);
    if (onRoomFull) onRoomFull(); 
  };

  const handleExplicitLeave = async () => {
    if (window.confirm("Leave this room? You will need the link to join back.")) {
      try {
        await leaveRoom(room.id, user.uid);
        if (onLeaveClick) onLeaveClick();
      } catch (e) {
        console.error("Error leaving:", e);
      }
    }
  };
    
  if (isFull) {
    return (
      <div className="cf-modal-backdrop">
        <div className="cf-modal" style={{ borderTop: `4px solid ${room.accentColor}` }}>
          <div className="cf-modal-icon">🚫</div>
          <h2>Room is Full</h2>
          <p>
            #{room.name} has reached its limit of <strong>{room.memberLimit}</strong> members.
          </p>
          <button 
            className="cf-modal-btn primary" 
            style={{ background: room.accentColor }}
            onClick={handleCloseFullModal}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <main className="chat-feed">
        <div className="cf-no-room">
          <div className="cf-no-room-icon">💬</div>
          <p className="cf-no-room-title">No room selected</p>
          <p className="cf-no-room-sub">Use a room link to join, or create a new room.</p>
          <button className="cf-create-btn" onClick={onCreateRoom}>+ Create Room</button>
        </div>
      </main>
    );
  }

  /* Private room gate */
  if (room.privacy === "private" && !unlocked) {
    return (
      <main className="chat-feed">
        <div className="cf-topbar">
          <button className="cf-icon-btn cf-menu-btn" onClick={onMenuOpen}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <span className="cf-room-emoji">{room.emoji}</span>
          <div className="cf-room-info">
            <span className="cf-room-name" style={{ color: room.accentColor }}>#{room.name}</span>
          </div>
        </div>
        <PasswordGate room={room} onUnlock={() => setUnlocked(true)} />
      </main>
    );
  }

  const isLoading = messages === null;
  const isEmpty = Array.isArray(messages) && messages.length === 0;

  return (
    <main className="chat-feed">
      {!parentShowToast && (
        <div
          className="cf-toast"
          style={{
            opacity: localToast.visible ? 1 : 0,
            transform: localToast.visible ? "translateY(0)" : "translateY(8px)",
            pointerEvents: "none",
          }}
        >
          {localToast.message}
        </div>
      )}

      {showShareModal && (
        <ShareModal
          room={room}
          onClose={() => setShowShareModal(false)}
          showToast={showToast}
        />
      )}

      {/* Topbar */}
      <div className="cf-topbar">
        {/* Back Button */}
        <button className="cf-back-btn" onClick={onBack} aria-label="Go back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>

        <button className="cf-icon-btn cf-menu-btn" onClick={onMenuOpen}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <span className="cf-room-emoji">{room.emoji}</span>
        <div className="cf-room-info">
          <span className="cf-room-name" style={{ color: room.accentColor }}>#{room.name}</span>
          <span className="cf-room-topic">{room.topic || "Anonymous · E2E encrypted"}</span>
        </div>
        
        <div className="cf-topbar-right">
          {expiryLabel && (
            <span className="cf-expiry-badge" title="Room expires in">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              {expiryLabel}
            </span>
          )}
          
          {room.privacy === "private" && (
            <span className="cf-priv-badge">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              Private
            </span>
          )}
          <div className="cf-sub">
            <svg 
              width="14" 
              height="14" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              style={{ opacity: 0.6 }}
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className="cf-listener-ct">{room.memberCount ?? 0}</span>
          </div>
          
          <button className="cf-icon-btn" onClick={() => setShowShareModal(true)} title="Share room">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </button>
          <button className="cf-leave-btn" onClick={handleExplicitLeave} style={{ color: room.accentColor }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages Feed Viewport Container */}
      <div className="cf-feed-relative-wrapper" style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {isLoading ? (
          <SkeletonFeed />
        ) : (
          <div 
            ref={scrollContainerRef}
            className="cf-messages"
            onScroll={handleScroll}
            onClick={() => setActiveMessageId(null)}
            style={{ flex: 1, overflowY: "auto" }}
          >
            {isEmpty && <EmptyState room={room} onPrompt={handleSend} />}
            {!isEmpty && (
              <>
                <div className="cf-date-sep">
                  <span className="cf-date-line" />
                  <span className="cf-date-lbl">
                    {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                  </span>
                  <span className="cf-date-line" />
                </div>
                {(() => {
                  let firstUnreadFound = false;
                  const lastViewedTime = Number(localStorage.getItem(`room_last_viewed_${room.id}`)) || 0;

                  return messages.map((msg, i) => {
                    const msgTime = msg.createdAt?.toMillis 
                      ? msg.createdAt.toMillis() 
                      : (msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now());

                    const isUnread = msgTime > lastViewedTime && msg.uid !== user?.uid;
                    
                    let isFirstUnread = false;
                    if (isUnread && !firstUnreadFound) {
                      firstUnreadFound = true;
                      isFirstUnread = true; 
                    }

                    return (
                      <Message
                        key={msg.id}
                        ref={isFirstUnread ? firstUnreadRef : null}
                        msg={msg}
                        isMine={msg.uid === user?.uid}
                        uid={user?.uid}
                        roomId={room.id}
                        prevUid={i > 0 ? messages[i - 1].uid : null}
                        accentColor={room.accentColor || "var(--pink)"}
                        onReply={setReplyTo}
                        showToast={showToast}
                        isFocused={activeMessageId === msg.id}
                        onToggleFocus={(id) => setActiveMessageId(activeMessageId === id ? null : id)}
                      />
                    );
                  });
                })()}
                <TypingBar typers={typers} />
                <div ref={bottomRef} style={{ height: 4 }} />
              </>
            )}
          </div>
        )}

        {/* Floating Scroll To Bottom Button */}
        {showScrollBtn && (
          <button 
            className="cf-scroll-bottom-btn"
            onClick={scrollToBottomExplicit}
            style={{
              position: "absolute",
              bottom: "16px",
              right: "16px",
              background: room.accentColor,
              zIndex: 10
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        )}
      </div>
    

      {/* Input area */}
      <div className="cf-input-area">
        <ReplyQuote replyTo={replyTo} onClear={() => setReplyTo(null)} />
        {sending && <div className="cf-send-status">Sending...</div>}
        {sendError && <div className="cf-send-status error">Failed to send. Tap send to retry.</div>}
        <div className="cf-input-box" style={{ borderColor: draft ? `${room.accentColor}45` : undefined }}>
          <textarea
            ref={textareaRef}
            className="cf-ta"
            placeholder={`Message #${room.name}…`}
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
            disabled={sending}
          />
          <button
            className={`cf-send${draft.trim() ? " ready" : ""}`}
            style={draft.trim() ? { background: room.accentColor, boxShadow: `0 0 14px ${room.accentColor}40` } : {}}
            onClick={() => handleSend()}
            disabled={!draft.trim() || sending}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
        <div className="cf-input-meta">
          <div className="cf-anon">
            <span className="cf-anon-dot" style={{ background: room.accentColor }} />
            {profile?.handle || "ghost_0000"}
          </div>
          <span className="cf-hint">Enter to send · Shift+Enter new line</span>
        </div>
      </div>
    </main>
  );
}