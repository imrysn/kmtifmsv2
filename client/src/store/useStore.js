import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Global Application Store
 * 
 * Manages application-wide state including:
 * - User authentication
 * - Notifications
 * - Loading states
 * - File cache
 */

// ── Storage backend ──────────────────────────────────────────────────────────
// In Electron (with contextIsolation + sandbox), browser localStorage may not
// flush before the process exits. Use the native app-storage IPC instead.
// Fall back to localStorage when running outside Electron (browser/dev HMR).
const createElectronStorage = () => ({
  getItem: async (name) => {
    try {
      if (window.electron?.appStorage) {
        const val = await window.electron.appStorage.get(name);
        return val ?? null;
      }
    } catch { /* ignore */ }
    return localStorage.getItem(name);
  },
  setItem: async (name, value) => {
    try {
      if (window.electron?.appStorage) {
        await window.electron.appStorage.set(name, value);
        return;
      }
    } catch { /* ignore */ }
    localStorage.setItem(name, value);
  },
  removeItem: async (name) => {
    try {
      if (window.electron?.appStorage) {
        await window.electron.appStorage.set(name, null);
        return;
      }
    } catch { /* ignore */ }
    localStorage.removeItem(name);
  },
});
const useStore = create(
    persist(
        (set, get) => ({
            // ============================================================================
            // HYDRATION STATE
            // ============================================================================
            _hasHydrated: false,
            setHasHydrated: (val) => set({ _hasHydrated: val }),

            // ============================================================================
            // USER AUTHENTICATION STATE
            // ============================================================================
            user: null,
            token: null,

            setUser: (user) => set({ user }),
            setToken: (token) => set({ token }),

            login: (userData, token) => {
                set({ user: userData, token: token });
            },

            logout: () => {
                set({
                    user: null,
                    token: null,
                    filesCache: {},
                    assignmentsCache: {}
                });
            },

            updateUser: (updates) => {
                const currentUser = get().user;
                if (currentUser) {
                    set({ user: { ...currentUser, ...updates } });
                }
            },

            // ============================================================================
            // NOTIFICATIONS STATE (Legacy/Toast)
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
            // SERVER NOTIFICATIONS STATE (Global Caching)
            // ============================================================================
            serverNotifications: [],
            globalUnreadCount: 0,
            notifPage: 1,
            notifHasMore: true,

            setServerNotifications: (notifs) => set((state) => ({ 
                serverNotifications: typeof notifs === 'function' ? notifs(state.serverNotifications) : notifs 
            })),
            setGlobalUnreadCount: (count) => set((state) => ({ 
                globalUnreadCount: typeof count === 'function' ? count(state.globalUnreadCount) : count 
            })),
            setNotifPagination: (page, hasMore) => set({ notifPage: page, notifHasMore: hasMore }),
            clearServerNotifications: () => set({ 
                serverNotifications: [], 
                globalUnreadCount: 0, 
                notifPage: 1, 
                notifHasMore: true 
            }),

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
            // FILES CACHE
            // ============================================================================
            filesCache: {},

            setFilesCache: (userId, files) => {
                set((state) => ({
                    filesCache: { ...state.filesCache, [userId]: files }
                }));
            },

            getFilesCache: (userId) => {
                return get().filesCache[userId] || null;
            },

            clearFilesCache: (userId = null) => {
                if (userId) {
                    set((state) => {
                        const newCache = { ...state.filesCache };
                        delete newCache[userId];
                        return { filesCache: newCache };
                    });
                } else {
                    set({ filesCache: {} });
                }
            },

            // ============================================================================
            // ASSIGNMENTS CACHE
            // ============================================================================
            assignmentsCache: {},

            setAssignmentsCache: (key, assignments) => {
                set((state) => ({
                    assignmentsCache: { 
                        ...state.assignmentsCache, 
                        [key]: typeof assignments === 'function' ? assignments(state.assignmentsCache[key] || []) : assignments 
                    }
                }));
            },

            getAssignmentsCache: (key) => {
                return get().assignmentsCache[key] || null;
            },

            clearAssignmentsCache: (key = null) => {
                if (key) {
                    set((state) => {
                        const newCache = { ...state.assignmentsCache };
                        delete newCache[key];
                        return { assignmentsCache: newCache };
                    });
                } else {
                    set({ assignmentsCache: {} });
                }
            },

            // ============================================================================
            // PERFORMANCE & TEAM TASKS CACHE (Dashboard)
            // ============================================================================
            userPerformanceCache: {},
            teamTasksCache: {},

            setUserPerformanceCache: (userId, performance) => {
                set((state) => ({
                    userPerformanceCache: { ...state.userPerformanceCache, [userId]: performance }
                }));
            },

            setTeamTasksCache: (team, tasks) => {
                set((state) => ({
                    teamTasksCache: { 
                        ...state.teamTasksCache, 
                        [team]: typeof tasks === 'function' ? tasks(state.teamTasksCache[team] || []) : tasks 
                    }
                }));
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
            isOnline: navigator.onLine,

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
            storage: createJSONStorage(createElectronStorage),
            // Only persist user data, not cache or temporary states
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                theme: state.theme,
                sidebarOpen: state.sidebarOpen
            }),
            onRehydrateStorage: () => (state) => {
                if (state) state.setHasHydrated(true);
            },
        }
    )
);

export default useStore;
