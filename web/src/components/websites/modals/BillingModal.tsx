
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/stores/useAuthStore';
import { useSubscription } from '@/hooks/useSubscription';
import { Check, CreditCard, Loader2, Zap } from 'lucide-react';
import { isEnterprise } from '@/lib/features';

interface BillingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BillingModal({ isOpen, onClose }: BillingModalProps) {
  if (!isEnterprise) return null;
  const { user } = useAuth();
  const { subscription, loading: subscriptionLoading, getUsagePercentage } = useSubscription();
  
  const currentPlan = subscription?.plan || 'starter';
  const usage = subscription?.usage?.monthlyEvents?.current || 0;
  const percentage = getUsagePercentage('monthlyEvents');

  const plans = [
    {
      name: 'Starter',
      price: '$0',
      description: 'For side projects',
      features: ['1 Website', '10K Events/mo', '100 Recordings', '3 Heatmaps', '1 Funnel', '1 Automation'],
      current: currentPlan === 'starter',
    },
    {
      name: 'Growth',
      price: '$29',
      description: 'For growing businesses',
      features: ['3 Websites', '200K Events/mo', '10K Recordings', 'Unlimited Heatmaps', '10 Funnels', '10 Automations'],
      current: currentPlan === 'growth',
    },
    {
      name: 'Pro',
      price: '$79',
      description: 'For scaling teams',
      features: ['15 Websites', '2M Events/mo', '50K Recordings', 'Unlimited Heatmaps', 'Unlimited Funnels'],
      current: currentPlan === 'pro',
    },
    {
      name: 'Enterprise',
      price: '$249',
      description: 'For agencies & large teams',
      features: ['100 Websites', '15M Events/mo', '200K Recordings', 'White Label', 'Dedicated Support'],
      current: currentPlan === 'enterprise',
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Billing & Subscription</DialogTitle>
          <DialogDescription>
            Manage your plan, usage, and billing details.
          </DialogDescription>
        </DialogHeader>

        {subscriptionLoading ? (
            <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        ) : (
             <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="plans">Plans</TabsTrigger>
                    <TabsTrigger value="invoices">Invoices</TabsTrigger>
                </TabsList>

                {/* OVERVIEW TAB */}
                <TabsContent value="overview" className="space-y-4 py-4">
                     <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold capitalize">{currentPlan} Plan</div>
                                <p className="text-xs text-muted-foreground">Renews on Feb 1, 2026</p>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Payment Method</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold flex items-center gap-2">
                                    <CreditCard className="h-6 w-6" /> •••• 4242
                                </div>
                                <p className="text-xs text-muted-foreground">Expires 12/28</p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Usage This Month</CardTitle>
                            <CardDescription>
                                You have used {usage.toLocaleString()} events out of your plan limit.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                             <div className="flex justify-between text-sm">
                                <span>{usage.toLocaleString()} events</span>
                                <span className="text-muted-foreground">{percentage.toFixed(1)}%</span>
                             </div>
                             <Progress value={percentage} className="h-2" />
                             {percentage > 80 && (
                                 <p className="text-sm text-amber-600 dark:text-amber-400 font-medium pt-2">
                                     You are approaching your plan limits. Consider upgrading to avoid specialized data sampling.
                                 </p>
                             )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* PLANS TAB */}
                <TabsContent value="plans" className="space-y-4 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {plans.map((plan) => (
                            <Card key={plan.name} className={`flex flex-col ${plan.current ? 'border-primary ring-1 ring-primary' : ''}`}>
                                <CardHeader>
                                    <CardTitle className="flex justify-between items-center">
                                        {plan.name}
                                        {plan.current && <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">Current</span>}
                                    </CardTitle>
                                    <div className="text-3xl font-bold">{plan.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                                    <CardDescription>{plan.description}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1">
                                    <ul className="space-y-2 text-sm">
                                        {plan.features.map((feature) => (
                                            <li key={feature} className="flex items-center gap-2">
                                                <Check className="h-4 w-4 text-green-500 shrink-0" />
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                                <CardFooter>
                                    <Button className="w-full" variant={plan.current ? "outline" : "default"} disabled={plan.current}>
                                        {plan.current ? "Current Plan" : "Upgrade"}
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                 {/* INVOICES TAB */}
                 <TabsContent value="invoices" className="space-y-4 py-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Invoice History</CardTitle>
                            <CardDescription>View and download past invoices.</CardDescription>
                        </CardHeader>
                         <CardContent>
                             <div className="text-sm text-center py-8 text-muted-foreground">
                                No invoices found.
                             </div>
                             {/* Future implementation: List of invoices */}
                        </CardContent>
                    </Card>
                 </TabsContent>

             </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
