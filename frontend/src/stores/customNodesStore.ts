import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CustomFieldDefinition {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'boolean';
  placeholder?: string;
  options?: string[];
  required?: boolean;
}

interface CustomNodeDefinition {
  id: string;
  name: string;
  description: string;
  category: 'trigger' | 'condition' | 'action';
  icon: string;
  color: string;
  fields: CustomFieldDefinition[];
  executionCode?: string;
  createdAt: number;
  updatedAt: number;
}

interface CustomNodesState {
  customNodes: CustomNodeDefinition[];
  addCustomNode: (node: Omit<CustomNodeDefinition, 'createdAt' | 'updatedAt'>) => void;
  updateCustomNode: (id: string, updates: Partial<CustomNodeDefinition>) => void;
  deleteCustomNode: (id: string) => void;
  getCustomNodesByCategory: (category: 'trigger' | 'condition' | 'action') => CustomNodeDefinition[];
  getCustomNodeById: (id: string) => CustomNodeDefinition | undefined;
}

export const useCustomNodesStore = create<CustomNodesState>()(
  persist(
    (set, get) => ({
      customNodes: [],

      addCustomNode: (node) => {
        const now = Date.now();
        const newNode: CustomNodeDefinition = {
          ...node,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          customNodes: [...state.customNodes, newNode],
        }));
      },

      updateCustomNode: (id, updates) => {
        set((state) => ({
          customNodes: state.customNodes.map((node) =>
            node.id === id
              ? { ...node, ...updates, updatedAt: Date.now() }
              : node
          ),
        }));
      },

      deleteCustomNode: (id) => {
        set((state) => ({
          customNodes: state.customNodes.filter((node) => node.id !== id),
        }));
      },

      getCustomNodesByCategory: (category) => {
        return get().customNodes.filter((node) => node.category === category);
      },

      getCustomNodeById: (id) => {
        return get().customNodes.find((node) => node.id === id);
      },
    }),
    {
      name: 'custom-nodes-storage',
      version: 1,
    }
  )
);
