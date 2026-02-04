// Stub file for workflow API
// This is a placeholder to prevent build errors
// The preview functionality is not part of the current landing page updates

export interface Workflow {
    id: string;
    name: string;
    status: 'Active' | 'Inactive';
    // Add other workflow properties as needed
}

export async function getWorkflow(id: string): Promise<Workflow | null> {
    // Placeholder implementation
    console.warn('getWorkflow is not implemented');
    return null;
}

export async function getWorkflows(siteId: string): Promise<Workflow[]> {
    // Placeholder implementation
    console.warn('getWorkflows is not implemented');
    return [];
}
