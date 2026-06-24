/**
 * SmartNavigation — re-export shim
 *
 * The canonical implementation lives in ./SmartNavigation/parseNotification.js
 * and ./SmartNavigation/useSmartNavigation.js.
 *
 * This flat file exists so that imports of '../shared/SmartNavigation'
 * (without sub-path) continue to resolve when Vite finds this .jsx before
 * the directory's index files. All named exports are forwarded from the
 * canonical .js sources — NOT from index.jsx — to guarantee one single
 * implementation regardless of Vite's resolution order.
 */
export { parseNotification } from './SmartNavigation/parseNotification';
export { useSmartNavigation } from './SmartNavigation/useSmartNavigation';
export { parseNotification as default } from './SmartNavigation/parseNotification';
