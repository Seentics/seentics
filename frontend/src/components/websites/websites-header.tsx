'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlusCircle, Menu, Settings, LogOut, User, CreditCard, LifeBuoy, Users, BookOpen, Contact } from 'lucide-react';
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
import { TeamModal } from './modals/TeamModal';
import { BillingModal } from './modals/BillingModal';
import { SettingsModal } from './modals/SettingsModal';
import { DocsModal } from './modals/DocsModal';
import { SupportModal } from './modals/SupportModal';

interface WebsitesHeaderProps {
  onCreateWebsite?: () => void;
}

export function WebsitesHeader({ onCreateWebsite }: WebsitesHeaderProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [activeModal, setActiveModal] = useState<'team' | 'billing' | 'settings' | 'docs' | 'support' | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/signin');
  };

  const openModal = (modal: 'team' | 'billing' | 'settings' | 'docs' | 'support') => {
    setActiveModal(modal);
    setIsMenuOpen(false); // Close the sheet when a modal is opened
  };

  return (
    <>
    <div className=''>
      <header className="flex items-center justify-between p-4  backdrop-blur  max-w-7xl mx-auto">
        <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
          <Logo size="lg" showText={true} textClassName="font-headline text-2xl font-bold" />
        </Link>

        <div className='flex items-center gap-2 sm:gap-4'>
           {/* Add Website Button (Desktop) */}
          {onCreateWebsite && (
            <Button onClick={onCreateWebsite} className="hidden sm:flex shadow-sm" size="sm">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add website
            </Button>
          )}

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Contact Support */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            onClick={() => openModal('support')}
            title="Contact Support"
          >
            <Contact className="h-5 w-5" />
          </Button>

          {/* User Profile */}
          {user && (
            <DropdownMenu>
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
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Menu Sheet */}
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

                  <button
                    onClick={() => openModal('team')}
                    className="flex w-full items-center gap-2 px-2 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors text-left"
                  >
                    <Users className="h-4 w-4" />
                    Team
                  </button>

                  <button
                    onClick={() => openModal('billing')}
                    className="flex w-full items-center gap-2 px-2 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors text-left"
                  >
                    <CreditCard className="h-4 w-4" />
                    Billing
                  </button>

                  <button
                    onClick={() => openModal('settings')}
                    className="flex w-full items-center gap-2 px-2 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors text-left"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </button>
                   
                   <div className="h-px bg-border my-2" />
                   
                   <button
                    onClick={() => openModal('docs')}
                    className="flex w-full items-center gap-2 px-2 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors text-left"
                  >
                    <BookOpen className="h-4 w-4" />
                    Documentation
                  </button>

                  <button
                    onClick={() => openModal('support')}
                    className="flex w-full items-center gap-2 px-2 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors text-left"
                  >
                    <LifeBuoy className="h-4 w-4" />
                    Support
                  </button>

                   {/* Mobile Add Website Button */}
                   {onCreateWebsite && (
                    <div className="pt-2">
                        <Button onClick={onCreateWebsite} className="sm:hidden w-full justify-start">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add website
                        </Button>
                    </div>
                   )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>
    </div>

    {/* Modals */}
    <TeamModal isOpen={activeModal === 'team'} onClose={() => setActiveModal(null)} />
    <BillingModal isOpen={activeModal === 'billing'} onClose={() => setActiveModal(null)} />
    <SettingsModal isOpen={activeModal === 'settings'} onClose={() => setActiveModal(null)} />
    <DocsModal isOpen={activeModal === 'docs'} onClose={() => setActiveModal(null)} />
    <SupportModal isOpen={activeModal === 'support'} onClose={() => setActiveModal(null)} />
    </>
  );
}
