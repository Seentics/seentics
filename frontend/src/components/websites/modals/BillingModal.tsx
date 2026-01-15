'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Check, CreditCard, Download, Zap } from 'lucide-react';

interface BillingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BillingModal({ isOpen, onClose }: BillingModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Billing & Subscription</DialogTitle>
          <DialogDescription>
            Manage your subscription plan and payment details.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Current Plan Card */}
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 border rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Zap className="w-24 h-24" />
            </div>
            
            <div className="relative z-10 flex justify-between items-start mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-xl">Pro Plan</h3>
                        <Badge variant="default" className="bg-primary/20 text-primary hover:bg-primary/20 border-0">ACTIVE</Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">$29/month • Next billing date: Feb 15, 2026</p>
                </div>
                <div className="text-right">
                    <Button variant="outline" className="bg-background/50 backdrop-blur-sm">Change Plan</Button>
                </div>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Monthly Events Usage</span>
                        <span className="font-medium">450,000 / 1,000,000</span>
                    </div>
                    <Progress value={45} className="h-2" />
                    <p className="text-xs text-muted-foreground">You have used 45% of your monthly event limit.</p>
                </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Payment Method</h4>
            <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-secondary rounded-md">
                        <CreditCard className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-sm font-medium">Visa ending in 4242</p>
                        <p className="text-xs text-muted-foreground">Expires 12/2028</p>
                    </div>
                </div>
                <Button variant="ghost" size="sm">Update</Button>
            </div>
          </div>

          {/* Recent Invoices */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Recent Invoices</h4>
            <div className="space-y-1">
                {[
                    { date: 'Jan 15, 2026', amount: '$29.00', status: 'Paid' },
                    { date: 'Dec 15, 2025', amount: '$29.00', status: 'Paid' },
                    { date: 'Nov 15, 2025', amount: '$29.00', status: 'Paid' },
                ].map((invoice, i) => (
                    <div key={i} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg text-sm transition-colors">
                        <div className="flex items-center gap-4">
                            <span className="text-muted-foreground w-24">{invoice.date}</span>
                            <span className="font-medium">{invoice.amount}</span>
                            <Badge variant="outline" className="text-xs font-normal h-5 border-green-200 text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                                {invoice.status}
                            </Badge>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Download className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
