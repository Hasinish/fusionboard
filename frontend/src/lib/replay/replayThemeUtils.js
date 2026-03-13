/**
 * replayThemeUtils.js
 * Utilities for resolving and managing theme state in whiteboard replays.
 */

/**
 * Resolves the initial theme for a recording session.
 * 1. Checks initialSnapshot.isDark
 * 2. Falls back to false (light mode)
 *
 * @param {Object} recording - The recording session object.
 * @returns {boolean} - Resolved isDark value.
 */
export const resolveInitialTheme = (recording) => {
  if (!recording || !recording.initialSnapshot) return false;
  
  const { isDark } = recording.initialSnapshot;
  if (typeof isDark === 'boolean') return isDark;
  
  return false; // Default to Light Mode
};

/**
 * Updates the theme state based on a theme change event.
 *
 * @param {Object} payload - The event payload.
 * @returns {boolean|null} - The new isDark value or null if invalid.
 */
export const getThemeFromEvent = (payload) => {
  if (payload && typeof payload.isDark === 'boolean') {
    return payload.isDark;
  }
  return null;
};
