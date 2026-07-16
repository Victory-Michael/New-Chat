import React, { useState, useEffect } from "react";
import { subscribeToPresence, subscribeToRoomStats, updateHeartbeat } from "./firebase";
import "./Details.css";

/* ─── Sparkline: real message-count history ─────────────── */
function Sparkline({ history, color }) {
  if (!history.length) return null;
  const maxV = Math.max(...history, 1);
  return (
    <div className="det-spark">
      {history.map((v, i) => (
        <div
          key={i}
          className="det-spark-b"
          style={{
            height: `${Math.max(4, (v / maxV) * 100)}%`,
            background: i === history.length - 1 ? color : "var(--pink-soft)",
            opacity: 0.3 + (i / history.length) * 0.7,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Expiry display ─────────────────────────────────────── */
function useExpiry(expiresAt) {
  const [label, setLabel] = useState("");
  const [pct, setPct] = useState(100);

  useEffect(() => {
    if (!expiresAt) return;
    const expMs = expiresAt?.toMillis ? expiresAt.toMillis() : Number(expiresAt);
    const TOTAL = 24 * 60 * 60 * 1000;

    const tick = () => {
      const diff = expMs - Date.now();
      if (diff <= 0) {
        setLabel("Expired");
        setPct(0);
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setLabel(`${h}h ${m.toString().padStart(2, "0")}m remaining`);
      setPct(Math.round((diff / TOTAL) * 100));
    };

    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return { label, pct };
}

export default function Details({ user, room, profile }) {
  const [presence, setPresence] = useState([]);
  const [roomStats, setRoomStats] = useState(null);
  const [msgHistory, setMsgHistory] = useState([]);

  const expiry = useExpiry(room?.expiresAt);
  const accentColor = room?.accentColor || "var(--indigo)";

  /* ─── Real presence ─── */
  useEffect(() => {
    if (!room) { setPresence([]); return; }
    const unsub = subscribeToPresence(room.id, setPresence);
    return unsub;
  }, [room?.id]);

  /* ─── Real room stats ─── */
  useEffect(() => {
    if (!room) { setRoomStats(null); setMsgHistory([]); return; }
    const unsub = subscribeToRoomStats(room.id, (data) => {
      setRoomStats(data);
      setMsgHistory((h) => {
        const next = [...h, data.messageCount ?? 0];
        return next.slice(-20);
      });
    });
    return unsub;
  }, [room?.id]);

  /* ─── Heartbeat & Name Sync ─── */
  useEffect(() => {
    if (!room?.id || !user?.uid) return;

    const currentHandle = profile?.handle || user?.handle || user?.displayName || "Ghost"; 

    updateHeartbeat(
      room.id, 
      user.uid, 
      currentHandle,
      profile?.avatarType || null, // <-- Added
      profile?.avatarValue || null // <-- Added
    );

    const interval = setInterval(() => {
      updateHeartbeat(
        room.id, 
        user.uid, 
        currentHandle,
        profile?.avatarType || null, // <-- Added
        profile?.avatarValue || null // <-- Added
      );
    }, 30000);

    return () => clearInterval(interval);
  }, [room?.id, user?.uid, profile?.handle, profile?.avatarType, profile?.avatarValue, user?.handle, user?.displayName]);


    
  // ─── CRITICAL CHANGE: Compute Active Members globally for this component ───
  const activeMembers = presence.filter((p) => {
    if (!p.lastSeen) return true; // Show immediately if timestamp hasn't processed yet
    const lastSeenMs = p.lastSeen?.toMillis ? p.lastSeen.toMillis() : Date.now();
    return Date.now() - lastSeenMs < 45000; // 45-second boundary
  });

  return (
    <aside className="det">
      {/* Header */}
      <div className="det-hd">
        <span className="det-title">{room ? `#${room.name}` : "Overview"}</span>
        <span className="det-live">
          <span className="det-ld" style={{ background: accentColor }} />
          LIVE
        </span>
      </div>

      {!room ? (
        <div className="det-no-room">
          <span>Select a room to see details</span>
        </div>
      ) : (
        <>
          {/* ─── Room Stats ─── */}
          <div className="det-sec">
            <div className="det-lbl">Room Stats</div>
            <div className="det-stats">
              <div className="det-stat">
                <div className="det-sl">Online Now</div>
                {/* Fixed: This now reads from the filtered array count */}
                <div className="det-sv" style={{ color: accentColor }}>
                  {activeMembers.length} 
                </div>
              </div>
              <div className="det-stat">
                <div className="det-sl">Messages</div>
                <div className="det-sv" style={{ color: "var(--pink)" }}>
                  {roomStats?.messageCount ?? 0}
                </div>
              </div>
              <div className="det-stat">
                <div className="det-sl">Member Limit</div>
                <div className="det-sv">{roomStats?.memberLimit ?? "—"}</div>
              </div>
              <div className="det-stat">
                <div className="det-sl">Privacy</div>
                <div
                  className="det-sv"
                  style={{ fontSize: 13, textTransform: "capitalize" }}
                >
                  {roomStats?.privacy ?? "—"}
                </div>
              </div>
            </div>

            {/* Message activity sparkline */}
            {msgHistory.length > 1 && (
              <div className="det-spark-wrap">
                <div className="det-spark-hd">
                  <span className="det-spark-lbl">Message activity</span>
                  <span className="det-spark-val" style={{ color: "var(--pink)" }}>
                    {roomStats?.messageCount ?? 0} total
                  </span>
                </div>
                <Sparkline history={msgHistory} color="var(--pink)" />
              </div>
            )}
          </div>

          {/* ─── 24h Expiry ─── */}
          <div className="det-sec">
            <div className="det-lbl">Room Expiry</div>
            <div className="det-enc" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                <div>
                  <div className="det-et">Auto-deletes in</div>
                  <div className="det-es" style={{ marginTop: 2, color: expiry.pct < 20 ? "#EF4444" : "var(--text-3)" }}>
                    {expiry.label || "—"}
                  </div>
                </div>
                <span
                  className="det-eck"
                  style={expiry.pct < 20 ? { color: "#EF4444", borderColor: "rgba(239,68,68,.3)", background: "rgba(239,68,68,.08)" } : {}}
                >
                  {expiry.pct}%
                </span>
              </div>
              {/* Progress bar */}
              <div style={{ width: "100%", height: 3, background: "var(--border-soft)", borderRadius: 99, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${expiry.pct}%`,
                    height: "100%",
                    background: expiry.pct < 20 ? "#EF4444" : accentColor,
                    borderRadius: 99,
                    transition: "width 1s linear",
                  }}
                />
              </div>
              <p style={{ fontSize: 9.5, color: "var(--text-3)", margin: 0 }}>
                All messages and the room itself are permanently deleted after 24 hours.
              </p>
            </div>
          </div>

          {/* ─── Live presence list ─── */}
          <div className="det-sec">
            <div className="det-lbl">
              Online Now — {activeMembers.length}{" "}
              {activeMembers.length === 1 ? "person" : "people"}
            </div>

            {activeMembers.length === 0 ? (
              <p className="det-empty">No one else here yet</p>
            ) : (
              activeMembers.map((p) => (
                <div key={p.uid} className="det-member">
                  <div className="det-mav" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {p.avatarType === "dicebear" ? (
                      <img 
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${p.avatarValue}`} 
                        alt="avatar" 
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      p.avatarValue || p.handle?.slice(0, 3).toUpperCase() || "GHO"
                    )}
                    
                  </div>
                  <span className="det-mname">{p.handle}</span>
                  {p.uid === user?.uid && (
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 9,
                        color: "var(--text-3)",
                        background: "var(--bg-active)",
                        padding: "1px 5px",
                        borderRadius: 3,
                      }}
                    >
                      you
                    </span>
                  )}
                </div>
              ))
            )}
          </div>


          {/* ─── Room Info ─── */}
          <div className="det-sec">
            <div className="det-lbl">Room Info</div>
            <div className="det-enc">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--indigo)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <div>
                <div className="det-et">End-to-end encrypted</div>
                <div className="det-es">
                  Creator: {roomStats?.creatorHandle || "—"}
                </div>
              </div>
              <span className="det-eck">E2E</span>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}