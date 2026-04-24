import React from "react";

const css = `
.mob-nav {
  display: none;
  align-items: center; justify-content: space-around;
  height: 54px; background: var(--bg-sidebar);
  border-top: 1px solid var(--border-soft);
  box-shadow: 0 -2px 8px rgba(0,0,0,0.06);
  padding: 0 4px; z-index: 50;
}
.mob-tab {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 3px; flex: 1; height: 100%;
  color: var(--text-3); padding: 6px 4px; border-radius: 7px;
  transition: color 0.12s, background 0.12s;
  -webkit-tap-highlight-color: transparent;
}
.mob-tab.act { color: var(--pink); }
.mob-tab:active { background: var(--bg-hover); }
.mob-tab-ico { display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; }
.mob-tab-lbl { font-size: 9.5px; font-weight: 600; letter-spacing: 0.2px; }
@media (max-width: 720px) { .mob-nav { display: flex !important; } }
`;

export default function MobileNav({ theme, toggleTheme, onMenuOpen }) {
  return (
    <>
      <style>{css}</style>
      <nav className="mob-nav">
        <button className="mob-tab" onClick={onMenuOpen}>
          <span className="mob-tab-ico">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </span>
          <span className="mob-tab-lbl">Rooms</span>
        </button>
        <button className="mob-tab act">
          <span className="mob-tab-ico">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
          </span>
          <span className="mob-tab-lbl">Chat</span>
        </button>
        <button className="mob-tab">
          <span className="mob-tab-ico">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </span>
          <span className="mob-tab-lbl">Pulse</span>
        </button>
        <button className="mob-tab" onClick={toggleTheme}>
          <span className="mob-tab-ico">
            {theme === "light"
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>
            }
          </span>
          <span className="mob-tab-lbl">Theme</span>
        </button>
      </nav>
    </>
  );
}