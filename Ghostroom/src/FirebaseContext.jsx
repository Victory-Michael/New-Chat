import React, { createContext, useContext, useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";

// Initialize Firebase (Add your config here)
const firebaseConfig = { /* Your keys */ };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const MsgInContext = createContext();

export function MsgInProvider({ children }) {
  const [currentRoom, setCurrentRoom] = useState(null);
  const [messages, setMessages] = useState([]);

  // Room Creator Logic (The 4-6 digit ID)
  const createRoom = async (limit) => {
    const roomId = Math.floor(10000 + Math.random() * 90000).toString();
    // Logic to push to Firestore...
    setCurrentRoom(roomId);
  };

  return (
    <MsgInContext.Provider value={{ currentRoom, messages, createRoom }}>
      {children}
    </MsgInContext.Provider>
  );
}