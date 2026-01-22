'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlusCircle, Menu, Settings, LogOut, User, CreditCard, LifeBuoy, Users, BookOpen, Contact, Globe, Shield } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { ThemeToggle } from '../theme-toggle';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from '@/stores/useAuthStore';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { WebsitesManageModal } from './WebsitesManageModal';
import { TeamModal } from './modals/TeamModal';
import { BillingModal } from './modals/BillingModal';
import { SettingsModal } from './modals/SettingsModal';
import { DocsModal } from './modals/DocsModal';
import { SupportModal } from './modals/SupportModal';
import { AddWebsiteModal } from './AddWebsiteModal';
import { useRouter as useNextRouter, useParams } from 'next/navigation';
import { PrivacyModal } from './modals/PrivacyModal';
import { getWebsites } from '@/lib/websites-api';
import { useQuery } from '@tanstack/react-query';

interface WebsitesHeaderProps {
  // Removed onCreateWebsite prop - now handled internally
}

export function WebsitesHeader({}: WebsitesHeaderProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const nextRouter = useNextRouter();
  const params = useParams();
  
  // Check if we're in demo mode
  const isDemoMode = params?.websiteId === 'demo';
  
  const { data: websites = [] } = useQuery({
    queryKey: ['websites'],
    queryFn: getWebsites,
    enabled: !!user && !isDemoMode, // Don't fetch websites in demo mode without user
  });
  const [activeModal, setActiveModal] = useState<'team' | 'billing' | 'settings' | 'docs' | 'support' | 'manage-websites' | 'privacy' | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAddWebsiteModal, setShowAddWebsiteModal] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/signin');
  };

  const openModal = (modal: 'team' | 'billing' | 'settings' | 'docs' | 'support' | 'manage-websites' | 'privacy') => {
    setActiveModal(modal);
    setIsMenuOpen(false); // Close the sheet when a modal is opened
  };

  const handleAddWebsite = () => {
    setShowAddWebsiteModal(true);
    setIsMenuOpen(false);
  };

  const handleWebsiteAdded = (websiteId: string) => {
    // Redirect to the newly added website
    nextRouter.push(`/websites/${websiteId}`);
  };

  return (
    <>
    <div className=''>
      <header className="flex items-center justify-between p-4  backdrop-blur  max-w-7xl mx-auto">
        {/* ... Logo ... */}
        <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
          <Logo size="lg" showText={true} textClassName="font-headline text-2xl font-bold" />
        </Link>

        {/* ... Right Section ... */}
        <div className='flex items-center gap-2 sm:gap-4'>
            {/* ... Theme Toggle & Contact Support ... */}
             <ThemeToggle />
             {!isDemoMode && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                onClick={() => openModal('support')}
                title="Contact Support"
              >
                <Contact className="h-5 w-5" />
              </Button>
             )}

            {/* Demo Mode: Show Sign In button instead of user profile */}
            {isDemoMode && !user ? (
              <Link href="/signin">
                <Button variant="default" size="sm">
                  Sign In
                </Button>
              </Link>
            ) : user && (
            <DropdownMenu>
                {/* ... existing User Profile content ... */}
                <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={(user as any).user_metadata?.avatar_url} />
                    <AvatarFallback>{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">User</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setActiveModal('manage-websites')}>
                        <Globe className="mr-2 h-4 w-4" />
                        <span>Manage Websites</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            )}

            {/* Menu Sheet - Only show if not in demo mode or if user is authenticated */}
            {(!isDemoMode || user) && (
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>
                 <Button variant="default"  className="md:ml-2">
                    MENU
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Toggle menu</span>
                  </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col space-y-6 mt-6">
                  <div className="flex flex-col space-y-2">
                    {/* Add Website Option */}
                     <button
                        onClick={handleAddWebsite}
                        className="flex w-full items-center gap-2 px-2 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors text-left"
                      >
                        <PlusCircle className="h-4 w-4" />
                        Add Website
                      </button>
                    
                    {/* Manage Websites Option */}
                     <button
                        onClick={() => openModal('manage-websites')}
                        className="flex w-full items-center gap-2 px-2 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors text-left"
                      >
                        <Globe className="h-4 w-4" />
                        Manage Websites
                      </button>

                    <div className="h-px bg-border my-2" />

                    {/* ... Other Options ... */}
                    <button onClick={() => openModal('team')} className="flex w-full items-center gap-2 px-2 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors text-left">
                        <Users className="h-4 w-4" /> Team
                    </button>
                    <button onClick={() => openModal('billing')} className="flex w-full items-center gap-2 px-2 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors text-left">
                        <CreditCard className="h-4 w-4" /> Billing
                    </button>
                     <div className="h-px bg-border my-2" />
                    <button onClick={() => openModal('docs')} className="flex w-full items-center gap-2 px-2 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors text-left">
                        <BookOpen className="h-4 w-4" /> Documentation
                    </button>
                    <button onClick={() => openModal('support')} className="flex w-full items-center gap-2 px-2 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors text-left">
                        <LifeBuoy className="h-4 w-4" /> Support
                    </button>
                    <div className="h-px bg-border my-2" />
                    <button onClick={() => openModal('privacy')} className="flex w-full items-center gap-2 px-2 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors text-left">
                        <Shield className="h-4 w-4" /> Privacy & GDPR
                    </button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            )}
        </div>
      </header>
    </div>

    {/* Modals */}
    <TeamModal isOpen={activeModal === 'team'} onClose={() => setActiveModal(null)} />
    <BillingModal isOpen={activeModal === 'billing'} onClose={() => setActiveModal(null)} />
    {/* SettingsModal is now controlled within ManageWebsites or Dashboard, removing redundant standalone trigger for current site. 
        Actually, the user might want global settings, but usually settings are per site. 
        For now, let's keep the hook for consistency with the requested modals but note: 
        SettingsModal usually needs a specific website context. If clicked from global menu, 
        it's ambiguous WHICH website to configure. 
        
        DECISION: The "Manage Websites" modal is the better place for settings. 
        However, to satisfy the user request for "Settings" modal being functional, 
        we will make the global settings button open "Manage Websites" instead, 
        or show a user settings modal. 
        
        Given the flow, I'll point "Settings" to "User Settings" (which we might mock or reuse) 
        OR redirect to Manage Websites. Let's redirect "Settings" in the menu to Manage Websites 
        since that's where website settings live.
    */}
    <WebsitesManageModal isOpen={activeModal === 'manage-websites' || activeModal === 'settings'} onClose={() => setActiveModal(null)} />
    <PrivacyModal isOpen={activeModal === 'privacy'} onClose={() => setActiveModal(null)} website={(websites.find(w => w.id === params?.websiteId) || websites[0])!} />
    <DocsModal isOpen={activeModal === 'docs'} onClose={() => setActiveModal(null)} />
    <SupportModal isOpen={activeModal === 'support'} onClose={() => setActiveModal(null)} />
    <AddWebsiteModal 
      open={showAddWebsiteModal} 
      onOpenChange={setShowAddWebsiteModal}
      onSuccess={handleWebsiteAdded}
    />
    </>
  );
}
