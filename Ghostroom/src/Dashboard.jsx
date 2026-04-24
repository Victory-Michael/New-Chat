import React, { useState, useEffect, useCallback, useRef } from "react";
import Sidebar     from "./Sidebar";
import ChatFeed    from "./ChatFeed";
import Details     from "./Details";
import MobileNav   from "./MobileNav";
import RoomModal   from "./RoomModal";
import Toast       from "./Toast";
import useRoomExpiry from "./useRoomExpiry";
import useSurveillance from "./useSurveillance";
import {
  subscribeToRooms, joinPresence, getRoomByCode,
  subscribeToMessages, markRoomRead, getLastReadId,
} from "./firebase";
import "./App.css";

export default function Dashboard({ user, profile, initialRoomId, onExpireAll }) {
  const [rooms,         setRooms]        = useState([]);
  const [activeRoom,    setActiveRoom]   = useState(null);
  const [showModal,     setShowModal]    = useState(false);
  const [drawerOpen,    setDrawerOpen]   = useState(false);
  const [toasts,        setToasts]       = useState([]);
  const [unreadMap,     setUnreadMap]    = useState({});   // roomId → count
  const presenceCleanup = useRef(null);

  /* ── Toast helper ─────────────────────────────────────── */
  const showToast = useCallback((msg, icon = "✓") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, icon }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  }, []);

  /* ── Subscribe to rooms ───────────────────────────────── */
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToRooms(user.uid, async (list) => {
      setRooms(list);
      // Auto-select initial room from URL or first room
      if (!activeRoom) {
        if (initialRoomId) {
          const r = list.find(r => r.id === initialRoomId)
                 || await getRoomByCode(initialRoomId);
          if (r) setActiveRoom(r);
        } else if (list.length > 0) {
          setActiveRoom(list[0]);
        }
      } else {
        // Keep activeRoom in sync with updated room data
        const updated = list.find(r => r.id === activeRoom.id);
        if (updated) setActiveRoom(updated);
      }
    });
    return unsub;
  }, [user]);

  /* ── Unread tracking ──────────────────────────────────── */
  useEffect(() => {
    if (!user || rooms.length === 0) return;
    const unsubs = rooms.map(room => {
      return subscribeToMessages(room.id, (msgs) => {
        const lastReadId = getLastReadId(user.uid, room.id);
        if (!msgs.length) return;
        const lastId = msgs[msgs.length - 1].id;
        if (room.id === activeRoom?.id) {
          markRoomRead(user.uid, room.id, lastId);
          setUnreadMap(m => ({ ...m, [room.id]: 0 }));
          return;
        }
        if (!lastReadId) {
          setUnreadMap(m => ({ ...m, [room.id]: msgs.length }));
          return;
        }
        const idx = msgs.findIndex(m => m.id === lastReadId);
        const unread = idx === -1 ? msgs.length : msgs.length - idx - 1;
        setUnreadMap(m => ({ ...m, [room.id]: unread }));
      });
    });
    return () => unsubs.forEach(u => u());
  }, [user, rooms.map(r => r.id).join(",")]);

  /* ── Presence ─────────────────────────────────────────── */
  useEffect(() => {
    if (!activeRoom || !user || !profile) return;
    presenceCleanup.current?.();
    const cleanup = joinPresence(activeRoom.id, user.uid, profile.handle);
    presenceCleanup.current = cleanup;
    // Mark room as read when switching to it
    markRoomRead(user.uid, activeRoom.id, "");
    setUnreadMap(m => ({ ...m, [activeRoom.id]: 0 }));
    return () => {
      presenceCleanup.current?.();
      presenceCleanup.current = null;
    };
  }, [activeRoom?.id, user?.uid]);

  /* ── Surveillance ─────────────────────────────────────── */
  useSurveillance(activeRoom?.id, user?.uid, profile?.handle, !!activeRoom);

  /* ── Meltdown for active room ─────────────────────────── */
  const { secondsLeft, phase } = useRoomExpiry(activeRoom, () => {
    setActiveRoom(null);
    showToast("Room expired. The void consumed it.", "💀");
    if (rooms.length <= 1) {
      setTimeout(() => onExpireAll?.(), 1500);
    }
  });

  const handleSelectRoom = useCallback((room) => {
    setActiveRoom(room);
    setDrawerOpen(false);
    if (user) markRoomRead(user.uid, room.id, "");
    setUnreadMap(m => ({ ...m, [room.id]: 0 }));
  }, [user]);

  const handleRoomCreated = useCallback((roomId, roomData) => {
    setActiveRoom({ id: roomId, ...roomData });
    setShowModal(false);
    showToast(`#${roomData.name} created`, "🔮");
  }, [showToast]);

  return (
    <>
      {/* Mobile drawer overlay */}
      <div
        className={`mob-overlay${drawerOpen ? " show" : ""}`}
        onClick={() => setDrawerOpen(false)}
      />

      <div className={`dashboard-shell${phase === "glitch" ? " is-glitching" : ""}`}>
        <Sidebar
          user={user}
          profile={profile}
          rooms={rooms}
          activeRoom={activeRoom}
          unreadMap={unreadMap}
          onSelectRoom={handleSelectRoom}
          onCreateRoom={() => setShowModal(true)}
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />

        <ChatFeed
          user={user}
          profile={profile}
          room={activeRoom}
          phase={phase}
          secondsLeft={secondsLeft}
          onMenuOpen={() => setDrawerOpen(true)}
          onCreateRoom={() => setShowModal(true)}
          showToast={showToast}
        />

        <div className="details-col">
          <Details
            user={user}
            room={activeRoom}
            secondsLeft={secondsLeft}
            phase={phase}
          />
        </div>
      </div>

      <MobileNav onMenuOpen={() => setDrawerOpen(true)} />

      {/* Glitch overlay */}
      {phase === "glitch" && <div className="glitch-overlay" />}

      {/* Countdown overlay */}
      {phase === "countdown" && secondsLeft !== null && (
        <div className="meltdown-overlay">
          <div className="meltdown-count">{secondsLeft}</div>
        </div>
      )}

      {showModal && (
        <RoomModal
          user={user}
          profile={profile}
          onCreated={handleRoomCreated}
          onClose={() => setShowModal(false)}
        />
      )}

      <Toast toasts={toasts} />
    </>
  );
}