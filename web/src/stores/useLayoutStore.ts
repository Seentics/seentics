import { create } from 'zustand'

interface LayoutState {
  isSidebarOpen: boolean
  isMobileMenuOpen: boolean
  expandedItems: string[]
  showUserMenu: boolean
  toggleSidebar: () => void
  toggleMobileMenu: () => void
  closeMobileMenu: () => void
  toggleExpanded: (itemName: string) => void
  setShowUserMenu: (show: boolean) => void
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  isSidebarOpen: true,
  isMobileMenuOpen: false,
  expandedItems: [],
  showUserMenu: false,
  
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  
  toggleMobileMenu: () => set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),
  
  closeMobileMenu: () => set({ isMobileMenuOpen: false }),
  
  toggleExpanded: (itemName: string) => set((state) => ({
    expandedItems: state.expandedItems.includes(itemName)
      ? state.expandedItems.filter(item => item !== itemName)
      : [...state.expandedItems, itemName]
  })),
  
  setShowUserMenu: (show: boolean) => set({ showUserMenu: show })
}))