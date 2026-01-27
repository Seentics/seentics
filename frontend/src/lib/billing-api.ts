import api from './api';

export interface CheckoutResponse {
    success: boolean;
    data: {
        checkoutUrl: string;
    };
}

export async function createCheckout(plan: string): Promise<string> {
    try {
        const response = await api.post<CheckoutResponse>('/user/billing/checkout', { plan });
        return response.data.data.checkoutUrl;
    } catch (error) {
        console.error('Error creating checkout:', error);
        throw error;
    }
}

export async function selectFreePlan(): Promise<void> {
    try {
        await api.post('/user/billing/select-free');
    } catch (error) {
        console.error('Error selecting free plan:', error);
        throw error;
    }
}

export async function getBillingUsage(): Promise<any> {
    try {
        const response = await api.get('/user/billing/usage');
        return response.data.data;
    } catch (error) {
        console.error('Error fetching billing usage:', error);
        throw error;
    }
}

export async function createPortalSession(): Promise<string> {
    try {
        const response = await api.post<{ data: { url: string } }>('/user/billing/portal');
        return response.data.data.url;
    } catch (error) {
        console.error('Error creating portal session:', error);
        throw error;
    }
}
