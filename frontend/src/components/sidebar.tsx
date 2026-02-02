'use client'

import { Logo } from '@/components/ui/logo'
import { useLayoutStore } from '@/stores/useLayoutStore'
import { hasFeature } from '@/lib/features'
import {
  Activity,
  BarChart3,
  ChevronDown,
  CreditCard,
  FileText,
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


    const getNavigationItems = () => {
    const items = [
      { name: 'Overview', href: '', icon: Home },
      { name: 'Analytics', href: 'analytics', icon: BarChart3 },
    ];

    if (hasFeature('WORKFLOW_BASIC')) {
      items.push({ name: 'Automations', href: 'automations', icon: Workflow });
    }    if (hasFeature('FUNNEL_BASIC')) {
      items.push({ name: 'Funnels', href: 'funnels', icon: Target });
    }

    if (hasFeature('BILLING_PAGE')) {
      items.push({ name: 'Billing', href: 'billing', icon: CreditCard });
    }

    // Always show Privacy as requested
    items.push({ name: 'Privacy', href: 'privacy', icon: Shield });

    // Always show Settings
    items.push({ name: 'Settings', href: 'settings', icon: ChevronDown }); // Or use a different icon like Settings

    return items;
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
    const active = isActive(item.href)
    const expanded = isExpanded(item.name)
    const hasChildren = item.children && item.children.length > 0

    return (
      <div key={item.name} className="px-3">
        {hasChildren ? (
          <div className="flex items-center">
            <Link
              href={item.href === '' ? getBasePath() : `${getBasePath()}/${item.href}`}
              className={`flex items-center justify-center flex-1 px-4 py-3 text-sm font-medium transition-colors rounded ${active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-lg shadow-sidebar-accent/10'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                } ${isChild ? 'ml-4 pl-7' : ''}`}
            >
              <item.icon
                className={`mr-3 h-5 w-5 ${active ? 'text-sidebar-accent-foreground' : 'text-primary'}`}
              />
              {(isSidebarOpen || isMobileMenuOpen) && (
                <>
                  <span className="flex-1">{item.name}</span>
                  {item.badge && (
                    <span className="ml-2 px-2 py-1 text-xs font-semibold bg-destructive/10 text-destructive rounded-full">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </Link>
            <button
              onClick={() => toggleExpanded(item.name)}
              className="p-1.5 ml-2 rounded hover:bg-sidebar-accent transition-colors focus:outline-none focus:ring-2 focus:ring-sidebar-ring focus:ring-offset-1"
            >
              <ChevronDown
                className={`h-4 w-4 text-sidebar-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        ) : (
          <Link
            href={item.href === '' ? getBasePath() : `${getBasePath()}/${item.href}`}
            className={`
              flex items-center gap-3.5 px-4 py-3 rounded-xl text-[13px] font-bold transition-all duration-300 group relative
              ${active 
                ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm' 
                : 'text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800/30 hover:text-foreground border border-transparent'
              }
            `}
          >
            {active && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
            )}
            <item.icon className={`h-[18px] w-[18px] transition-all duration-300 ${active ? 'scale-110 text-primary' : 'group-hover:scale-110 text-muted-foreground group-hover:text-foreground'}`} />
            <span className="flex-1 tracking-tight">{item.name}</span>
            {item.name === 'Live Pulse' && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
            {item.badge && (
              <span className="ml-2 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 rounded">
                {item.badge}
              </span>
            )}
          </Link>
        )}
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
        } hidden lg:block transition-all duration-300 ease-in-out bg-sidebar border-r border-sidebar-border shadow-sm `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center h-16 px-4 border-b border-sidebar-border bg-sidebar">
            <div className="flex items-center">
              <Logo size="xl" />
              {isSidebarOpen && (
                <div className="flex items-center gap-2">
                  <span className="ml-3 text-xl font-bold text-sidebar-foreground">
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
          <div className="px-4 py-4 border-t border-sidebar-border bg-sidebar">
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-3 py-3 text-sm font-medium text-sidebar-foreground rounded hover:bg-destructive/10 hover:text-destructive transition-colors group"
            >
              <LogOut className="mr-3 h-5 w-5 text-sidebar-foreground group-hover:text-destructive" />
              {isSidebarOpen && <span>Sign out</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={toggleMobileMenu}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-sidebar shadow-xl">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                onClick={toggleMobileMenu}
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full bg-sidebar shadow-lg focus:outline-none focus:ring-2 focus:ring-sidebar-ring focus:ring-offset-2"
              >
                <X className="h-6 w-6 text-sidebar-foreground" />
              </button>
            </div>

            {/* Mobile menu content */}
            <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
              <div className="flex items-center flex-shrink-0 px-4">
                <Logo size="xl" />
                <div className="flex items-center gap-2">
                  <span className="ml-3 text-xl font-bold text-sidebar-foreground">
                    Seentics
                  </span>
                </div>
              </div>
              <nav className="mt-5 px-2 space-y-2">
                {navigationItems.map(item => renderNavItem(item))}

                {/* Mobile Logout */}
                <div className="pt-4 border-t border-sidebar-border">
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-3 py-3 text-sm font-medium text-sidebar-foreground rounded hover:bg-destructive/10 hover:text-destructive transition-colors group"
                  >
                    <LogOut className="mr-3 h-5 w-5 text-sidebar-foreground group-hover:text-destructive" />
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