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
      <header className="sticky top-0 z-40 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200/60 dark:border-gray-700/60 shadow-sm">
      <div className="flex justify-between items-center h-16 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          {/* Mobile Menu Button */}
          <button
            onClick={toggleMobileMenu}
            className="lg:hidden inline-flex items-center justify-center h-10 w-10 rounded-lg text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Desktop Sidebar Toggle */}
          <button
            onClick={toggleSidebar}
            className="hidden lg:flex items-center px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {isSidebarOpen ? (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Collapse</span>
              </>
            ) : (
              <>
                <ChevronRight className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Expand</span>
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

        <div className="flex items-center space-x-3">
          {/* Automation Link */}
          <Link 
            href="https://automation.seentics.com" 
            target="_blank"
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all text-xs font-bold"
          >
            <Workflow size={14} />
            <span>Automation</span>
          </Link>

          <Separator orientation="vertical" className="h-6 hidden md:block" />

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* User Profile Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                className="flex items-center space-x-3 h-auto px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-colors shadow-sm"
              >
                <Avatar className="h-8 w-8 ring-2 ring-gray-100 dark:ring-gray-700">
                  <AvatarImage src={user?.avatar || undefined} alt={user?.name || 'User'} />
                  <AvatarFallback className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium">
                    {user?.name ? user.name.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block text-left min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {user?.name || 'User'}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {user?.email || 'user@example.com'}
                  </p>
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="end">
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