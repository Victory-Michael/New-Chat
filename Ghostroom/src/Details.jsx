import React, { useState, useEffect } from "react";
import { subscribeToPresence } from "./firebase";
import "./Details.css";

const ALERTS = [
  { id:1, user:"shadow_verb", action:"Screenshot attempt", room:"#void",   time:"11:51", status:"blocked" },
  { id:2, user:"anon_7749",   action:"Screen recording",   room:"#liminal", time:"11:38", status:"blocked" },
  { id:3, user:"null_ptr",    action:"Clipboard copy",     room:"#ghost",   time:"11:12", status:"warned"  },
  { id:4, user:"mirror_0",    action:"Screen recording",   room:"#pulse",   time:"10:30", status:"allowed" },
];

function useLive(init) {
  const [val, setVal] = useState(init);
  const [hist, setHist] = useState(() => Array.from({length:20}, () => Math.floor(Math.random()*55+30)));
  useEffect(() => {
    const id = setInterval(() => {
      setVal(v => {
        const n = Math.max(100, Math.min(999, v + Math.floor(Math.random()*26-13)));
        setHist(h => [...h.slice(1), Math.floor(Math.random()*55+30)]);
        return n;
      });
    }, 2500);
    return () => clearInterval(id);
  }, []);
  return { val, hist };
}

export default function Details({ user, room }) {
  const [presence, setPresence] = useState([]);
  const pulse = useLive(742);
  const listeners = useLive(847);
  const maxH = Math.max(...pulse.hist);

  useEffect(() => {
    if (!room) return;
    const unsub = subscribeToPresence(room.id, setPresence);
    return unsub;
  }, [room?.id]);

  const accentColor = room?.accentColor || "var(--indigo)";

  return (
    <aside className="det">

      {/* Header */}
      <div className="det-hd">
        <span className="det-title">{room ? `#${room.name}` : "Overview"}</span>
        <span className="det-live"><span className="det-ld" style={{ background: accentColor }} />LIVE</span>
      </div>

      {/* Stats */}
      <div className="det-sec">
        <div className="det-lbl">Room Analytics</div>
        <div className="det-stats">
          <div className="det-stat">
            <div className="det-sl">Listeners</div>
            <div className="det-sv" style={{ color: accentColor }}>{listeners.val.toLocaleString()}</div>
          </div>
          <div className="det-stat">
            <div className="det-sl">Pulse</div>
            <div className="det-sv" style={{ color: "var(--pink)" }}>{pulse.val}</div>
          </div>
        </div>
        {/* Sparkline */}
        <div className="det-spark-wrap">
          <div className="det-spark-hd">
            <span className="det-spark-lbl">Pulse trend</span>
            <span className="det-spark-val" style={{ color: "var(--pink)" }}>{pulse.val} bpm</span>
          </div>
          <div className="det-spark">
            {pulse.hist.map((v, i) => (
              <div key={i} className="det-spark-b"
                   style={{
                     height: `${(v/maxH)*100}%`,
                     background: i === pulse.hist.length-1 ? "var(--pink)" : "var(--pink-soft)",
                     opacity: 0.3 + (i/pulse.hist.length)*0.7,
                   }} />
            ))}
          </div>
        </div>
      </div>

      {/* Live presence */}
      <div className="det-sec">
        <div className="det-lbl">
          Online Now — {presence.length} {presence.length === 1 ? "person" : "people"}
        </div>
        {presence.length === 0
          ? <p className="det-empty">No one else here yet</p>
          : presence.map(p => (
            <div key={p.uid} className="det-member">
              <div className="det-mav">
                {p.handle?.slice(0, 2).toUpperCase() || "GH"}
                <span className="det-mpip" style={{ background: accentColor }} />
              </div>
              <span className="det-mname">{p.handle}</span>
            </div>
          ))
        }
      </div>

      {/* Screenshot alerts */}
      <div className="det-sec">
        <div className="det-lbl">Screenshot Alerts — {ALERTS.filter(a=>a.status==="blocked").length} blocked</div>
        {ALERTS.map(a => (
          <div key={a.id} className="det-alert">
            <div className={`det-aic ${a.status}`}>
              {a.status === "blocked" && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
              {a.status === "warned"  && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>}
              {a.status === "allowed" && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
            </div>
            <div className="det-ab">
              <div className="det-aw">{a.user}</div>
              <div className="det-aa">{a.action} · {a.room}</div>
            </div>
            <div className="det-ar">
              <span className="det-at">{a.time}</span>
              <span className={`det-abg ${a.status}`}>{a.status}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Security */}
      <div className="det-sec">
        <div className="det-lbl">Security</div>
        <div className="det-enc">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--indigo)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <div>
            <div className="det-et">End-to-end encrypted</div>
            <div className="det-es">AES-256 · identity masked</div>
          </div>
          <span className="det-eck">ACTIVE</span>
        </div>
      </div>

    </aside>
  );
}