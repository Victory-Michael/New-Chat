import React, { useState } from "react";
import "./Sidebar.css";

const NAV_ICONS = {
  feed: "M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z",
  anon: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0",
  pulse:"M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
};

export default function Sidebar({
  user, profile, theme, toggleTheme,
  rooms, activeRoom, onSelectRoom, onCreateRoom,
  isOpen, onClose,
}) {
  const [activeNav, setActiveNav] = useState("feed");
  const score = profile?.score ?? 0;
  const pct   = Math.min(100, Math.round((score / 500) * 100));
  const handle= profile?.handle ?? "ghost_0000";

  return (
    <aside className={`sidebar${isOpen ? " open" : ""}`}>

      {/* Wordmark */}
      <div className="sb-wordmark">
        <div className="sb-logo">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 3h8M2 6h5M2 9h7" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <span className="sb-brand sb-text">MsgIn</span>
        <span className="sb-env-badge sb-text sb-label">BETA</span>
        <button className="sb-theme-btn" onClick={toggleTheme} title="Toggle theme">
          {theme === "light"
            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>
          }
        </button>
      </div>

      {/* Profile */}
      <div className="sb-profile">
        <div className="sb-av">
          {handle.slice(0, 2).toUpperCase()}
          <span className="sb-online-pip" />
        </div>
        <div className="sb-profile-text sb-text">
          <span className="sb-username">{handle}</span>
          <span className="sb-role">{profile?.tier || "anon"} · {score} pts</span>
        </div>
        <button className="sb-more-btn sb-more-btn sb-text">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="5"  r="1" fill="currentColor" stroke="none"/>
            <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>
            <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/>
          </svg>
        </button>
      </div>

      {/* Nav */}
      <div className="sb-section-lbl sb-text sb-label">Navigate</div>
      <nav className="sb-nav">
        {Object.entries(NAV_ICONS).map(([id, path]) => (
          <button
            key={id}
            className={`sb-nav-item${activeNav === id ? " act" : ""}`}
            onClick={() => setActiveNav(id)}
          >
            <svg className="sb-nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d={path}/>
            </svg>
            <span className="sb-nav-label sb-text sb-label">
              {id === "feed" ? "Message Feed" : id === "anon" ? "Anonymous" : "Pulse"}
            </span>
          </button>
        ))}
      </nav>

      {/* Rooms */}
      <div className="sb-rooms-header">
        <span className="sb-section-lbl sb-text sb-label">Rooms</span>
        <button className="sb-create-btn" onClick={onCreateRoom} title="Create room">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>

      <div className="sb-ch-list">
        {rooms.length === 0 && (
          <div className="sb-no-rooms sb-text">
            <p>No rooms yet.</p>
            <button className="sb-create-first" onClick={onCreateRoom}>Create the first one →</button>
          </div>
        )}
        {rooms.map(room => (
          <button
            key={room.id}
            className={`sb-ch-item${activeRoom?.id === room.id ? " act" : ""}`}
            onClick={() => onSelectRoom(room)}
            style={activeRoom?.id === room.id ? {
              background: `${room.accentColor}12`,
              borderColor: `${room.accentColor}30`,
            } : {}}
          >
            <span className="sb-ch-emoji">{room.emoji || "💬"}</span>
            <span className="sb-ch-name sb-text">{room.name}</span>
            {room.lastMessage && (
              <span className="sb-ch-preview sb-text">{room.lastMessage}</span>
            )}
            {room.privacy === "private" && (
              <svg className="sb-lock-ico" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
            )}
            {/* Active accent bar */}
            {activeRoom?.id === room.id && (
              <div className="sb-ch-bar" style={{ background: room.accentColor }} />
            )}
          </button>
        ))}
      </div>

      {/* Score */}
      <div className="sb-score-section sb-text">
        <div className="sb-sc-row">
          <span className="sb-sc-lbl">MsgIn Score</span>
          <span className="sb-sc-val">{score.toLocaleString()}</span>
        </div>
        <div className="sb-sc-track">
          <div className="sb-sc-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="sb-sc-meta">
          <span>Rank #12</span>
          <span>{pct}% to next tier</span>
        </div>
      </div>

    </aside>
  );
}