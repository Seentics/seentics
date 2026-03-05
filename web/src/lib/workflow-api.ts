// Stub file for workflow API
// This is a placeholder to prevent build errors
// The preview functionality is not part of the current landing page updates

export interface Workflow {
    id: string;
    name: string;
    status: 'Active' | 'Inactive';
    // Add other workflow properties as needed
}

export async function getWorkflow(_id: string): Promise<Workflow | null> {
    return null;
}

export async function getWorkflows(_siteId: string): Promise<Workflow[]> {
    return [];
}
