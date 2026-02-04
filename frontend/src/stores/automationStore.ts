import { create } from 'zustand';
import api from '@/lib/api';
import {
  Node,
  Edge,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
} from 'reactflow';

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

  // ReactFlow specific
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;

  // Workflow operations
  saveAutomation: (websiteId: string, automationId?: string) => Promise<void>;
  loadAutomation: (websiteId: string, id: string) => Promise<void>;
  publishAutomation: (websiteId: string, id: string) => Promise<void>;
  testAutomation: (testData: any) => Promise<{ success: boolean }>;
  loadTemplate: (templateId: string) => void;
  resetWorkflow: () => void;

  // Transformation helper
  getLinearizedWorkflow: () => {
    name: string;
    description: string;
    triggerType: string;
    triggerConfig: any;
    actions: any[];
  };
}

export const useAutomationStore = create<AutomationStoreState>((set, get) => ({
  nodes: [],
  edges: [],
  automation: {},
  selectedNodeId: null,
  isDirty: false,

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
      isDirty: true,
    });
  },
  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
      isDirty: true,
    });
  },

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

  getLinearizedWorkflow: () => {
    const { nodes, edges, automation } = get();

    // 1. Find the active trigger node (one that has outgoing connections or is the only one)
    let triggerNode = nodes.find(n => n.type === 'triggerNode' && edges.some(e => e.source === n.id));
    if (!triggerNode) {
      // Fallback to the first trigger node if none are connected
      triggerNode = nodes.find(n => n.type === 'triggerNode');
    }

    if (!triggerNode) throw new Error('No trigger node found');

    // 2. Build the action and condition sequences by traversing the graph
    const actions: any[] = [];
    const conditions: any[] = [];
    const visited = new Set<string>();
    const queue = [triggerNode.id];
    visited.add(triggerNode.id);

    // BFS traversal to collect all reachable actions and conditions
    while (queue.length > 0) {
      const currentNodeId = queue.shift()!;
      const outgoingEdges = edges.filter(e => e.source === currentNodeId);

      for (const edge of outgoingEdges) {
        if (!visited.has(edge.target)) {
          visited.add(edge.target);
          const nextNode = nodes.find(n => n.id === edge.target);

          if (nextNode) {
            if (nextNode.type === 'actionNode') {
              actions.push({
                actionType: nextNode.data.config?.actionType || 'modal',
                actionConfig: nextNode.data.config || {},
              });
            } else if (nextNode.type === 'conditionNode' || nextNode.type === 'advancedConditionNode') {
              conditions.push({
                conditionType: nextNode.data.config?.conditionType || 'if',
                conditionConfig: nextNode.data.config || {},
              });
            }
            queue.push(nextNode.id);
          }
        }
      }
    }

    // 3. Store graph metadata in triggerConfig for persistence
    const triggerConfig = {
      ...(triggerNode.data.config || {}),
      triggerType: triggerNode.data.config?.triggerType || 'pageView',
      __graph: {
        nodes,
        edges
      }
    };

    return {
      name: automation.name || 'Untitled Workflow',
      description: automation.description || '',
      triggerType: triggerConfig.triggerType,
      triggerConfig,
      actions,
      conditions
    };
  },

  saveAutomation: async (websiteId, automationId) => {
    try {
      const workflow = get().getLinearizedWorkflow();
      const url = automationId
        ? `/websites/${websiteId}/automations/${automationId}`
        : `/websites/${websiteId}/automations`;

      const response = await api({
        method: automationId ? 'put' : 'post',
        url: url,
        data: workflow,
      });

      if (response.status === 200 || response.status === 201) {
        set({ isDirty: false });
      } else {
        throw new Error('Failed to save automation');
      }
    } catch (error) {
      console.error('Failed to save automation:', error);
      throw error;
    }
  },

  loadAutomation: async (websiteId, id) => {
    try {
      const response = await api.get(`/websites/${websiteId}/automations/${id}`);
      const data = response.data;

      // Try to restore graph from __graph metadata
      const graph = data.triggerConfig?.__graph;
      if (graph) {
        set({
          nodes: graph.nodes,
          edges: graph.edges,
          automation: data,
          isDirty: false
        });
      } else {
        // Fallback for legacy linear automations
        // (Implementation omitted for brevity, but would generate nodes from actions array)
        set({ automation: data, isDirty: false });
      }
    } catch (error) {
      console.error('Failed to load automation:', error);
      throw error;
    }
  },

  publishAutomation: async (websiteId, id) => {
    try {
      const response = await api.post(`/websites/${websiteId}/automations/${id}/toggle`);
      if (response.status === 200) {
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
    // Current implementation placeholder as per original
    return { success: true };
  },

  loadTemplate: (templateId) => {
    const templates: Record<string, any> = {
      'welcome-modal': {
        name: 'Welcome Modal',
        nodes: [
          { id: 't1', type: 'triggerNode', data: { label: 'Home Page Visit', config: { triggerType: 'pageView', page: '/' } }, position: { x: 250, y: 100 } },
          { id: 'a1', type: 'actionNode', data: { label: 'Welcome Modal', config: { actionType: 'modal', title: 'Welcome! 👋', content: "Thanks for visiting our site. We're glad you're here!", primaryButton: 'Get Started' } }, position: { x: 250, y: 300 } }
        ],
        edges: [{ id: 'e1-2', source: 't1', target: 'a1', animated: true }]
      },
      'exit-intent-promotion': {
        name: 'Exit Intent Discount',
        nodes: [
          { id: 't1', type: 'triggerNode', data: { label: 'Exit Intent', config: { triggerType: 'exitIntent' } }, position: { x: 250, y: 100 } },
          { id: 'a1', type: 'actionNode', data: { label: 'Offer Banner', config: { actionType: 'banner', content: 'Wait! Use code SAVE20 for 20% off your first order! 🏷️', backgroundColor: '#8b5cf6', position: 'top' } }, position: { x: 250, y: 300 } }
        ],
        edges: [{ id: 'e1-2', source: 't1', target: 'a1', animated: true }]
      },
      'scroll-depth-banner': {
        name: 'Scroll Depth Reward',
        nodes: [
          { id: 't1', type: 'triggerNode', data: { label: 'Page Scroll (70%)', config: { triggerType: 'scroll', scrollDepth: 70 } }, position: { x: 250, y: 100 } },
          { id: 'a1', type: 'actionNode', data: { label: 'Reward Notification', config: { actionType: 'notification', title: 'Reading Streak! 🔥', message: "You're a top reader! Check out our related articles.", type: 'success' } }, position: { x: 250, y: 300 } }
        ],
        edges: [{ id: 'e1-2', source: 't1', target: 'a1', animated: true }]
      },
      'time-on-page-notification': {
        name: 'Support Help Trigger',
        nodes: [
          { id: 't1', type: 'triggerNode', data: { label: 'Idle for 60s', config: { triggerType: 'timeOnPage', duration: 60, unit: 'seconds' } }, position: { x: 250, y: 100 } },
          { id: 'a1', type: 'actionNode', data: { label: 'Help Message', config: { actionType: 'notification', title: 'Need help? 🙋', message: "We noticed you've been here a while. Any questions?", type: 'info' } }, position: { x: 250, y: 300 } }
        ],
        edges: [{ id: 'e1-2', source: 't1', target: 'a1', animated: true }]
      },
      'pricing-web-hook': {
        name: 'CRM Pricing Lead',
        nodes: [
          { id: 't1', type: 'triggerNode', data: { label: 'Pricing View', config: { triggerType: 'pageView', page: '/pricing' } }, position: { x: 250, y: 100 } },
          { id: 'a1', type: 'actionNode', data: { label: 'Sync to CRM', config: { actionType: 'webhook', method: 'POST', url: 'https://hooks.zapier.com/example', body: { event: 'high_intent_pricing_visit' } } }, position: { x: 250, y: 300 } }
        ],
        edges: [{ id: 'e1-2', source: 't1', target: 'a1', animated: true }]
      },
      'abandoned-cart-notification': {
        name: 'Abandoned Cart Alert',
        nodes: [
          { id: 't1', type: 'triggerNode', data: { label: 'Cart Idle (5m)', config: { triggerType: 'timeOnPage', duration: 5, unit: 'minutes', page: '/checkout' } }, position: { x: 250, y: 100 } },
          { id: 'a1', type: 'actionNode', data: { label: 'Recovery Notification', config: { actionType: 'notification', title: 'Don\'t miss out!', message: "Completing your order? Your items are still saved.", type: 'warning' } }, position: { x: 250, y: 300 } }
        ],
        edges: [{ id: 'e1-2', source: 't1', target: 'a1', animated: true }]
      }
    };

    const template = templates[templateId];
    if (template) {
      set({
        nodes: template.nodes,
        edges: template.edges,
        automation: {
          name: template.name,
          description: `Created from ${template.name} template`,
          enabled: false
        },
        isDirty: true
      });
    }
  },

  resetWorkflow: () => {
    set({
      nodes: [
        {
          id: 'trigger_1',
          type: 'triggerNode',
          data: { label: 'New Trigger', config: { triggerType: 'pageView' } },
          position: { x: 250, y: 150 },
        }
      ],
      edges: [],
      automation: {
        name: 'New Workflow',
        description: '',
        enabled: false
      },
      selectedNodeId: null,
      isDirty: false,
    });
  },
}));
