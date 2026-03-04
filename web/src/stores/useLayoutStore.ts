import { create } from 'zustand'

export type LayoutMode = 'sidebar' | 'dock' | 'header' | 'floating-header';

interface LayoutState {
  isSidebarOpen: boolean
  isMobileMenuOpen: boolean
  expandedItems: string[]
  showUserMenu: boolean
  layoutMode: LayoutMode
  toggleSidebar: () => void
  toggleMobileMenu: () => void
  closeMobileMenu: () => void
  toggleExpanded: (itemName: string) => void
  setShowUserMenu: (show: boolean) => void
  setLayoutMode: (mode: LayoutMode) => void
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  isSidebarOpen: true,
  isMobileMenuOpen: false,
  expandedItems: [],
  showUserMenu: false,
  layoutMode: 'sidebar',

  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

  toggleMobileMenu: () => set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),

  closeMobileMenu: () => set({ isMobileMenuOpen: false }),

  toggleExpanded: (itemName: string) => set((state) => ({
    expandedItems: state.expandedItems.includes(itemName)
      ? state.expandedItems.filter(item => item !== itemName)
      : [...state.expandedItems, itemName]
  })),

  setShowUserMenu: (show: boolean) => set({ showUserMenu: show }),

  setLayoutMode: (mode: LayoutMode) => set({ layoutMode: mode }),
}))