'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe, Workflow, Filter, Plus } from 'lucide-react';
import { 
  useUpgradePrompt, 
  LimitReachedAlert, 
  UsageDashboard 
} from '@/components/subscription';

// Example: Website Creation Component
export const CreateWebsiteButton: React.FC = () => {
  const { showUpgradeModal, canCreate, UpgradeModal } = useUpgradePrompt();

  const handleCreateWebsite = () => {
    if (!canCreate('websites')) {
      showUpgradeModal('websites');
      return;
    }
    
    // Proceed with website creation
    console.log('Creating website...');
    // Your website creation logic here
  };

  return (
    <>
      <Button onClick={handleCreateWebsite} className="gap-2">
        <Plus className="h-4 w-4" />
        Create Website
      </Button>
      <UpgradeModal />
    </>
  );
};

// Example: Workflow Creation Component
export const CreateWorkflowButton: React.FC = () => {
  const { showUpgradeModal, canCreate, UpgradeModal } = useUpgradePrompt();

  const handleCreateWorkflow = () => {
    if (!canCreate('workflows')) {
      showUpgradeModal('workflows');
      return;
    }
    
    // Proceed with workflow creation
    console.log('Creating workflow...');
    // Your workflow creation logic here
  };

  return (
    <>
      <Button onClick={handleCreateWorkflow} className="gap-2">
        <Plus className="h-4 w-4" />
        Create Workflow
      </Button>
      <UpgradeModal />
    </>
  );
};

// Example: Funnel Creation Component
export const CreateFunnelButton: React.FC = () => {
  const { showUpgradeModal, canCreate, UpgradeModal } = useUpgradePrompt();

  const handleCreateFunnel = () => {
    if (!canCreate('funnels')) {
      showUpgradeModal('funnels');
      return;
    }
    
    // Proceed with funnel creation
    console.log('Creating funnel...');
    // Your funnel creation logic here
  };

  return (
    <>
      <Button onClick={handleCreateFunnel} className="gap-2">
        <Plus className="h-4 w-4" />
        Create Funnel
      </Button>
      <UpgradeModal />
    </>
  );
};

// Example: Dashboard with Limit Alerts
export const DashboardWithLimits: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Usage Dashboard */}
      <UsageDashboard />
      
      {/* Limit Alerts */}
      <div className="space-y-4">
        <LimitReachedAlert
          type="websites"
          title="Website Limit Reached"
          onDismiss={() => console.log('Website alert dismissed')}
        />
        
        <LimitReachedAlert
          type="workflows"
          title="Workflow Limit Reached"
          onDismiss={() => console.log('Workflow alert dismissed')}
        />
        
        <LimitReachedAlert
          type="funnels"
          title="Funnel Limit Reached"
          onDismiss={() => console.log('Funnel alert dismissed')}
        />
        
        <LimitReachedAlert
          type="monthlyEvents"
          title="Monthly Events Limit Reached"
          showUpgradeButton={true}
        />
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="h-5 w-5" />
              Websites
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Manage your websites and tracking
            </p>
            <CreateWebsiteButton />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Workflow className="h-5 w-5" />
              Workflows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Automate your business processes
            </p>
            <CreateWorkflowButton />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-5 w-5" />
              Funnels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Track conversion funnels
            </p>
            <CreateFunnelButton />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
