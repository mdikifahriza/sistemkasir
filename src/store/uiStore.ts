import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
    isSidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    toggleSidebar: () => void;
    theme: 'light' | 'dark';
    toggleTheme: () => void;
}

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            isSidebarOpen: false,
            setSidebarOpen: (open) => set({ isSidebarOpen: open }),
            toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
            theme: 'light',
            toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
        }),
        {
            name: 'ui-storage',
            partialize: (state) => ({ theme: state.theme }),
        }
    )
);
