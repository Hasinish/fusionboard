/**
 * replayEventGuards.js
 * Safe guards and validation for replay events.
 */

/**
 * Validates if an element.created event has the required fields.
 */
export const isValidCreateEvent = (event) => {
  const { payload } = event;
  if (!payload || !payload.element || !payload.element.id) {
    console.warn("[Replay] Invalid element.created event missing element or id:", event);
    return false;
  }
  return true;
};

/**
 * Validates if an element.updated event has a target.
 */
export const isValidUpdateEvent = (event) => {
  const { targetElementId, payload } = event;
  if (!targetElementId || !payload) {
    console.warn("[Replay] Invalid element.updated event missing target or payload:", event);
    return false;
  }
  return true;
};

/**
 * Validates if a theme.changed event has required payload.
 */
export const isValidThemeEvent = (event) => {
  const { payload } = event;
  if (!payload || typeof payload.isDark !== 'boolean') {
    console.warn("[Replay] Invalid theme.changed event missing payload.isDark:", event);
    return false;
  }
  return true;
};

/**
 * Validates path events.
 */
export const isValidPathEvent = (event) => {
  const { targetElementId, payload } = event;
  if (!targetElementId) return false;
  
  if (event.type === 'path.started' && (!payload || !payload.points)) return false;
  if (event.type === 'path.appended' && (!payload || !payload.newPoint)) return false;
  
  return true;
};
