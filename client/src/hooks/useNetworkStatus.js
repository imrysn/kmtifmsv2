import { useNetwork } from '../contexts/NetworkContext'

/**
 * Alias hook for useNetwork from NetworkContext
 * Provides network status information
 * 
 * @returns {object} Network status
 * @returns {boolean} isOnline - Browser online status
 * @returns {boolean} isServerAvailable - Server health check status
 * @returns {boolean} isConnected - Combined status (online && server available)
 * @returns {Date} lastChecked - Last check timestamp
 * @returns {Function} checkNetworkStatus - Manually trigger network check
 * @returns {Function} setCheckInterval - Update check interval
 * 
 * @example
 * const { isConnected, isServerAvailable } = useNetworkStatus()
 * 
 * if (!isConnected) {
 *   return <OfflineMessage />
 * }
 */
export const useNetworkStatus = () => {
  return useNetwork()
}

export default useNetworkStatus
