import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import ChatFeed from "./ChatFeed";
import Details from "./Details";
import MobileNav from "./MobileNav";
import RoomModal from "./RoomModal";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db, subscribeToRooms, joinRoom, leaveRoom, getRoomById, trackRoomLocally, removeLocalRoomId } from "./firebase";
import SkeletonFeed from "./SkeletonFeed"; 
import "./App.css";

/* ─── Toast system ───────────────────────────────────────── */
function ToastStack({ toasts }) {
  return (
    <div style={{
      position: "fixed",
      top: 16,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      gap: 8,
      pointerEvents: "none",
      width: "max-content",
      maxWidth: "calc(100vw - 32px)",
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-mid)",
          borderRadius: 112,
          padding: "10px 18px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          boxShadow: "var(--shadow-3)",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-1)",
          animation: "toastIn 0.2s cubic-bezier(0.25, 1, 0.5, 1)",
          backdropFilter: "blur(8px)",
        }}>
          {t.icon && <span style={{ fontSize: 15 }}>{t.icon}</span>}
          {t.message}
        </div>
      ))}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-10px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

export default function Dashboard({ user, profile, theme, toggleTheme }) {
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [roomToLeave, setRoomToLeave] = useState(null);
  const [clearingRooms, setClearingRooms] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' or 'pulse'
  
  // REAL-TIME LOCAL PROFILE INTERCEPTOR STATE
  const [liveProfile, setLiveProfile] = useState(profile);

  // PROFILE CUSTOMIZER MODAL CONTROL STATES
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editHandle, setEditHandle] = useState("");
  const [avatarType, setAvatarType] = useState("initials"); // 'initials' or 'dicebear'
  const [selectedSeed, setSelectedSeed] = useState("");
  const [dicebearSeeds, setDicebearSeeds] = useState([]);
  const [profileError, setProfileError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  
  // PREVIEW MODAL CONTROL STATES
  const [hasApprovedPreview, setHasApprovedPreview] = useState(false);
  const [justCreatedRoomId, setJustCreatedRoomId] = useState(null);

  const navigate = useNavigate();

  const showToast = (message, icon = null, duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, icon }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  };

  // Sync prop changes to local tracker fallback
  useEffect(() => {
    if (profile) setLiveProfile(profile);
  }, [profile]);

  // LIVE FIRESTORE PROFILE INTERCEPTOR: Sync changes instantly across all view frames
  useEffect(() => {
    if (!user?.uid) return;
    const userDocRef = doc(db, "users", user.uid);
    const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setLiveProfile(docSnap.data());
      }
    });
    return () => unsubscribeProfile();
  }, [user?.uid]);

  // Live Internet Connection Monitor
useEffect(() => {
  const handleOnline = () => {
    setIsOffline(false);
    showToast("Connected back online!", "⚡", 4000);
  };
  const handleOffline = () => {
    setIsOffline(true);
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}, []);

  // Handle opening and seeding the customization form
  const handleOpenProfileModal = () => {
    if (liveProfile) {
      setEditHandle(liveProfile.handle || "");
      setAvatarType(liveProfile.avatarType || "initials");
      setSelectedSeed(liveProfile.avatarValue || "");
      shuffleDicebearAvatars();
      setProfileError("");
      setIsEditingProfile(true);
    }
  };

  const shuffleDicebearAvatars = () => {
    const randomPool = Array.from({ length: 10 }, () => `seed_${Math.floor(Math.random() * 999999)}`);
    setDicebearSeeds(randomPool);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!editHandle.trim()) return setProfileError("Identity handle is required");
    if (editHandle.trim().length > 30) return setProfileError("Maximum limit is 30 characters");

    try {
      setProfileSaving(true);
      setProfileError("");
      
      const calculatedInitials = editHandle.trim() 
        ? editHandle.trim().slice(0, 3).toUpperCase() 
        : "GHO";
      const identityValue = avatarType === "initials" ? calculatedInitials : selectedSeed;
      
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        handle: editHandle.trim().slice(0, 30),
        avatarType: avatarType,
        avatarValue: identityValue
      });
      
      setIsEditingProfile(false);
      showToast("Profile layout synced!", "⚡");
    } catch (err) {
      setProfileError(err.message || "Failed to commit layout changes");
    } finally {
      setProfileSaving(false);
    }
  };

  /* Clear preview validation flags whenever user changes chosen active targets */
  useEffect(() => {
    setHasApprovedPreview(false);
    if (activeRoom && activeRoom.id !== justCreatedRoomId) {
      setJustCreatedRoomId(null);
    }
  }, [activeRoom?.id]);

  /* ─── Subscribe to local-history rooms ─── */
  useEffect(() => {
    if (!user) return;
    
    const unsub = subscribeToRooms(user.uid, (list) => {
      setRooms(list);
      if (activeRoom) {
        const updatedData = list.find(r => r.id === activeRoom.id);
        if (updatedData) {
          setActiveRoom(updatedData);
        }
      }
    });
    
    return unsub;
  }, [user, activeRoom?.id]); 

  const handleRoomFullExit = (roomId) => {
    if (!roomId) return;
    removeLocalRoomId(roomId); 
    setActiveRoom(null);
    navigate("/", { replace: true });
  };

  /* ─── Handle ?room= share link on mount ─── */
  useEffect(() => {
    if (!user || !liveProfile) return; 
    const params = new URLSearchParams(window.location.search);
    const sharedRoomId = params.get("room");
    if (!sharedRoomId) return;

    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, "", cleanUrl);

    getRoomById(sharedRoomId).then(async (room) => { 
      if (!room) {
        showToast("This room has expired or doesn't exist.", "⏳");
        return;
      }
      
      try {
        if (room.createdBy === user.uid) {
          setJustCreatedRoomId(room.id);
        }
        await joinRoom(room.id, user.uid, liveProfile.handle);
        trackRoomLocally(sharedRoomId);
        setActiveRoom(room);
        showToast(`Joined #${room.name}`, room.emoji);
      } catch (err) {
        if (err.message === "Room is full") {
          showToast("This room is currently full!", "🚫");
        } else {
          console.error("Link join failed:", err);
        }
      }
    });
  }, [user, liveProfile]);

  /* Clear preview validation flags whenever user changes chosen active targets (Fixed Session Context) */
  useEffect(() => {
    if (!activeRoom) {
      setHasApprovedPreview(false);
      return;
    }

    const sessionJoinKey = `msgIn_approved_${user?.uid}_${activeRoom.id}`;
    const alreadyApproved = sessionStorage.getItem(sessionJoinKey) === "true";

    if (alreadyApproved) {
      setHasApprovedPreview(true);
    } else {
      setHasApprovedPreview(false);
    }

    if (activeRoom.id !== justCreatedRoomId) {
      setJustCreatedRoomId(null);
    }
  }, [activeRoom?.id, user?.uid]);

  /* ─── Presence: join/leave room (Bypassed cleanly if session cached) ─── */
  useEffect(() => {
    if (!activeRoom || !user || !liveProfile || roomToLeave) return;
    
    const isCreator = activeRoom.createdBy === user.uid;
    const isJustCreated = activeRoom.id === justCreatedRoomId;
    
    // Check session context cache
    const sessionJoinKey = `msgIn_approved_${user.uid}_${activeRoom.id}`;
    const alreadyApproved = sessionStorage.getItem(sessionJoinKey) === "true";
    
    if (isCreator || isJustCreated || hasApprovedPreview || alreadyApproved) {
      joinRoom(activeRoom.id, user.uid, liveProfile.handle)
        .then(() => {
          // Cache successful state approvals 
          sessionStorage.setItem(sessionJoinKey, "true");
        })
        .catch((err) => {
          if (err.message === "Room is full") {
            // Drop cache tracking instantly if rejected
            sessionStorage.removeItem(sessionJoinKey);
            handleRoomFullExit(activeRoom.id);
          }
        });
    }
  }, [activeRoom?.id, user?.uid, liveProfile?.handle, roomToLeave, hasApprovedPreview, justCreatedRoomId]);

  const handleSelectRoom = async (room) => {
  if (clearingRooms.includes(room.id)) {
    showToast("Syncing workspace, please wait...", "⏳");
    return;
  }
  setFeedLoading(true);
  setActiveRoom(room);
  setActiveTab('feed'); // <--- Force return to chat feed when selecting a new room
  setDrawerOpen(false);

  setTimeout(() => {
    setFeedLoading(false);
  }, 450);
};

  const handleConfirmLeave = async () => {
    if (!roomToLeave || !user) return;
    const targetRoomId = roomToLeave;

    try {
      setClearingRooms(prev => [...prev, targetRoomId]);
      sessionStorage.removeItem(`msgIn_approved_${user.uid}_${targetRoomId}`);
      await leaveRoom(targetRoomId, user.uid);
      
      if (activeRoom?.id === targetRoomId) {
        setActiveRoom(null);
      }
      
      setRoomToLeave(null);
      showToast("Left room successfully", "👋");
      navigate("/", { replace: true });

      setTimeout(() => {
        setClearingRooms(prev => prev.filter(id => id !== targetRoomId));
      }, 30000);

    } catch (e) {
      console.error("Failed to cleanly exit room:", e);
      showToast("Error leaving room", "error");
      setClearingRooms(prev => prev.filter(id => id !== targetRoomId));
    }
  };

  const handleRoomCreated = (room) => {
    setJustCreatedRoomId(room.id); 
    setRooms(prev => [room, ...prev.filter(r => r.id !== room.id)]);
    setActiveRoom(room);
    setShowModal(false);
    showToast(`Room #${room.name} created!`, room.emoji);
  };

  // EVALUATING GATE CRITERIA
  const isCreator = activeRoom && activeRoom.createdBy === user?.uid;
  const isBypassed = activeRoom && (activeRoom.id === justCreatedRoomId);
  const shouldShowPreview = activeRoom && !isCreator && !isBypassed && !hasApprovedPreview;

  return (
    <>
      <ToastStack toasts={toasts} />

      {isOffline && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          background: "var(--pink, #ef4444)",
          color: "#fff",
          textAlign: "center",
          padding: "6px 12px",
          fontSize: "12px",
          fontWeight: "600",
          zIndex: 10000,
          boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px"
        }}>
          <span className="pulse">📡</span> Connection lost. Attempting to reconnect... 
        </div>
      )}

      <div className={`mob-overlay${drawerOpen ? " show" : ""}`} onClick={() => setDrawerOpen(false)} />

      <div className="dashboard-shell">
        <Sidebar
          user={user}
          profile={liveProfile}
          theme={theme}
          toggleTheme={toggleTheme}
          rooms={rooms}
          activeRoom={activeRoom}
          onSelectRoom={handleSelectRoom}
          onCreateRoom={() => setShowModal(true)}
          onEditProfile={handleOpenProfileModal}
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        {/* WORKSPACE VIEWING CHANNEL PORT */}
        <div className="chat-feed-container" style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>
          
          {/* FLOATING MOBILE MENU BUTTON (Only visible on mobile when no active room is selected) */}
          {!activeRoom && (
            <button 
              className="mobile-idle-menu-trigger" 
              onClick={() => setDrawerOpen(true)}
              style={{
                position: "absolute",
                top: "16px",
                left: "16px",
                zIndex: 40,
                display: "none", /* Controlled by media query in App.css */
                alignItems: "center",
                justifyContent: "center",
                width: "40px",
                height: "40px",
                borderRadius: "8px",
                background: "var(--bg-sidebar, #14121f)",
                border: "1px solid var(--border-mid, rgba(255, 255, 255, 0.08))",
                color: "var(--text-1, #ffffff)",
                cursor: "pointer"
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>
          )}

          {activeRoom ? (
            activeTab === 'pulse' ? (
              /* 1. PULSE VIEW (Renders actual Details panel in the main window with a navigation top-bar) */
              <div className="mobile-pulse-workspace-wrapper" style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
                {/* Mobile/Desktop Header for Pulse View */}
                <div className="pulse-view-header" style={{
                  display: "flex",
                  alignItems: "center",
                  height: "48px",
                  padding: "0 14px",
                  borderBottom: "1px solid var(--border-mid)",
                  background: "var(--bg-sidebar)",
                  flexShrink: 0,
                  gap: "12px"
                }}>
                  <button 
                    className="mob-menu-toggle" 
                    onClick={() => setDrawerOpen(true)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "32px",
                      height: "32px",
                      borderRadius: "6px",
                      background: "rgba(255, 255, 255, 0.05)",
                      color: "var(--text-1)",
                      cursor: "pointer"
                    }}
                  >
                    {/* Hamburger Menu Icon */}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="4" y1="12" x2="20" y2="12" />
                      <line x1="4" y1="6" x2="20" y2="6" />
                      <line x1="4" y1="18" x2="20" y2="18" />
                    </svg>
                  </button>
                  <span style={{ fontSize: "13px", fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: activeRoom.accentColor || "#EC4899" }}>
                    #{activeRoom.name} <span style={{ color: "white" }}>Details</span> 
                  </span>
                </div>

                <div style={{ flex: 1, overflowY: "auto" }}>
                  <Details 
                    room={activeRoom} 
                    user={user} 
                    profile={liveProfile} 
                    showToast={showToast}
                  />
                </div>
              </div>
            ) : feedLoading ? (
              /* 2. LOADING SCREEN FOR FEED */
              <SkeletonFeed />
            ) : shouldShowPreview ? (
              /* 3. THE PREVIEW GATE */
              <div className="cf-preview-overlay">
                <div className="cf-preview-modal">
                  <div className="cf-preview-glow" style={{ background: activeRoom.accentColor || "#EC4899" }} />
                  <div className="cf-preview-content">
                    <div className="cf-preview-badge">Room Preview</div>
                    <h2 className="cf-preview-title">
                      Enter <span style={{ color: activeRoom.accentColor }}>{activeRoom.name}</span>
                    </h2>
                    <p className="cf-preview-desc">
                      {activeRoom.topic || "This room is ephemeral. Messages disappear permanently after 24 hours."}
                    </p>

                    <div className="cf-preview-identity">
                      <p className="cf-identity-label">Your Username</p>
                      <div className="cf-identity-row">
                        <div 
                          className="cf-identity-avatar" 
                          style={{ 
                            background: `${activeRoom.accentColor || "#EC4899"}20`, 
                            color: activeRoom.accentColor || "#EC4899",
                            borderColor: `${activeRoom.accentColor || "#EC4899"}45`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden"
                          }}
                        >
                          {liveProfile?.avatarType === "dicebear" ? (
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${liveProfile.avatarValue}`} alt="av" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            liveProfile?.avatarValue || (liveProfile?.handle || "G").slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <span className="cf-identity-name">{liveProfile?.handle || "ghost_0000"}</span>
                      </div>
                    </div>

                    <div className="cf-preview-actions">
                      <button 
                        className="cf-preview-btn-decline"
                        onClick={() => setActiveRoom(null)} 
                      >
                        Go Back
                      </button>
                      
                      <button 
                        className="cf-preview-btn-join"
                        style={{ backgroundColor: activeRoom.accentColor || "#EC4899" }}
                        onClick={() => setHasApprovedPreview(true)} 
                      >
                        Enter Room
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* 4. THE LIVE CHAT FEED */
              <ChatFeed
                user={user}
                profile={liveProfile}
                room={activeRoom}
                onLeaveClick={() => setRoomToLeave(activeRoom.id)}
                onMenuOpen={() => setDrawerOpen(true)}
                onCreateRoom={() => setShowModal(true)}
                showToast={showToast}
                onRoomFull={() => handleRoomFullExit(activeRoom.id)}
                onBack={() => setActiveRoom(null)}
              />
            )
          ) : (
            /* 5. REDESIGNED EMPTY STATE WITH CREATE ROOM BUTTON */
            <div className="cf-empty-state-view" style={{ 
              display: "flex", 
              flex: 1, 
              flexDirection: "column", 
              alignItems: "center", 
              justifyContent: "center", 
              height: "100%", 
              padding: "24px",
              textAlign: "center",
              background: "var(--bg-app, #0b0914)"
            }}>
              <div style={{ fontSize: "48px", marginBottom: "16px", filter: "drop-shadow(0 4px 12px rgba(236,72,153,0.15))" }}>💬</div>
              <h3 style={{ color: "var(--text-1, #ffffff)", marginBottom: "10px", fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", fontSize: "18px" }}>
                Nothing here yet
              </h3>
              <p style={{ color: "var(--text-muted, #7e7a93)", fontSize: "14px", maxWidth: "290px", lineHeight: "1.5", marginBottom: "24px" }}>
                Select an active room from your sidebar or create an entirely new room to start chatting.
              </p>
              <button 
                onClick={() => setShowModal(true)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  backgroundColor: "var(--pink, #ec4899)",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "600",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(236, 72, 153, 0.3)",
                  transition: "transform 0.2s, background-color 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.filter = "brightness(1.1)"}
                onMouseLeave={(e) => e.currentTarget.style.filter = "none"}
              >
                Create New Room
              </button>
            </div>
          )}
        </div>

        <div className="details-col">
          {/* DESKTOP DETAILS COLUMN (Right hand side) */}
          {activeRoom && activeTab !== 'pulse' && (
            <Details 
              room={activeRoom} 
              user={user} 
              profile={liveProfile} 
              showToast={showToast}
            />
          )}
        </div>
      </div>

      {showModal && (
        <RoomModal
          user={user}
          profile={liveProfile}
          onCreated={handleRoomCreated}
          onClose={() => setShowModal(false)}
        />
      )}

      {roomToLeave && (
        <div className="cf-modal-backdrop" onClick={() => setRoomToLeave(null)}>  
          <div className="cf-modal">
            <button className="cf-modal-btn-x" onClick={() => setRoomToLeave(null)}>&#10005;</button>
            <h2>Leave Room?</h2>
            <p>You will no longer be a member of this room.</p>
            <div className="cf-modal-btns">
              <button className="cf-modal-btn confirm" onClick={handleConfirmLeave} style={{ backgroundColor: "#ef4444" }}>
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DASHBOARD-LEVEL OVERLAY: Profile Customize Modal */}
      {isEditingProfile && (
        <div className="profile-modal-backdrop" onClick={() => setIsEditingProfile(false)}>
          <div className="profile-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>Customize Profile</h3>
            </div>

            <form onSubmit={handleSaveProfile} className="profile-modal-form">
              <div className="profile-preview-card">
                <div className="profile-preview-display">
                  {avatarType === "dicebear" ? (
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedSeed}`} alt="DiceBear Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span>{editHandle.trim() ? editHandle.trim().slice(0, 3).toUpperCase() : "GHO"}</span>
                  )}
                </div>
                <div className="profile-preview-meta">
                  <h5>Profile Preview</h5>
                  <p>{avatarType === "dicebear" ? "Custom Avatar" : "Text Initials"}</p>
                </div>
              </div>

              <div className="profile-input-group">
                <label>Username</label>
                <input 
                  type="text" 
                  maxLength={30}
                  value={editHandle}
                  onChange={(e) => setEditHandle(e.target.value)}
                  placeholder="Enter Username (max 30 chars)..."
                />
                <span className="profile-char-counter">{editHandle.length}/30</span>
              </div>

              <div className="profile-mode-tabs">
                <button 
                  type="button" 
                  className={`profile-tab-btn ${avatarType === "initials" ? "active" : ""}`}
                  onClick={() => setAvatarType("initials")}
                >
                  Text Initials
                </button>
                <button 
                  type="button" 
                  className={`profile-tab-btn ${avatarType === "dicebear" ? "active" : ""}`}
                  onClick={() => {
                    setAvatarType("dicebear");
                    if (!selectedSeed && dicebearSeeds.length > 0) setSelectedSeed(dicebearSeeds[0]);
                  }}
                >
                  Custom Avatars
                </button>
              </div>

              {avatarType === "dicebear" && (
                <div className="dicebear-generator-section">
                  <div className="dicebear-section-header">
                    <span>Select Avatar</span>
                    <button type="button" className="dicebear-shuffle-btn" onClick={shuffleDicebearAvatars}>
                     Shuffle 
                    </button>
                  </div>
                  <div className="dicebear-vector-grid">
                    {dicebearSeeds.map((seedItem) => (
                      <div 
                        key={seedItem}
                        className={`dicebear-vector-node ${selectedSeed === seedItem ? "selected" : ""}`}
                        onClick={() => setSelectedSeed(seedItem)}
                        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%", overflow: "hidden", border: selectedSeed === seedItem ? "2px solid var(--accent)" : "1px solid var(--border-mid)", cursor: "pointer" }}
                      >
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${seedItem}`} alt="Avatar Node" style={{ width: "130%", height: "130%", objectFit: "cover" }}/>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {profileError && <p className="profile-modal-error-track">{profileError}</p>}

              <div className="profile-modal-footer-actions">
                <button type="button" className="profile-action-cancel" onClick={() => setIsEditingProfile(false)}>Discard</button>
                <button type="submit" className="profile-action-confirm" disabled={profileSaving}>
                  {profileSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}