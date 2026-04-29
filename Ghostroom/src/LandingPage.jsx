import React, { useEffect, useRef, useState, useCallback } from 'react';
import './LandingPage.css';

/* ─── Canvas grid animation ──────────────────────────────── */
function HeroCanvas() {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const timeRef   = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const CELL = 52;
    const SPEED = 0.18; // px per second drift

    const draw = (ts) => {
      const dt = ts - timeRef.current;
      timeRef.current = ts;
      const drift = (ts * SPEED * 0.001) % CELL;

      const { width: W, height: H } = canvas;
      ctx.clearRect(0, 0, W, H);

      // grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.028)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      for (let x = (drift % CELL); x < W + CELL; x += CELL) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
      }
      for (let y = (drift % CELL); y < H + CELL; y += CELL) {
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      ctx.stroke();

      // intersection dots
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      for (let x = (drift % CELL); x < W + CELL; x += CELL) {
        for (let y = (drift % CELL); y < H + CELL; y += CELL) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // random twinkle pips
      const seed = Math.floor(ts / 2000);
      const rng = (n) => {
        let s = seed * 9301 + n * 49297;
        return ((s * 233280 + 49297) & 0xffffff) / 16777216;
      };
      for (let i = 0; i < 6; i++) {
        const px = rng(i * 3)     * W;
        const py = rng(i * 3 + 1) * H;
        const pa = rng(i * 3 + 2);
        const pulse = 0.5 + 0.5 * Math.sin(ts * 0.001 * (1 + i * 0.3));
        ctx.fillStyle = `rgba(236,72,153,${pa * 0.15 * pulse})`;
        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="lp-hero-canvas" />;
}

/* ─── Animated counter ───────────────────────────────────── */
function Counter({ end, suffix = '', duration = 1800 }) {
  const [val, setVal] = useState(0);
  const startRef = useRef(null);

  useEffect(() => {
    const step = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const p = Math.min((ts - startRef.current) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 4);
      setVal(Math.floor(ease * end));
      if (p < 1) requestAnimationFrame(step);
    };
    const delay = setTimeout(() => requestAnimationFrame(step), 800);
    return () => clearTimeout(delay);
  }, [end, duration]);

  return <>{val.toLocaleString()}{suffix}</>;
}

/* ─── Data ───────────────────────────────────────────────── */
const FEATURES = [
  {
    id:   'pulse',
    tag:  { label: 'THE PULSE', color: 'pink' },
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    iconColor: 'pink',
    name: 'Activity Pulse',
    desc: 'Real-time signal across every anonymous channel. Watch the network breathe — message velocity, listener density, and reaction entropy rendered as live data.',
    metrics: [
      { label: 'Messages / hr',  val: '2,847', pct: 84,  color: 'pink' },
      { label: 'Active rooms',   val: '312',   pct: 62,  color: 'pink' },
      { label: 'Avg. latency',   val: '11ms',  pct: 95,  color: 'cyan' },
      { label: 'Retention rate', val: '94%',   pct: 94,  color: 'cyan' },
    ],
    extra: null,
  },
  {
    id:   'vault',
    tag:  { label: 'THE VAULT', color: 'cyan' },
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0110 0v4"/>
        <circle cx="12" cy="16" r="1" fill="currentColor"/>
      </svg>
    ),
    iconColor: 'cyan',
    name: 'Ephemeral Vault',
    desc: 'Messages exist in a time-locked state. Set a lifespan from 60 seconds to 24 hours. When the clock hits zero, the data doesn\'t get deleted — it never existed.',
    metrics: [
      { label: 'Avg. TTL set',     val: '4h',   pct: 55, color: 'cyan' },
      { label: 'Auto-expired',     val: '99.8%', pct: 99, color: 'cyan' },
      { label: 'Vault fill rate',  val: '1.2 GB/hr', pct: 40, color: 'pink' },
    ],
    extra: 'vault',
  },
  {
    id:   'badge',
    tag:  { label: 'THE BADGE', color: 'dim' },
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6"/>
        <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
      </svg>
    ),
    iconColor: 'white',
    name: 'Identity Badges',
    desc: 'Stay anonymous but earn recognition. Badges unlock through behavior — signal strength, vault usage, ghost-tier consistency. Identity without exposure.',
    extra: 'badges',
    metrics: [],
  },
];

const BADGES = [
  { label: 'Ghost Tier',   color: '#EC4899' },
  { label: 'Void Walker',  color: '#22D3EE' },
  { label: 'Signal Pro',   color: '#A78BFA' },
  { label: 'Vault Keeper', color: '#34D399' },
  { label: 'Anon Elite',   color: '#FB923C' },
  { label: 'Cipher',       color: '#818CF8' },
];

const ROOMS = [
  { name: 'void-channel',  count: 847, status: 'busy',   bars: [4,7,5,9,6,8,7,9],  hot: true  },
  { name: 'ghost-tier',    count: 312, status: 'active',  bars: [3,4,6,5,7,5,6,4],  hot: false },
  { name: 'liminal',       count: 204, status: 'active',  bars: [2,3,4,3,5,4,3,5],  hot: false },
  { name: 'anon-pulse',    count: 189, status: 'active',  bars: [5,4,6,7,5,6,8,5],  hot: true  },
  { name: 'signal-lost',   count: 91,  status: 'quiet',   bars: [1,2,1,2,1,1,2,1],  hot: false },
  { name: 'static',        count: 67,  status: 'quiet',   bars: [1,1,2,1,2,1,1,2],  hot: false },
  { name: 'mirror-0',      count: 432, status: 'busy',    bars: [6,8,7,9,8,7,9,8],  hot: true  },
  { name: 'null-syntax',   count: 156, status: 'active',  bars: [3,4,3,5,4,3,4,3],  hot: false },
];

/* ─── Vault timer hook ───────────────────────────────────── */
function useCountdown(initial) {
  const [seconds, setSeconds] = useState(initial);
  useEffect(() => {
    const id = setInterval(() => setSeconds(s => s <= 0 ? initial : s - 1), 1000);
    return () => clearInterval(id);
  }, [initial]);
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/* ─── Feature card ───────────────────────────────────────── */
function FeatureCard({ feat, index, activeCard, onVisible }) {
  const ref = useRef(null);
  const countdown = useCountdown(14399 - index * 1200);
  const isActive = activeCard === index;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onVisible(index); },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [index, onVisible]);

  return (
    <article ref={ref} className={`lp-feat-card${isActive ? ' is-active' : ''}`}>
      <div className="lp-feat-header">
        <div className={`lp-feat-icon ${feat.iconColor}`}>{feat.icon}</div>
        <span className={`lp-feat-tag ${feat.tag.color}`}>{feat.tag.label}</span>
      </div>
      <div className="lp-feat-name">{feat.name}</div>
      <p className="lp-feat-desc">{feat.desc}</p>

      {feat.extra === 'vault' && (
        <div className="lp-vault-timer">
          <span className="lp-vault-timer-label">AUTO-EXPIRE IN</span>
          <span className="lp-vault-timer-val">{countdown}</span>
        </div>
      )}

      {feat.extra === 'badges' && (
        <div className="lp-badges">
          {BADGES.map(b => (
            <div key={b.label} className="lp-badge-item">
              <span className="lp-badge-pip" style={{ background: b.color }} />
              {b.label}
            </div>
          ))}
        </div>
      )}

      {feat.metrics.length > 0 && (
        <div className="lp-feat-metrics">
          {feat.metrics.map(m => (
            <div key={m.label} className="lp-feat-metric">
              <span className="lp-feat-metric-label">{m.label}</span>
              <span className="lp-feat-metric-val">{m.val}</span>
              <div className="lp-feat-metric-bar">
                <div className={`lp-feat-metric-fill ${m.color}`} style={{ width: `${m.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

/* ─── Main component ─────────────────────────────────────── */
export default function LandingPage({ onEnter }) {
  const containerRef   = useRef(null);
  const overlayRef     = useRef(null);
  const [navScrolled,  setNavScrolled]  = useState(false);
  const [activeCard,   setActiveCard]   = useState(0);

  // Nav scroll state
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setNavScrolled(el.scrollTop > 40);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const handleCardVisible = useCallback((i) => setActiveCard(i), []);

  // "Get Access" — fade out then call onEnter
  const handleEnter = () => {
    const overlay = overlayRef.current;
    if (overlay) {
      overlay.classList.add('active');
      setTimeout(() => { onEnter?.(); }, 520);
    } else {
      onEnter?.();
    }
  };

  return (
    <>
      {/* Fixed nav */}
      <nav className={`lp-nav${navScrolled ? ' scrolled' : ''}`}>
        <a className="lp-nav-logo" href="#hero">
          <div className="lp-nav-mark">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 3h8M2 6h5M2 9h7" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="lp-nav-brand">MsgIn</span>
        </a>
        <ul className="lp-nav-links">
          <li><a href="#features">Features</a></li>
          <li><a href="#campus">Campus</a></li>
          <li><a href="#docs">Docs</a></li>
        </ul>
        <button className="lp-nav-cta" onClick={handleEnter}>Get Access</button>
      </nav>

      {/* Scroll container */}
      <div className="lp-container" ref={containerRef} id="hero">

        {/* ── SECTION 1: HERO ─────────────────────── */}
        <section className="lp-section lp-hero">
          <HeroCanvas />
          <div className="lp-hero-vignette" />
          <div className="lp-hero-bloom" />

          <div className="lp-hero-content">
            <div className="lp-hero-eyebrow">
              <span className="lp-hero-eyebrow-pip" />
              <span className="lp-hero-eyebrow-text">v2.0 · Now in open beta</span>
            </div>

            <h1 className="lp-hero-title">
              Msg<span className="lp-hero-title-accent">In</span>
            </h1>

            <p className="lp-hero-sub">Where Anonymity Meets Identity.</p>

            <div className="lp-hero-actions">
              <button className="lp-btn-primary" onClick={handleEnter}>
                Get Access
              </button>
              <button className="lp-btn-ghost">See how it works</button>
            </div>

            <div className="lp-hero-stats">
              <div className="lp-hero-stat">
                <span className="lp-hero-stat-val"><Counter end={94200} suffix="+" /></span>
                <span className="lp-hero-stat-lbl">Users</span>
              </div>
              <div className="lp-hero-stat-divider" />
              <div className="lp-hero-stat">
                <span className="lp-hero-stat-val"><Counter end={312} /></span>
                <span className="lp-hero-stat-lbl">Live Rooms</span>
              </div>
              <div className="lp-hero-stat-divider" />
              <div className="lp-hero-stat">
                <span className="lp-hero-stat-val"><Counter end={99} suffix=".9%" /></span>
                <span className="lp-hero-stat-lbl">Uptime</span>
              </div>
            </div>
          </div>

          <div className="lp-hero-scroll">
            <div className="lp-scroll-line" />
            <span className="lp-scroll-label">Scroll</span>
          </div>
        </section>

        {/* ── SECTION 2: SYSTEM REVEAL ─────────────── */}
        <section className="lp-section lp-reveal" id="features">

          {/* Left — sticky */}
          <div className="lp-reveal-left">
            <div className="lp-reveal-kicker">
              <div className="lp-reveal-kicker-line" />
              <span className="lp-reveal-kicker-text">System Architecture</span>
            </div>
            <h2 className="lp-reveal-title">
              Built for the<br /><em>Signal</em><br />not the noise.
            </h2>
            <p className="lp-reveal-desc">
              Three core primitives power every anonymous interaction. Each one designed with zero-trust architecture and ephemeral by default.
            </p>
            <nav className="lp-reveal-nav">
              {FEATURES.map((f, i) => (
                <div key={f.id} className={`lp-reveal-nav-item${activeCard === i ? ' active' : ''}`}>
                  <div className="lp-reveal-nav-dot" />
                  <span className="lp-reveal-nav-label">{f.name}</span>
                </div>
              ))}
            </nav>

            <div className="lp-terminal">
              <div className="lp-terminal-bar">
                <div className="lp-terminal-dot" />
                <div className="lp-terminal-dot" />
                <div className="lp-terminal-dot" />
                <span className="lp-terminal-title">msgin — ghost-protocol</span>
              </div>
              <div className="lp-terminal-body">
                <div className="lp-terminal-line">
                  <span className="t-dim">$</span> <span className="t-pink">msgin</span> <span className="t-cyan">connect</span> <span className="t-white">--anon</span>
                </div>
                <div className="lp-terminal-line t-dim">→ Resolving identity mask...</div>
                <div className="lp-terminal-line t-dim">→ Establishing vault TTL: 4h</div>
                <div className="lp-terminal-line">
                  <span className="t-cyan">✓</span> <span className="t-white">Connected</span> <span className="t-dim">as ghost_</span><span className="t-pink">7749</span>
                </div>
                <div className="lp-terminal-line">
                  <span className="t-dim">›</span> <span className="t-white">_</span><span className="lp-terminal-cursor" />
                </div>
              </div>
            </div>
          </div>

          {/* Right — scrollable feature cards */}
          <div className="lp-reveal-right">
            {FEATURES.map((feat, i) => (
              <FeatureCard
                key={feat.id}
                feat={feat}
                index={i}
                activeCard={activeCard}
                onVisible={handleCardVisible}
              />
            ))}
            {/* spacer so last card can fully scroll into view */}
            <div style={{ height: 1 }} />
          </div>
        </section>

        {/* ── SECTION 3: CAMPUS PULSE ──────────────── */}
        <section className="lp-section lp-campus" id="campus">
          <div className="lp-campus-header">
            <div>
              <div className="lp-campus-kicker">
                <div className="lp-campus-kicker-line" />
                <span className="lp-campus-kicker-text">Community Mode</span>
              </div>
              <h2 className="lp-campus-title">
                The <span>Campus</span><br />Pulse
              </h2>
            </div>
            <div className="lp-campus-meta">
              <strong><Counter end={847} /></strong>
              anonymous signals<br />active right now
            </div>
          </div>

          <div className="lp-room-grid">
            {ROOMS.map((room) => (
              <div
                key={room.name}
                className={`lp-room${room.hot ? ' is-hot' : ''}`}
              >
                <div className="lp-room-top">
                  <div className={`lp-room-pip ${room.status}`} />
                  <span className="lp-room-name">#{room.name}</span>
                </div>
                <div className="lp-room-stats">
                  <div>
                    <div className="lp-room-count">{room.count.toLocaleString()}</div>
                    <div className="lp-room-label">listeners</div>
                  </div>
                  <div className="lp-room-sparkline">
                    {room.bars.map((h, bi) => (
                      <div
                        key={bi}
                        className={`lp-room-bar ${room.status}`}
                        style={{ height: `${(h / 10) * 100}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="lp-campus-footer">
            <p className="lp-campus-footer-text">
              Join an active room anonymously. <strong>No account required.</strong><br />
              Your presence is masked from the moment you enter.
            </p>
            <div className="lp-campus-actions">
              <button className="lp-btn-ghost" onClick={handleEnter}>Browse Rooms</button>
              <button className="lp-btn-primary" onClick={handleEnter}>Get Access →</button>
            </div>
          </div>
        </section>

      </div>

      {/* Transition overlay */}
      <div className="lp-transition-overlay" ref={overlayRef} />
    </>
  );
}