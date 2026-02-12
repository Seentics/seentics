
import { create } from 'zustand';

export type Message = {
    role: 'user' | 'assistant';
    content: string;
};

type AssistantState = {
    isOpen: boolean;
    isLoading: boolean;
    messages: Message[];
    toggleOpen: () => void;
    startLoading: () => void;
    stopLoading: () => void;
    addMessage: (message: Message) => void;
    resetMessages: () => void;
};

export const useAssistantStore = create<AssistantState>((set) => ({
    isOpen: false,
    isLoading: false,
    messages: [],
    toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
    startLoading: () => set({ isLoading: true }),
    stopLoading: () => set({ isLoading: false }),
    addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
    resetMessages: () => set({ messages: [] }),
}));
