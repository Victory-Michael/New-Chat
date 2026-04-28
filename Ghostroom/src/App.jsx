import React, { useState, useEffect } from "react";
import LandingPage from "./LandingPage";
import Dashboard   from "./Dashboard";
import { ensureAnonymousAuth, getOrCreateProfile, getRoomByCode } from "./firebase";
import "./theme.css";
import "./App.css";

// Always dark mode
document.documentElement.removeAttribute("data-theme");
document.documentElement.style.colorScheme = "dark";

export default function App() {
  const [entered,       setEntered]       = useState(false);
  const [authReady,     setAuthReady]     = useState(false);
  const [user,          setUser]          = useState(null);
  const [profile,       setProfile]       = useState(null);
  const [initialRoomId, setInitialRoomId] = useState(null);

  useEffect(() => {
    // Check URL for a room code: msgin.io/X4K2M or ?room=X4K2M
    const path   = window.location.pathname.replace("/", "").trim().toUpperCase();
    const params = new URLSearchParams(window.location.search);
    const code   = path || params.get("room")?.toUpperCase();
    if (code && /^[A-Z0-9]{4,6}$/.test(code)) {
      setInitialRoomId(code);
      setEntered(true); // skip landing if direct link
    }

    (async () => {
      try {
        const u = await ensureAnonymousAuth();
        const p = await getOrCreateProfile(u.uid);
        setUser(u);
        setProfile(p);
      } catch (e) {
        console.error("Auth:", e);
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
      <span className="auth-label">entering the void…</span>
    </div>
  );

  if (!entered) return (
    <LandingPage onEnter={() => setEntered(true)} />
  );

  return (
    <Dashboard
      user={user}
      profile={profile}
      initialRoomId={initialRoomId}
      onExpireAll={() => setEntered(false)}
    />
  );
}


// ---------NOTE TO DEVELOPER---------

// Remember i mentioned that there other pages
// So, I dislike the light mode, its too bright and the design doesnt flow with it, some text are white along with it, some borders and others
// Also it's not on realtime: First, when a room is created, its expected to generate a short random link 4-6 digits where all messages will be stored, this is the system that ngl anonymous use, i don't know if you get me
// Secondly, Whats that Anonymous feed susposed to be (Anonymous feed, pulse and the other in the navigate, i dont get {I LOVE HOW EXTENSIVE AND HOW THERE ARE LOTS OF THINGS BUT THE FACT THAT THEY AREN'T CONNECTED TO THE DATABASE MAKES THEM USELESS, WHAT EVER FEATURE THAT IS THERE SHOULD BE CONNECTED TO THE FIREBASE BASED ON THE USER ACTIVITY})
// Third, the other side at the right hand sides, they are just prompt they should also be real(that block or copy or recording alert should be real not just frontend design), if empty, slighty indicate, and if the room analytics has nohing because the user has done nothing then indicate
// Its almost okay, just carefully implement these and new things you can think of that will not look useless
// Conclusion, dont forget the main goal, chat anonymously and share the link, there is no one icon that shows share your room links
// Its a Messaging Platfrom, it supposed to have all basic functionalities a messaging platform have, e.g the room under that navigate, a room should indicate circle 1 (1) for one new message or how many.. see these are features i expect
// Change the memeber limit range from that to typing number its hard to use range in that room creation part and highest in the database, you know what to do
// Mesage Delete after 24hours, that the main algorithm and when its time, if it shows Smooth animating of count down from ten to zero then deletes the conversation history totally from all users both in the room showing place

// Mobile Versions needs to have a Real Messaging Feel From begining to end