import { create } from 'zustand';
import { Node, Edge } from 'reactflow';

export interface AutomationTrigger {
  id: string;
  type: 'pageView' | 'click' | 'customEvent' | 'scroll' | 'timeOnPage' | 'userProperty' | 'webhook';
  label: string;
  config: {
    page?: string;
    event?: string;
    element?: string;
    scrollDepth?: number;
    timeThreshold?: number;
    property?: string;
    value?: any;
  };
}

export interface AutomationAction {
  id: string;
  type: 'email' | 'slack' | 'webhook' | 'modal' | 'banner' | 'notification' | 'crm' | 'analytics' | 'javascript';
  label: string;
  config: {
    to?: string;
    subject?: string;
    body?: string;
    slackChannel?: string;
    slackMessage?: string;
    webhookUrl?: string;
    webhookMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    webhookHeaders?: Record<string, string>;
    webhookBody?: any;
    modalTitle?: string;
    modalContent?: string;
    bannerText?: string;
    notificationText?: string;
    crmAction?: 'create' | 'update' | 'delete';
    crmFields?: Record<string, any>;
    analyticsEvent?: string;
    analyticsData?: Record<string, any>;
    javaScriptCode?: string;
  };
}

export interface AutomationCondition {
  id: string;
  type: 'if' | 'and' | 'or' | 'timeWindow' | 'userBehavior';
  label: string;
  config: {
    field?: string;
    operator?: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'between';
    value?: any;
    conditions?: AutomationCondition[];
    startTime?: string;
    endTime?: string;
    behaviorType?: 'bounce' | 'convert' | 'engage';
  };
}

export interface AutomationDelay {
  id: string;
  type: 'delay' | 'schedule';
  label: string;
  config: {
    duration?: number;
    unit?: 'seconds' | 'minutes' | 'hours' | 'days';
    scheduleTime?: string;
  };
}

export interface Automation {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  delay?: AutomationDelay;
  actions: AutomationAction[];
  createdAt: Date;
  updatedAt: Date;
  executions: number;
  lastExecuted?: Date;
  successRate?: number;
}

interface AutomationStoreState {
  // Workflow state
  nodes: Node[];
  edges: Edge[];
  automation: Partial<Automation>;
  selectedNodeId: string | null;
  isDirty: boolean;

  // Actions
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  setAutomation: (automation: Partial<Automation>) => void;
  setSelectedNodeId: (id: string | null) => void;
  setIsDirty: (dirty: boolean) => void;

  // Node operations
  addNode: (node: Node) => void;
  updateNode: (id: string, data: any) => void;
  deleteNode: (id: string) => void;

  // Workflow operations
  saveAutomation: (automation: Automation) => Promise<void>;
  loadAutomation: (id: string) => Promise<void>;
  publishAutomation: () => Promise<void>;
  testAutomation: (testData: any) => Promise<void>;
  resetWorkflow: () => void;
}

export const useAutomationStore = create<AutomationStoreState>((set, get) => ({
  nodes: [],
  edges: [],
  automation: {},
  selectedNodeId: null,
  isDirty: false,

  setNodes: (nodes) => set({ nodes, isDirty: true }),
  setEdges: (edges) => set({ edges, isDirty: true }),
  setAutomation: (automation) => set({ automation: { ...get().automation, ...automation }, isDirty: true }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setIsDirty: (dirty) => set({ isDirty: dirty }),

  addNode: (node) => {
    set((state) => ({
      nodes: [...state.nodes, node],
      isDirty: true,
    }));
  },

  updateNode: (id, data) => {
    set((state) => ({
      nodes: state.nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...data } } : node)),
      isDirty: true,
    }));
  },

  deleteNode: (id) => {
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== id),
      edges: state.edges.filter((edge) => edge.source !== id && edge.target !== id),
      isDirty: true,
    }));
  },

  saveAutomation: async (automation) => {
    try {
      const response = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(automation),
      });
      if (response.ok) {
        set({ isDirty: false });
      }
    } catch (error) {
      console.error('Failed to save automation:', error);
      throw error;
    }
  },

  loadAutomation: async (id) => {
    try {
      const response = await fetch(`/api/automations/${id}`);
      const data = await response.json();
      set({ automation: data, isDirty: false });
    } catch (error) {
      console.error('Failed to load automation:', error);
      throw error;
    }
  },

  publishAutomation: async () => {
    try {
      const automation = get().automation;
      const response = await fetch(`/api/automations/${automation.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        set((state) => ({
          automation: { ...state.automation, enabled: true },
          isDirty: false,
        }));
      }
    } catch (error) {
      console.error('Failed to publish automation:', error);
      throw error;
    }
  },

  testAutomation: async (testData) => {
    try {
      const automation = get().automation;
      const response = await fetch(`/api/automations/${automation.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData),
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to test automation:', error);
      throw error;
    }
  },

  resetWorkflow: () => {
    set({
      nodes: [],
      edges: [],
      automation: {},
      selectedNodeId: null,
      isDirty: false,
    });
  },
}));
