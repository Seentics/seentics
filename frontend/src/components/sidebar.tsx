'use client'

import { Logo } from '@/components/ui/logo'
import { useLayoutStore } from '@/stores/useLayoutStore'
import { hasFeature } from '@/lib/features'
import {
  BarChart3,
  ChevronDown,
  CreditCard,
  HelpCircle,
  Home,
  LogOut,
  Shield,
  Target,
  Workflow,
  X
} from 'lucide-react'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import React, { useEffect } from 'react'


interface NavItem {
  name: string
  href: string
  icon: React.ElementType
  badge?: string
  children?: NavItem[]
}

export default function Sidebar() {
  const {
    isSidebarOpen,
    isMobileMenuOpen,
    expandedItems,
    toggleMobileMenu,
    toggleExpanded,
    closeMobileMenu
  } = useLayoutStore()
  const pathname = usePathname()
  const params = useParams();
  const websiteId = params.websiteId


  // Generate navigation items based on context and feature flags
  const getNavigationItems = () => {
    const baseItems = [
      { name: 'Dashboard', href: '', icon: Home },
      {
        name: 'Analytics',
        href: 'analytics',
        icon: BarChart3,
      },
    ];

    // Add cloud-only features if enabled
    if (hasFeature('BILLING_PAGE')) {
      baseItems.push({
        name: 'Billing',
        href: 'billing',
        icon: CreditCard,
      });
    }

    if (hasFeature('SUPPORT_CHAT')) {
      baseItems.push({
        name: 'Support',
        href: 'support',
        icon: HelpCircle,
      });
    }

    // Add privacy settings (always available)
    baseItems.push({
      name: 'Privacy',
      href: 'privacy',
      icon: Shield,
    });

    return baseItems;
  };

  const navigationItems = getNavigationItems();

  // Close mobile menu when route changes
  useEffect(() => {
    closeMobileMenu()
  }, [pathname, closeMobileMenu])

  const isActive = (href: string) => {
    const fullHref = `/websites/${websiteId}${href === '' ? '' : `/${href}`}`
    // For exact match on dashboard (empty href)
    if (href === '') {
      return pathname === fullHref
    }
    // For other items, check if pathname starts with the href (includes nested pages)
    return pathname.startsWith(fullHref)
  }

  const getBasePath = () => {
    return `/websites/${websiteId}`
  }

  const isExpanded = (itemName: string) => expandedItems.includes(itemName)

  const handleLogout = () => {
    // Handle logout logic here
    console.log('Logging out...')
  }

  const renderNavItem = (item: NavItem, isChild = false) => {
    const hasChildren = item.children && item.children.length > 0
    const active = isActive(item.href)
    const expanded = isExpanded(item.name)
    const basePath = getBasePath()

    return (
      <div key={item.name}>
        <div className="flex items-center">
          <Link
            href={`${basePath}${item.href === '' ? '' : `/${item.href}`}`}
            className={`flex items-center justify-center flex-1 px-4 py-3 text-sm font-medium transition-colors rounded-lg ${active
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              } ${isChild ? 'ml-4 pl-7' : ''}`}
          >
            <item.icon
              className={`mr-3 h-5 w-5 ${active ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
            />
            {(isSidebarOpen || isMobileMenuOpen) && (
              <>
                <span className="flex-1">{item.name}</span>
                {item.badge && (
                  <span className="ml-2 px-2 py-1 text-xs font-semibold bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-full">
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </Link>
          {hasChildren && (isSidebarOpen || isMobileMenuOpen) && (
            <button
              onClick={() => toggleExpanded(item.name)}
              className="p-1.5 ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1"
            >
              <ChevronDown
                className={`h-4 w-4 text-slate-500 dark:text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>
        {hasChildren && expanded && (isSidebarOpen || isMobileMenuOpen) && (
          <div className="mt-1 space-y-1">
            {item.children?.map(child => renderNavItem(child, true))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-16'
        } hidden lg:block transition-all duration-300 ease-in-out bg-white dark:bg-slate-950 shadow-sm `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center h-16 px-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950">
            <div className="flex items-center">
              <Logo size="xl" />
              {isSidebarOpen && (
                <div className="flex items-center gap-2">
                  <span className="ml-3 text-xl font-bold text-slate-900 dark:text-white">
                    Seentics
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto">
            {navigationItems.map(item => renderNavItem(item))}
          </nav>

          {/* Logout Button */}
          <div className="px-4 py-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950">
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-3 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors group"
            >
              <LogOut className="mr-3 h-5 w-5 text-slate-500 dark:text-slate-400 group-hover:text-red-600 dark:group-hover:text-red-400" />
              {isSidebarOpen && <span>Sign out</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-600/80 dark:bg-slate-900/80 backdrop-blur-sm"
            onClick={toggleMobileMenu}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-slate-950 shadow-xl">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                onClick={toggleMobileMenu}
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full bg-white dark:bg-slate-800 shadow-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
              >
                <X className="h-6 w-6 text-slate-700 dark:text-slate-200" />
              </button>
            </div>

            {/* Mobile menu content */}
            <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
              <div className="flex items-center flex-shrink-0 px-4">
                <Logo size="xl" />
                <div className="flex items-center gap-2">
                  <span className="ml-3 text-xl font-bold text-slate-900 dark:text-white">
                    Seentics
                  </span>
                </div>
              </div>
              <nav className="mt-5 px-2 space-y-2">
                {navigationItems.map(item => renderNavItem(item))}

                {/* Mobile Logout */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-3 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors group"
                  >
                    <LogOut className="mr-3 h-5 w-5 text-slate-500 dark:text-slate-400 group-hover:text-red-600 dark:group-hover:text-red-400" />
                    <span>Sign out</span>
                  </button>
                </div>
              </nav>
            </div>
          </div>
        </div>
      )}
    </>
  )
}