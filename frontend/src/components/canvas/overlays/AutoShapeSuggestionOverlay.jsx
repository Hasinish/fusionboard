import React, { useEffect, useRef } from "react";

/**
 * AutoShapeSuggestionOverlay
 *
 * A small non-blocking popup anchored near a recognized stroke.
 * Appears when `suggestion` is non-null.
 *
 * Props:
 * - suggestion: { elementId, kind, proposedElement, anchorBounds }
 * - onAccept: () => void
 * - onDismiss: () => void
 * - worldToScreen: (wx, wy) => { x, y }
 * - camera: { x, y, z } – needed to re-position on pan/zoom
 */
export default function AutoShapeSuggestionOverlay({
  suggestion,
  onAccept,
  onDismiss,
  worldToScreen,
  camera,
}) {
  const containerRef = useRef(null);

  // Keyboard handling: Enter = accept, Escape = dismiss
  useEffect(() => {
    if (!suggestion) return;

    const handler = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onAccept();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [suggestion, onAccept, onDismiss]);

  // Focus the container on mount so keyboard events work naturally
  useEffect(() => {
    if (suggestion && containerRef.current) {
      containerRef.current.focus();
    }
  }, [suggestion]);

  if (!suggestion || !worldToScreen) return null;

  // Compute screen-space anchor: center-top of the bounding box
  const b = suggestion.anchorBounds;
  if (!b) return null;

  const centerWorld = { x: b.x + b.w / 2, y: b.y };
  const screen = worldToScreen(centerWorld.x, centerWorld.y);

  // Offset: appear above the shape
  const left = screen.x;
  const top = screen.y - 52;

  const kindLabel =
    suggestion.kind === "square" ? "square" :
    suggestion.kind === "rectangle" ? "rectangle" :
    suggestion.kind === "triangle" ? "triangle" :
    suggestion.kind === "circle" ? "circle" :
    "shape";

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      role="dialog"
      aria-label={`Convert to ${kindLabel}`}
      className="auto-shape-suggestion"
      style={{
        position: "absolute",
        left: `${left}px`,
        top: `${top}px`,
        transform: "translateX(-50%)",
        zIndex: 45,
        pointerEvents: "auto",
        outline: "none",
      }}
      // Prevent clicks on the popup from propagating to the canvas
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 10px",
          borderRadius: "8px",
          background: "rgba(30, 30, 30, 0.88)",
          backdropFilter: "blur(8px)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.08)",
          color: "#fff",
          fontSize: "12px",
          fontFamily: "Inter, system-ui, sans-serif",
          whiteSpace: "nowrap",
          userSelect: "none",
        }}
      >
        <span style={{ opacity: 0.85 }}>
          Convert to {kindLabel}?
        </span>

        <button
          onClick={onAccept}
          title="Convert (Enter)"
          style={{
            padding: "3px 10px",
            borderRadius: "5px",
            border: "none",
            background: "#3b82f6",
            color: "#fff",
            fontSize: "11px",
            fontWeight: 600,
            cursor: "pointer",
            lineHeight: "1.4",
          }}
        >
          Convert
        </button>

        <button
          onClick={onDismiss}
          title="Keep sketch (Esc)"
          style={{
            padding: "3px 8px",
            borderRadius: "5px",
            border: "1px solid rgba(255,255,255,0.15)",
            background: "transparent",
            color: "rgba(255,255,255,0.7)",
            fontSize: "11px",
            cursor: "pointer",
            lineHeight: "1.4",
          }}
        >
          Keep sketch
        </button>
      </div>
    </div>
  );
}
