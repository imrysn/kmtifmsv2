/**
 * SmartNavigation — index.jsx
 *
 * Re-exports from the canonical .js implementations so that imports of
 * '../shared/SmartNavigation' (resolving to this directory) always get
 * the same parseNotification and useSmartNavigation regardless of whether
 * Vite picks index.js or index.jsx first.
 *
 * The canonical implementations live in:
 *   ./parseNotification.js   — full role-aware notification router
 *   ./useSmartNavigation.js  — retry-loop hook for scroll/highlight/modal
 */
export { parseNotification } from './parseNotification';
export { useSmartNavigation } from './useSmartNavigation';
export { parseNotification as default } from './parseNotification';
