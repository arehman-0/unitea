import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  tokenId: string | null;
  signature: string | null;
  trustScore: number;
  isAuthenticated: boolean;

  // Actions
  setCredentials: (tokenId: string, signature: string) => void;
  setTrustScore: (score: number) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      tokenId: null,
      signature: null,
      trustScore: 2.5,
      isAuthenticated: false,

      setCredentials: (tokenId, signature) =>
        set({
          tokenId,
          signature,
          isAuthenticated: true,
        }),

      setTrustScore: (score) =>
        set({ trustScore: score }),

      logout: () =>
        set({
          tokenId: null,
          signature: null,
          trustScore: 2.5,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'unitea-auth',
    }
  )
);

// UI State
interface UIState {
  isSidebarOpen: boolean;
  activeTab: 'feed' | 'create' | 'profile' | 'admin';
  lastActivityTimestamp: number;
  toggleSidebar: () => void;
  setActiveTab: (tab: 'feed' | 'create' | 'profile' | 'admin') => void;
  markActivity: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarOpen: false,
  activeTab: 'feed',
  lastActivityTimestamp: Date.now(),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setActiveTab: (tab) => set({ activeTab: tab }),
  markActivity: () => set({ lastActivityTimestamp: Date.now() }),
}));
