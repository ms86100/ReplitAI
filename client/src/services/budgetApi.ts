import { apiRequest } from '@/lib/queryClient';

// Environment-aware API service for budget management
class BudgetApiService {

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    try {
      const method = options.method || 'GET';
      const body = options.body;
      
      const response = await apiRequest(method as 'GET' | 'POST' | 'PUT' | 'DELETE', endpoint, body ? JSON.parse(body as string) : undefined);
      return response;
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
    return this.makeRequest(`/budget-service/projects/${projectId}/budget`);
  }

  async createOrUpdateBudget(projectId: string, budgetData: any) {
    return this.makeRequest(`/budget-service/projects/${projectId}/budget`, {
      method: 'POST',
      body: JSON.stringify(budgetData),
    });
  }

  // Budget categories
  async createBudgetCategory(projectId: string, categoryData: any) {
    return this.makeRequest(`/budget-service/projects/${projectId}/categories`, {
      method: 'POST',
      body: JSON.stringify(categoryData),
    });
  }

  // Delete budget category
  async deleteBudgetCategory(categoryId: string) {
    return this.makeRequest(`/budget-service/categories/${categoryId}`, {
      method: 'DELETE',
    });
  }

  // Spending entries
  async createSpendingEntry(categoryId: string, spendingData: any) {
    return this.makeRequest(`/budget-service/categories/${categoryId}/spending`, {
      method: 'POST',
      body: JSON.stringify(spendingData),
    });
  }

  // Delete spending entry
  async deleteSpendingEntry(spendingId: string) {
    return this.makeRequest(`/budget-service/spending/${spendingId}`, {
      method: 'DELETE',
    });
  }

  // Budget types
  async getBudgetTypes() {
    return this.makeRequest('/budget-service/budget-types');
  }
}

export const budgetApi = new BudgetApiService();