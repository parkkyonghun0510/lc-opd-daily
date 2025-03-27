/**
 * Functions for interacting with branch data from the API
 */
/**
 * Fetch all branches from the API
 */
export async function getBranches() {
    try {
        const response = await fetch('/api/branches');
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch branches');
        }
        return await response.json();
    }
    catch (error) {
        console.error('Error fetching branches:', error);
        throw error;
    }
}
/**
 * Fetch a specific branch by ID
 */
export async function getBranchById(id) {
    try {
        const response = await fetch(`/api/branches/${id}`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `Failed to fetch branch with ID ${id}`);
        }
        return await response.json();
    }
    catch (error) {
        console.error(`Error fetching branch ${id}:`, error);
        throw error;
    }
}
/**
 * Create a new branch
 */
export async function createBranch(branchData) {
    try {
        const response = await fetch('/api/branches', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(branchData),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create branch');
        }
        return await response.json();
    }
    catch (error) {
        console.error('Error creating branch:', error);
        throw error;
    }
}
/**
 * Update an existing branch
 */
export async function updateBranch(id, branchData) {
    try {
        const response = await fetch(`/api/branches/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(branchData),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `Failed to update branch with ID ${id}`);
        }
        return await response.json();
    }
    catch (error) {
        console.error(`Error updating branch ${id}:`, error);
        throw error;
    }
}
/**
 * Delete a branch by ID
 */
export async function deleteBranch(id) {
    try {
        const response = await fetch(`/api/branches/${id}`, {
            method: 'DELETE',
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `Failed to delete branch with ID ${id}`);
        }
    }
    catch (error) {
        console.error(`Error deleting branch ${id}:`, error);
        throw error;
    }
}
