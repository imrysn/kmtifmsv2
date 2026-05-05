import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Global Application Store
 * 
 * Manages application-wide state including:
 * - User authentication
 * - Notifications
 * - Loading states
 * - File cache
 */
const useStore = create(
    persist(
        (set, get) => ({
            // ============================================================================
            // USER AUTHENTICATION STATE
            // ============================================================================
            user: null,

            setUser: (user) => set({ user }),

            login: (userData) => {
                set({ user: userData });
            },

            logout: () => {
                set({
                    user: null
                });
            },

            updateUser: (updates) => {
                const currentUser = get().user;
                if (currentUser) {
                    set({ user: { ...currentUser, ...updates } });
                }
            },

            // ============================================================================
            // NOTIFICATIONS STATE
            // ============================================================================
            notifications: [],

            addNotification: (notification) => {
                const id = Date.now();
                set((state) => ({
                    notifications: [
                        ...state.notifications,
                        { ...notification, id, timestamp: new Date().toISOString() }
                    ]
                }));
                return id;
            },

            removeNotification: (id) => {
                set((state) => ({
                    notifications: state.notifications.filter(n => n.id !== id)
                }));
            },

            clearNotifications: () => set({ notifications: [] }),

            markNotificationAsRead: (id) => {
                set((state) => ({
                    notifications: state.notifications.map(n =>
                        n.id === id ? { ...n, read: true } : n
                    )
                }));
            },

            // ============================================================================
            // LOADING STATES
            // ============================================================================
            loading: {},

            setLoading: (key, value) => {
                set((state) => ({
                    loading: { ...state.loading, [key]: value }
                }));
            },

            isLoading: (key) => {
                return get().loading[key] || false;
            },


            // ============================================================================
            // UI STATE
            // ============================================================================
            sidebarOpen: true,

            toggleSidebar: () => {
                set((state) => ({ sidebarOpen: !state.sidebarOpen }));
            },

            setSidebarOpen: (open) => set({ sidebarOpen: open }),

            // ============================================================================
            // NETWORK STATE
            // ============================================================================
            isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,

            setOnline: (online) => set({ isOnline: online }),

            // ============================================================================
            // THEME STATE
            // ============================================================================
            theme: 'light',

            setTheme: (theme) => set({ theme }),

            toggleTheme: () => {
                set((state) => ({
                    theme: state.theme === 'light' ? 'dark' : 'light'
                }));
            }
        }),
        {
            name: 'kmti-fms-storage',
            // Only persist user data, not cache or temporary states
            partialize: (state) => ({
                user: state.user,
                theme: state.theme,
                sidebarOpen: state.sidebarOpen
            })
        }
    )
);

export default useStore;
