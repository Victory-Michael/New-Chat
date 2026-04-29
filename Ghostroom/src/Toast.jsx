import React from "react";
import "./Toast.css";

export default function Toast({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast-item">
          <span className="toast-icon">{toast.icon}</span>
          <span className="toast-msg">{toast.msg}</span>
        </div>
      ))}
    </div>
  );
}