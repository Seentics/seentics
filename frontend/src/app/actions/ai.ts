'use server';

import api from '@/lib/api';

/**
 * Handles landing page assistant chat messages
 */
export async function handleLandingPageAssistant(data: {
    message: string;
    conversationHistory: any[];
}) {
    try {
        const response = await api.post('/assistant/landing-page', data);
        return response.data;
    } catch (error: any) {
        console.error('Landing page assistant error:', error);
        return {
            error: error.message || 'Failed to get a response from the assistant',
        };
    }
}

/**
 * Handles feedback submission from the landing page chatbot
 */
export async function handleFeedbackSubmit(feedback: string) {
    try {
        const response = await api.post('/assistant/feedback', { feedback });
        return response.data;
    } catch (error: any) {
        console.error('Feedback submission error:', error);
        throw new Error(error.message || 'Failed to submit feedback');
    }
}
