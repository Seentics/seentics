'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Settings, LogOut, Globe, PlusCircle, Workflow } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { ThemeToggle } from '../theme-toggle';
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
import { useRouter, useParams } from 'next/navigation';
import { useState } from 'react';
import { AddWebsiteModal } from './AddWebsiteModal';

export function WebsitesHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const params = useParams();
  
  const isDemoMode = params?.websiteId === 'demo';
  const [showAddWebsiteModal, setShowAddWebsiteModal] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/signin');
  };

  const handleWebsiteAdded = (websiteId: string) => {
    router.push(`/websites/${websiteId}`);
  };

  return (
    <>
    <div className=''>
      <header className="flex items-center justify-between p-4 backdrop-blur max-w-7xl mx-auto">
        <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
          <Logo size="lg" showText={true} textClassName="font-headline text-2xl font-bold" />
        </Link>

        <div className='flex items-center gap-2 sm:gap-4'>

             <ThemeToggle />

             <div className='flex items-center gap-2'>
               

                {user && (
                <Link href={params?.websiteId && !isDemoMode ? `/websites/${params.websiteId}/settings` : '/settings'}>
                    <Button variant="brand" className="gap-2 font-bold uppercase tracking-wider text-[11px] h-9 px-4 ">
                    <Settings className="h-3.5 w-3.5" />
                    Workspace
                    </Button>
                </Link>
                )}
             </div>

            {isDemoMode && !user ? (
              <Link href="/signin">
                <Button variant="outline" size="sm" className='font-bold text-[11px] uppercase tracking-wider'>
                  Sign In
                </Button>
              </Link>
            ) : user && (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
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
                    <DropdownMenuItem onClick={() => setShowAddWebsiteModal(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        <span>Add Website</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            )}
        </div>
      </header>
    </div>

    <AddWebsiteModal 
      open={showAddWebsiteModal} 
      onOpenChange={setShowAddWebsiteModal}
      onSuccess={handleWebsiteAdded}
    />
    </>
  );
}
