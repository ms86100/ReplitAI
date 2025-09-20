import { apiRequest } from '@/lib/queryClient';

// Environment-aware API service for budget management
class BudgetApiService {

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    try {
      const method = options.method || 'GET';
      const body = options.body;
      
      const response = await apiRequest(method as 'GET' | 'POST' | 'PUT' | 'DELETE', endpoint, body ? JSON.parse(body as string) : undefined);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data && !data.success) {
        throw new Error(data.error || 'API request failed');
      }
      
      return data;
    } catch (error) {
      console.error('❌ Budget API Error:', {
        error: (error as Error).message || error,
        endpoint
      });
      throw error;
    }
  }

  // Budget operations
  async getProjectBudget(projectId: string) {
    return this.makeRequest(`/api/budget-service/projects/${projectId}/budget`);
  }

  async createOrUpdateBudget(projectId: string, budgetData: any) {
    return this.makeRequest(`/api/budget-service/projects/${projectId}/budget`, {
      method: 'POST',
      body: JSON.stringify(budgetData),
    });
  }

  // Budget categories
  async createBudgetCategory(projectId: string, categoryData: any) {
    return this.makeRequest(`/api/budget-service/projects/${projectId}/categories`, {
      method: 'POST',
      body: JSON.stringify(categoryData),
    });
  }

  // Update budget category
  async updateBudgetCategory(projectId: string, categoryId: string, categoryData: any) {
    return this.makeRequest(`/api/budget-service/projects/${projectId}/categories/${categoryId}`, {
      method: 'PUT',
      body: JSON.stringify(categoryData),
    });
  }

  // Delete budget category
  async deleteBudgetCategory(projectId: string, categoryId: string) {
    return this.makeRequest(`/api/budget-service/projects/${projectId}/categories/${categoryId}`, {
      method: 'DELETE',
    });
  }

  // Spending entries
  async createSpendingEntry(projectId: string, spendingData: any) {
    return this.makeRequest(`/api/budget-service/projects/${projectId}/spending`, {
      method: 'POST',
      body: JSON.stringify(spendingData),
    });
  }

  // Update spending entry
  async updateSpendingEntry(projectId: string, spendingId: string, spendingData: any) {
    return this.makeRequest(`/api/budget-service/projects/${projectId}/spending/${spendingId}`, {
      method: 'PUT',
      body: JSON.stringify(spendingData),
    });
  }

  // Delete spending entry
  async deleteSpendingEntry(projectId: string, spendingId: string) {
    return this.makeRequest(`/api/budget-service/projects/${projectId}/spending/${spendingId}`, {
      method: 'DELETE',
    });
  }

  // Budget types
  async getBudgetTypes() {
    return this.makeRequest('/api/budget-service/budget-types');
  }
}

export const budgetApi = new BudgetApiService();