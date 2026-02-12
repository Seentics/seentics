'use client'

import { ThemeToggle } from '@/components/theme-toggle'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/stores/useAuthStore'
import { useLayoutStore } from '@/stores/useLayoutStore'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  LogOut,
  Menu,
  Settings,
  User,
  Workflow
} from 'lucide-react'
import Link from 'next/link'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect } from 'react'
import { SiteSelector } from './site-selector'
import { PromotionBanner } from './promotion-banner'
import { NotificationBell } from './notification-bell'

function HeaderContent() {
  const {
    isSidebarOpen,
    toggleSidebar,
    toggleMobileMenu
  } = useLayoutStore()

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const params = useParams()
  const { user, logout } = useAuth()
  const { toast } = useToast()


  // Get siteId from either URL params or search params
  const urlSiteId = params?.websiteId as string
  const searchSiteId = searchParams.get('siteId')
  const siteId = urlSiteId || searchSiteId

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        // On mobile, always close sidebar
      } else {
        // On desktop, ensure sidebar is open by default
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleSiteChange = (newSiteId: string) => {
    // If we're in a website-specific route, navigate to the same route with new siteId
    if (urlSiteId && pathname.includes('/websites/')) {
      const newPath = pathname.replace(`/websites/${urlSiteId}`, `/websites/${newSiteId}`)
      router.push(newPath)
    } else {
      // For other routes, use search params
      const newSearchParams = new URLSearchParams(searchParams.toString())
      newSearchParams.set('siteId', newSiteId)
      router.push(`${pathname}?${newSearchParams.toString()}`)
    }
  }

  const handleLogout = () => {
    // Clear auth state
    logout();
    // Redirect to signin
    router.push('/signin');
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out.",
    });
  };

  return (
    <>
      <PromotionBanner />
      <header className="sticky top-0 z-40 w-full bg-background/60 backdrop-blur-xl border-b border-border/40 transition-all duration-300">
      <div className="flex justify-between items-center h-16 px-4 sm:px-6 lg:px-10">
        <div className="flex items-center gap-6">
          {/* Mobile Menu Button */}
          <button
            onClick={toggleMobileMenu}
            className="lg:hidden inline-flex items-center justify-center h-10 w-10 rounded text-muted-foreground hover:text-foreground hover:bg-accent/10 focus:outline-none transition-all"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Desktop Sidebar Toggle */}
          <button
            onClick={toggleSidebar}
            className="hidden lg:flex items-center px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-accent/10 rounded transition-all gap-2"
            title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {isSidebarOpen ? (
              <>
                <ChevronLeft className="h-4 w-4" strokeWidth={3} />
                Collapse
              </>
            ) : (
              <>
                <ChevronRight className="h-4 w-4" strokeWidth={3} />
                Expand
              </>
            )}
          </button>

          {/* Site Selector */}
          <div className="hidden md:block">
            <SiteSelector
              selectedSiteId={siteId}
              onSiteChange={handleSiteChange}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <NotificationBell />
          <ThemeToggle />
          {/* User Profile Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center space-x-3 h-11 px-3 bg-accent/5 border border-border/40 hover:bg-accent/10 rounded transition-all shadow-sm"
              >
                <Avatar className="h-7 w-7 ring-2 ring-primary/20">
                  <AvatarImage src={user?.avatar || undefined} alt={user?.name || 'User'} />
                  <AvatarFallback className="bg-primary text-primary-foreground font-black text-xs">
                    {user?.name ? user.name.charAt(0).toUpperCase() : <User className="h-3 w-3" />}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block text-left min-w-0 flex-1">
                  <p className="text-[11px] font-black text-foreground uppercase tracking-wider truncate">
                    {user?.name || 'Explorer'}
                  </p>
                </div>
                <ChevronDown className="h-3 w-3 opacity-40 hidden md:block" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0 rounded border-border/40 shadow-2xl overflow-hidden" align="end">
              <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-12 w-12 ring-2 ring-white dark:ring-slate-700">
                    <AvatarImage src={user?.avatar || undefined} alt={user?.name || 'User'} />
                    <AvatarFallback className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold text-lg">
                      {user?.name ? user.name.charAt(0).toUpperCase() : <User className="h-6 w-6" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {user?.name || 'User'}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {user?.email || 'user@example.com'}
                    </p>
                  </div>
                </div>
              </div>
              <Separator />
              <div className="p-1">
                {/* Support Link */}
                <Link href={`/websites/${siteId}/support`}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-10 px-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    <HelpCircle className="h-4 w-4 mr-3 text-gray-600 dark:text-gray-400" />
                    Support
                  </Button>
                </Link>
                <Separator />

                {/* Admin Link - Only show for admin users */}
                {(user?.email === 'admin@seentics.com' || user?.email === 'shohag@seentics.com') && (
                  <>
                    <Link href="/admin">
                      <Button
                        variant="ghost"
                        className="w-full justify-start h-10 px-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        <Settings className="h-4 w-4 mr-3 text-gray-600 dark:text-gray-400" />
                        Admin Dashboard
                      </Button>
                    </Link>
                    <Separator />
                  </>
                )}
                <Button
                  variant="ghost"
                  className="w-full justify-start h-10 px-3 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-300"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-3 text-gray-600 dark:text-gray-400" />
                  Sign out
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </header>
    </>
  )
}

export default function Header() {
  return (
    <Suspense fallback={<div className="h-16 bg-gray-100 dark:bg-gray-800 animate-pulse" />}>
      <HeaderContent />
    </Suspense>
  )
}