import React, { useState, useEffect } from "react";
import Dashboard from "./Dashboard";
import { ensureAnonymousAuth, getOrCreateProfile } from "./firebase";
import "./theme.css";
import "./App.css";

function getTheme() { return localStorage.getItem("msgin_theme") || "dark"; }
function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("msgin_theme", t);
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [user,      setUser]      = useState(null);
  const [profile,   setProfile]   = useState(null);
  const [theme,     setTheme]     = useState(getTheme);

  useEffect(() => { applyTheme(theme); }, [theme]);

  const toggleTheme = () => {
    document.documentElement.classList.add("theme-transition");
    setTheme(t => { const n = t === "light" ? "dark" : "light"; applyTheme(n); return n; });
    setTimeout(() => document.documentElement.classList.remove("theme-transition"), 350);
  };

  useEffect(() => {
    (async () => {
      try {
        const u = await ensureAnonymousAuth();
        const p = await getOrCreateProfile(u.uid);
        setUser(u);
        setProfile(p);
      } catch (e) {
        console.error("Auth error", e);
      } finally {
        setAuthReady(true);
      }
    })();
  }, []);

  if (!authReady) return (
    <div className="auth-screen">
      <div className="auth-mark">
        <svg width="16" height="16" viewBox="0 0 12 12" fill="none">
          <path d="M2 3h8M2 6h5M2 9h7" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <span className="auth-label">connecting…</span>
    </div>
  );

  return (
    <Dashboard
      user={user}
      profile={profile}
      theme={theme}
      toggleTheme={toggleTheme}
    />
  );
}


