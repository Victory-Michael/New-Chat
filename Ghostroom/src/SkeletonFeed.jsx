// src/SkeletonFeed.jsx
import React from "react";

export default function SkeletonFeed() {
  return (
    <div className="skeleton-container">
      {/* Dynamic top shimmer bar */}
      <div className="ux-loading-bar" />
      
      {/* Pulsing skeleton items */}
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="skeleton-row" style={{ opacity: 1 - index * 0.2 }}>
          <div className="skeleton-avatar" />
          <div className="skeleton-text-group">
            <div className="skeleton-line short" />
            <div className="skeleton-line long" />
          </div>
        </div>
      ))}
    </div>
  );
}