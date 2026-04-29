import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  sendMessage, subscribeToMessages, toggleReaction,
  deleteMessage, setTyping, subscribeToTyping,
  verifyRoomPassword,
} from "./firebase";
import { fmtTime } from "./useRoomExpiry";
import "./ChatFeed.css";

/* ─── Relative time ──────────────────────────────────────── */
function relTime(ts) {
  if (!ts) return "";
  const d    = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 5)    return "just now";
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* ─── Burn-on-read wrapper ───────────────────────────────── */
function BurnMessage({ msg, roomId, isMine, burnOnRead, children }) {
  const ref      = useRef(null);
  const timerRef = useRef(null);
  const [burning, setBurning] = useState(false);

  useEffect(() => {
    if (!burnOnRead || isMine) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !timerRef.current) {
        timerRef.current = setTimeout(async () => {
          setBurning(true);
          await new Promise(r => setTimeout(r, 500));
          await deleteMessage(roomId, msg.id);
        }, 10_000); // 10s after seen
      }
    }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => { obs.disconnect(); clearTimeout(timerRef.current); };
  }, [burnOnRead, isMine, roomId, msg.id]);

  return (
    <div ref={ref} className={`burn-wrapper${burning ? " burning" : ""}`}>
      {children}
      {burnOnRead && !isMine && timerRef.current && !burning && (
        <div className="burn-timer" />
      )}
    </div>
  );
}

/* ─── Empty state ────────────────────────────────────────── */
function EmptyState({ room, onPrompt }) {
  const prompts = [
    "Drop something into the void.",
    "Be the first signal.",
    "What's on your mind?",
    "No name. No trace.",
  ];
  return (
    <div className="cf-empty">
      <div className="cf-empty-icon">{room?.emoji || "💬"}</div>
      <p className="cf-empty-title">#{room?.name || "room"}</p>
      <p className="cf-empty-sub">
        {room?.topic || "No topic."}<br />No messages yet.
      </p>
      <div className="cf-prompts">
        {prompts.map(p => (
          <button key={p} className="cf-prompt" onClick={() => onPrompt(p)}>{p}</button>
        ))}
      </div>
    </div>
  );
}

/* ─── Single message bubble ──────────────────────────────── */
function Bubble({ msg, isMine, uid, roomId, accentColor, prevUid, onReply, burnOnRead }) {
  const isCompact = prevUid === msg.uid && !msg.isSystem;
  const reactions = msg.reactions || {};

  const handleReact = async (emoji) => toggleReaction(roomId, msg.id, emoji, uid);
  const handleCopy  = () => navigator.clipboard?.writeText(msg.text).catch(() => {});
  const handleDel   = async () => {
    if (confirm("Delete this message?")) deleteMessage(roomId, msg.id);
  };

  if (msg.isSystem) return (
    <div className="cf-system-msg" style={{ animation: "system-msg-in 0.3s ease" }}>
      <span className="cf-system-icon">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      </span>
      {msg.text}
    </div>
  );

  return (
    <BurnMessage msg={msg} roomId={roomId} isMine={isMine} burnOnRead={burnOnRead}>
      <div className={`cf-msg${isMine ? " mine" : ""}${isCompact ? " compact" : ""}`}>
        <div
          className={`cf-av${isMine ? " mine" : ""}`}
          style={isMine ? { background: `${accentColor}20`, borderColor: `${accentColor}40`, color: accentColor } : {}}
        >
          {isCompact ? null : (msg.initials || "GH")}
        </div>
        <div className="cf-body">
          {!isCompact && (
            <div className="cf-head">
              <span className="cf-sender" style={isMine ? { color: accentColor } : {}}>
                {isMine ? "You" : msg.handle}
              </span>
              <span className="cf-ts">{relTime(msg.createdAt)}</span>
            </div>
          )}
          {msg.replyTo && (
            <div className="cf-reply-ref">
              <span className="cf-rr-bar" />
              <span className="cf-rr-who">{msg.replyTo.handle}</span>
              <span className="cf-rr-text">{msg.replyTo.text}</span>
            </div>
          )}
          {/* Equal-size bubble for all */}
          <div
            className={`cf-bubble${isMine ? " mine" : ""}`}
            style={isMine ? { background: `${accentColor}18`, borderColor: `${accentColor}35` } : {}}
          >
            <p className="cf-text">{msg.text}</p>
          </div>
          {Object.entries(reactions).filter(([,v]) => v.count > 0).length > 0 && (
            <div className="cf-rxns">
              {Object.entries(reactions)
                .filter(([,v]) => v.count > 0)
                .map(([emoji, data]) => (
                  <button
                    key={emoji}
                    className={`cf-rxn${data.voters?.includes(uid) ? " active" : ""}`}
                    onClick={() => handleReact(emoji)}
                  >
                    {emoji}<span>{data.count}</span>
                  </button>
                ))}
            </div>
          )}
        </div>
        {/* Hover actions */}
        <div className="cf-acts">
          {["👍","🔥","👻","⚡"].map(e => (
            <button key={e} className="cf-act" onClick={() => handleReact(e)}>{e}</button>
          ))}
          <button className="cf-act ico" onClick={() => onReply({ id: msg.id, handle: isMine ? "You" : msg.handle, text: msg.text })} title="Reply">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/>
            </svg>
          </button>
          <button className="cf-act ico" onClick={handleCopy} title="Copy">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
          </button>
          {isMine && (
            <button className="cf-act ico danger" onClick={handleDel} title="Delete">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </BurnMessage>
  );
}

/* ─── Password gate ──────────────────────────────────────── */
function PwGate({ room, onUnlock }) {
  const [pw,  setPw]  = useState("");
  const [err, setErr] = useState(false);
  const check = async () => {
    const ok = await verifyRoomPassword(room.id, pw);
    if (ok) onUnlock();
    else { setErr(true); setTimeout(() => setErr(false), 1800); }
  };
  return (
    <div className="cf-empty">
      <div className="cf-empty-icon">🔒</div>
      <p className="cf-empty-title">Private Room</p>
      <p className="cf-empty-sub">#{room.name} requires a password.</p>
      <div className={`pw-row${err ? " err" : ""}`}>
        <input className="pw-input" type="text" placeholder="Enter password"
          value={pw} onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === "Enter" && check()} autoFocus />
        <button className="pw-btn" onClick={check}>Enter</button>
      </div>
      {err && <p className="pw-err">Wrong password</p>}
    </div>
  );
}

/* ─── Main ChatFeed ──────────────────────────────────────── */
export default function ChatFeed({ user, profile, room, phase, secondsLeft, onMenuOpen, onCreateRoom, showToast }) {
  const [messages,  setMessages]  = useState(null);
  const [draft,     setDraft]     = useState("");
  const [sending,   setSending]   = useState(false);
  const [typers,    setTypers]    = useState([]);
  const [replyTo,   setReplyTo]   = useState(null);
  const [unlocked,  setUnlocked]  = useState(false);
  const [atBottom,  setAtBottom]  = useState(true);
  const [newMsgCt,  setNewMsgCt]  = useState(0);

  const msgAreaRef  = useRef(null);
  const textareaRef = useRef(null);
  const typingTimer = useRef(null);
  const isTypingRef = useRef(false);
  const prevMsgLen  = useRef(0);

  const accentColor = room?.accentColor || "var(--pink)";

  useEffect(() => { setUnlocked(false); setReplyTo(null); setMessages(null); }, [room?.id]);

  /* ── Subscribe messages ─────────────────────────── */
  useEffect(() => {
    if (!room || (room.privacy === "private" && !unlocked)) return;
    const unsub = subscribeToMessages(room.id, (msgs) => {
      setMessages(msgs);
      // Unread pill logic
      if (msgs.length > prevMsgLen.current && !atBottom) {
        setNewMsgCt(n => n + (msgs.length - prevMsgLen.current));
      }
      prevMsgLen.current = msgs.length;
    });
    return unsub;
  }, [room?.id, unlocked]);

  /* ── Subscribe typing ───────────────────────────── */
  useEffect(() => {
    if (!room || !user) return;
    const unsub = subscribeToTyping(room.id, user.uid, setTypers);
    return unsub;
  }, [room?.id, user?.uid]);

  /* ── Smart auto-scroll ──────────────────────────── */
  useEffect(() => {
    const area = msgAreaRef.current;
    if (!area || !messages?.length) return;
    if (atBottom) {
      area.scrollTo({ top: area.scrollHeight, behavior: "smooth" });
      setNewMsgCt(0);
    }
  }, [messages]);

  const handleScroll = useCallback(() => {
    const area = msgAreaRef.current;
    if (!area) return;
    const distFromBottom = area.scrollHeight - area.scrollTop - area.clientHeight;
    const isNearBottom   = distFromBottom < 150;
    setAtBottom(isNearBottom);
    if (isNearBottom) setNewMsgCt(0);
  }, []);

  const scrollToBottom = () => {
    msgAreaRef.current?.scrollTo({ top: msgAreaRef.current.scrollHeight, behavior: "smooth" });
    setNewMsgCt(0); setAtBottom(true);
  };

  /* ── Dynamic textarea height ────────────────────── */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 104)}px`; // ~5 lines
  }, [draft]);

  /* ── Typing indicator ───────────────────────────── */
  const handleDraftChange = useCallback((val) => {
    setDraft(val);
    if (!room || !user) return;
    if (val && !isTypingRef.current) {
      isTypingRef.current = true;
      setTyping(room.id, user.uid, profile?.handle, true);
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTypingRef.current = false;
      setTyping(room.id, user.uid, profile?.handle, false);
    }, 2000);
  }, [room?.id, user?.uid, profile?.handle]);

  useEffect(() => () => {
    clearTimeout(typingTimer.current);
    if (room && user) setTyping(room.id, user.uid, profile?.handle, false);
  }, [room?.id]);

  /* ── Send ───────────────────────────────────────── */
  const handleSend = useCallback(async (text) => {
    const t = (text || draft).trim();
    if (!t || !user || !room || sending) return;
    setSending(true);
    setDraft("");
    setReplyTo(null);
    isTypingRef.current = false;
    setTyping(room.id, user.uid, profile?.handle, false);
    try {
      await sendMessage({
        roomId: room.id, uid: user.uid,
        handle: profile?.handle || "ghost_0000",
        initials: (profile?.handle || "gh").slice(0, 2).toUpperCase(),
        text: t, replyTo: replyTo || null,
      });
      // Scroll to bottom after sending
      setTimeout(scrollToBottom, 50);
    } catch (e) { console.error("Send:", e); }
    finally { setSending(false); textareaRef.current?.focus(); }
  }, [draft, user, room, sending, profile, replyTo]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  /* ── Share link ─────────────────────────────────── */
  const handleShare = () => {
    const link = `${window.location.origin}/${room.id}`;
    navigator.clipboard?.writeText(link).then(() => {
      showToast?.("Link copied!", "🔗");
    }).catch(() => showToast?.("Copy failed", "⚠"));
  };

  /* ── No room ─────────────────────────────────────── */
  if (!room) return (
    <main className="chat-feed">
      <div className="cf-empty">
        <div className="cf-empty-icon">💬</div>
        <p className="cf-empty-title">No room selected</p>
        <p className="cf-empty-sub">Create or join a room to start.</p>
        <button className="cf-create-btn" onClick={onCreateRoom}>+ Create Room</button>
      </div>
    </main>
  );

  /* ── Private gate ───────────────────────────────── */
  if (room.privacy === "private" && !unlocked) return (
    <main className="chat-feed">
      <TopBar room={room} phase={phase} secondsLeft={secondsLeft} onMenu={onMenuOpen} onShare={handleShare} />
      <PwGate room={room} onUnlock={() => setUnlocked(true)} />
    </main>
  );

  const isLoading  = messages === null;
  const isEmpty    = Array.isArray(messages) && messages.length === 0;

  return (
    <main className={`chat-feed${phase !== "normal" ? ` phase-${phase}` : ""}`}>
      <TopBar room={room} phase={phase} secondsLeft={secondsLeft} onMenu={onMenuOpen} onShare={handleShare} />

      {/* Messages */}
      <div className="cf-msgs" ref={msgAreaRef} onScroll={handleScroll}>
        {isLoading && <div className="cf-loading"><span/><span/><span/></div>}
        {!isLoading && isEmpty && <EmptyState room={room} onPrompt={handleSend} />}
        {!isLoading && !isEmpty && (
          <>
            <div className="cf-date-sep">
              <span /><span className="cf-date-lbl">
                {new Date().toLocaleDateString("en-US", { weekday:"long", month:"short", day:"numeric" })}
              </span><span />
            </div>
            {messages.map((msg, i) => (
              <Bubble
                key={msg.id}
                msg={msg}
                isMine={msg.uid === user?.uid}
                uid={user?.uid}
                roomId={room.id}
                prevUid={i > 0 ? messages[i-1].uid : null}
                accentColor={accentColor}
                onReply={setReplyTo}
                burnOnRead={room.burnOnRead}
              />
            ))}
            {typers.length > 0 && (
              <div className="cf-typing">
                <span className="cf-typing-dots"><i/><i/><i/></span>
                <span>{typers.length === 1 ? `${typers[0].handle} is typing` : `${typers.length} people typing`}…</span>
              </div>
            )}
            <div style={{ height: 4 }} />
          </>
        )}
      </div>

      {/* New messages pill */}
      {newMsgCt > 0 && !atBottom && (
        <button className="cf-new-pill" onClick={scrollToBottom}>
          ↓ {newMsgCt} new message{newMsgCt > 1 ? "s" : ""}
        </button>
      )}

      {/* Input */}
      <div className="cf-input-area">
        {replyTo && (
          <div className="cf-reply-bar">
            <div className="cf-rb-line" />
            <div className="cf-rb-body">
              <span className="cf-rb-who">{replyTo.handle}</span>
              <span className="cf-rb-text">{replyTo.text}</span>
            </div>
            <button className="cf-rb-close" onClick={() => setReplyTo(null)}>✕</button>
          </div>
        )}
        <div className="cf-input-box" style={{ borderColor: draft ? `${accentColor}45` : "var(--border-mid)" }}>
          <textarea
            ref={textareaRef}
            className="cf-ta"
            placeholder={`Message #${room.name}…`}
            value={draft}
            onChange={e => handleDraftChange(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
            disabled={sending || phase === "dead"}
          />
          <button
            className={`cf-send${draft.trim() ? " ready" : ""}`}
            style={draft.trim() ? { background: accentColor, boxShadow: `0 0 12px ${accentColor}40` } : {}}
            onClick={() => handleSend()}
            disabled={!draft.trim() || sending}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
        <div className="cf-meta">
          <div className="cf-anon">
            <span className="cf-anon-dot" style={{ background: accentColor }} />
            {profile?.handle || "ghost_0000"}
          </div>
          <span className="cf-hint">Enter to send · Shift+Enter new line</span>
        </div>
      </div>
    </main>
  );
}

/* ─── TopBar extracted ───────────────────────────────────── */
function TopBar({ room, phase, secondsLeft, onMenu, onShare }) {
  const { fmtTime } = require("./useRoomExpiry");
  const isWarning = phase !== "normal";
  return (
    <div className={`cf-topbar${isWarning ? " warning" : ""}`}
         style={isWarning ? { borderBottomColor: `${room?.accentColor || "var(--pink)"}60` } : {}}>
      <button className="cf-icon-btn cf-menu-btn" onClick={onMenu}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <span className="cf-room-emoji">{room?.emoji || "💬"}</span>
      <div className="cf-room-info">
        <span className="cf-room-name" style={{ color: room?.accentColor }}>#{room?.name}</span>
        <span className="cf-room-sub">{room?.topic || "anonymous · e2e encrypted"}</span>
      </div>
      <div className="cf-topbar-right">
        {secondsLeft !== null && (
          <div className={`cf-expiry${isWarning ? " warn" : ""}`} title="Room expires in">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {fmtTime(secondsLeft)}
          </div>
        )}
        <button className="cf-icon-btn" onClick={onShare} title="Share room link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
        </button>
      </div>
    </div>
  );
}