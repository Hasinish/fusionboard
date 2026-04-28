import { getPathBounds } from "../../components/canvas/geometryUtils";
import { 
  isValidCreateEvent, 
  isValidUpdateEvent, 
  isValidThemeEvent,
  isValidPathEvent
} from "./replayEventGuards";
import { getThemeFromEvent } from "./replayThemeUtils";

/**
 * applyReplayEvent.js
 * Pure state transition function for a single replay event.
 * 
 * @param {Object} state - Current replay state { elements, isDark, camera }
 * @param {Object} event - The event to apply
 * @returns {Object} New state
 */
export function applyReplayEvent(state, event) {
  const { elements, isDark } = state;
  const { type, targetElementId, payload } = event;

  switch (type) {
    case "element.created": {
      if (!isValidCreateEvent(event)) return state;
      // Overwrite if exists (allows live elements to be replaced by final version)
      const otherElements = elements.filter(el => el.id !== payload.element.id);
      return { ...state, elements: [...otherElements, payload.element] };
    }

    case "element.updated": {
      if (!isValidUpdateEvent(event)) return state;
      const existingElement = elements.find(el => el.id === targetElementId);
      if (!existingElement && payload.element?.id) {
        return { ...state, elements: [...elements, payload.element] };
      }
      const newElements = elements.map(el => 
        el.id === targetElementId ? { ...el, ...payload.element } : el
      );
      return { ...state, elements: newElements };
    }

    case "element.deleted": {
      if (!targetElementId) return state;
      return { ...state, elements: elements.filter(el => el.id !== targetElementId) };
    }

    case "board.cleared": {
      return { ...state, elements: [] };
    }

    case "theme.changed": {
      if (!isValidThemeEvent(event)) return state;
      const newTheme = getThemeFromEvent(payload);
      return { ...state, isDark: newTheme };
    }

    case "camera.moved": {
      if (!payload || !payload.camera) return state;
      return { ...state, camera: payload.camera };
    }

    case "bgMode.changed": {
      if (!payload || !payload.bgMode) return state;
      return { ...state, bgMode: payload.bgMode };
    }

    case "path.started": {
      if (!isValidPathEvent(event)) return state;
      const bounds = getPathBounds(payload.points);
      const newPath = {
        id: targetElementId,
        type: "path",
        points: payload.points,
        color: payload.color || (isDark ? "#FFFFFF" : "#000000"),
        width: payload.width || 2,
        opacity: payload.opacity || 1,
        ...bounds
      };
      return { ...state, elements: [...elements, newPath] };
    }

    case "path.appended": {
      if (!isValidPathEvent(event)) return state;
      const newElements = elements.map(el => {
        if (el.id === targetElementId && el.type === "path") {
          const newPoints = [...el.points, payload.newPoint];
          const bounds = getPathBounds(newPoints);
          return { ...el, points: newPoints, ...bounds };
        }
        return el;
      });
      return { ...state, elements: newElements };
    }

    case "path.finished":
      return state;

    case "cursor.moved": {
      if (!payload || !targetElementId) return state;
      const newCursors = {
        ...state.cursors,
        [targetElementId]: {
          x: payload.x,
          y: payload.y,
          name: payload.name,
          color: payload.color,
          avatar: payload.avatar,
        }
      };
      return { ...state, cursors: newCursors };
    }

    case "liveStroke.updated": {
      if (!payload?.stroke || !targetElementId) return state;
      return {
        ...state,
        liveStrokes: {
          ...(state.liveStrokes || {}),
          [targetElementId]: payload.stroke,
        },
      };
    }

    case "liveStroke.ended": {
      if (!targetElementId) return state;
      const nextLiveStrokes = { ...(state.liveStrokes || {}) };
      delete nextLiveStrokes[targetElementId];
      return { ...state, liveStrokes: nextLiveStrokes };
    }

    default:
      console.warn("[Replay] Unknown event type:", type);
      return state;
  }
}
