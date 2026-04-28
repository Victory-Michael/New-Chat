import React, { useState } from "react";
import { createRoom } from "./firebase";
import "./RoomModal.css";

const EMOJIS = ["💬","🔥","👻","⚡","🌀","🎯","🔮","🌑","📡","🧬","🛸","🌊","🎭","🔒","🧠","🌐"];
const COLORS = [
  "#EC4899","#6366F1","#F59E0B","#10B981","#EF4444",
  "#8B5CF6","#06B6D4","#F97316","#84CC16","#E879F9",
];

const STEPS = ["Name & Topic", "Identity", "Access", "Preview"];

export default function RoomModal({ user, profile, onCreated, onClose }) {
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    topic: "",
    emoji: "💬",
    accentColor: "#EC4899",
    privacy: "public",
    password: "",
    memberLimit: 50,
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const canNext = () => {
    if (step === 0) return form.name.trim().length >= 2;
    if (step === 2 && form.privacy === "private") return form.password.trim().length >= 4;
    return true;
  };

  const handleCreate = async () => {
    setCreating(true);
    setError("");
    try {
      const id = await createRoom({
        ...form,
        createdBy: user.uid,
        creatorHandle: profile.handle,
      });
      onCreated({ id, ...form });
    } catch (e) {
      setError("Something went wrong. Try again.");
      setCreating(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">

        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-row">
            <span className="modal-title">Create a Room</span>
            <button className="modal-close" onClick={onClose}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          {/* Step indicator */}
          <div className="modal-steps">
            {STEPS.map((s, i) => (
              <div key={s} className={`modal-step${i === step ? " cur" : i < step ? " done" : ""}`}>
                <div className="modal-step-dot">
                  {i < step
                    ? <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    : i + 1
                  }
                </div>
                <span className="modal-step-label">{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="modal-body">

          {/* ── Step 0: Name & Topic ─── */}
          {step === 0 && (
            <div className="modal-step-content">
              <div className="field">
                <label className="field-label">Room name <span className="req">*</span></label>
                <div className="field-input-row">
                  <span className="field-prefix">#</span>
                  <input
                    className="field-input"
                    placeholder="e.g. void-channel"
                    value={form.name}
                    onChange={e => set("name", e.target.value)}
                    maxLength={32}
                    autoFocus
                  />
                  <span className="field-count">{form.name.length}/32</span>
                </div>
                <p className="field-hint">Lowercase letters, numbers and hyphens only.</p>
              </div>
              <div className="field">
                <label className="field-label">Topic <span className="opt">(optional)</span></label>
                <input
                  className="field-input full"
                  placeholder="What's this room about?"
                  value={form.topic}
                  onChange={e => set("topic", e.target.value)}
                  maxLength={80}
                />
              </div>
            </div>
          )}

          {/* ── Step 1: Identity ─────── */}
          {step === 1 && (
            <div className="modal-step-content">
              <div className="field">
                <label className="field-label">Room icon</label>
                <div className="emoji-grid">
                  {EMOJIS.map(e => (
                    <button
                      key={e}
                      className={`emoji-btn${form.emoji === e ? " sel" : ""}`}
                      onClick={() => set("emoji", e)}
                    >{e}</button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label className="field-label">Accent color</label>
                <div className="color-grid">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      className={`color-btn${form.accentColor === c ? " sel" : ""}`}
                      style={{ background: c }}
                      onClick={() => set("accentColor", c)}
                    >
                      {form.accentColor === c && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              {/* Preview badge */}
              <div className="field">
                <label className="field-label">Preview</label>
                <div className="room-preview-badge" style={{ borderColor: `${form.accentColor}40`, background: `${form.accentColor}10` }}>
                  <span className="rpb-emoji">{form.emoji}</span>
                  <div>
                    <div className="rpb-name" style={{ color: form.accentColor }}>#{form.name || "room-name"}</div>
                    <div className="rpb-topic">{form.topic || "No topic set"}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Access ───────── */}
          {step === 2 && (
            <div className="modal-step-content">
              <div className="field">
                <label className="field-label">Privacy</label>
                <div className="privacy-toggle">
                  <button
                    className={`priv-btn${form.privacy === "public" ? " sel" : ""}`}
                    onClick={() => set("privacy", "public")}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
                    </svg>
                    <div>
                      <div className="priv-label">Public</div>
                      <div className="priv-desc">Anyone can find and join</div>
                    </div>
                  </button>
                  <button
                    className={`priv-btn${form.privacy === "private" ? " sel" : ""}`}
                    onClick={() => set("privacy", "private")}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                    </svg>
                    <div>
                      <div className="priv-label">Private</div>
                      <div className="priv-desc">Invite-only via password</div>
                    </div>
                  </button>
                </div>
              </div>

              {form.privacy === "private" && (
                <div className="field">
                  <label className="field-label">Password <span className="req">*</span></label>
                  <input
                    className="field-input full"
                    type="text"
                    placeholder="Minimum 4 characters"
                    value={form.password}
                    onChange={e => set("password", e.target.value)}
                    maxLength={32}
                  />
                  <p className="field-hint">Share this with people you want to invite.</p>
                </div>
              )}

              <div className="field">
                <label className="field-label">
                  Member limit — <span className="field-val">{form.memberLimit}</span>
                </label>
                <input
                  type="range" min={2} max={500} step={1}
                  value={form.memberLimit}
                  onChange={e => set("memberLimit", Number(e.target.value))}
                  className="range-input"
                />
                <div className="range-labels">
                  <span>2</span><span>500</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Preview ──────── */}
          {step === 3 && (
            <div className="modal-step-content">
              <div className="preview-card" style={{ borderColor: `${form.accentColor}35` }}>
                <div className="preview-header" style={{ background: `${form.accentColor}12` }}>
                  <span className="preview-emoji">{form.emoji}</span>
                  <div className="preview-meta">
                    <div className="preview-name" style={{ color: form.accentColor }}>#{form.name}</div>
                    <div className="preview-topic">{form.topic || "No topic"}</div>
                  </div>
                  <div className="preview-badge" style={{ background: `${form.accentColor}20`, color: form.accentColor }}>
                    {form.privacy === "public" ? "Public" : "Private"}
                  </div>
                </div>
                <div className="preview-details">
                  <div className="preview-row">
                    <span className="preview-row-label">Member limit</span>
                    <span className="preview-row-val">{form.memberLimit}</span>
                  </div>
                  {form.privacy === "private" && (
                    <div className="preview-row">
                      <span className="preview-row-label">Password</span>
                      <span className="preview-row-val preview-pw">{"•".repeat(form.password.length)}</span>
                    </div>
                  )}
                  <div className="preview-row">
                    <span className="preview-row-label">Created by</span>
                    <span className="preview-row-val">{profile?.handle}</span>
                  </div>
                </div>
              </div>
              {error && <p className="modal-error">{error}</p>}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            className="modal-btn-ghost"
            onClick={() => step === 0 ? onClose() : setStep(s => s - 1)}
          >
            {step === 0 ? "Cancel" : "← Back"}
          </button>
          {step < 3
            ? <button className="modal-btn-primary" disabled={!canNext()} onClick={() => setStep(s => s + 1)}>
                Continue →
              </button>
            : <button className="modal-btn-primary" disabled={creating} onClick={handleCreate}>
                {creating ? "Creating…" : "Create Room"}
              </button>
          }
        </div>

      </div>
    </div>
  );
}