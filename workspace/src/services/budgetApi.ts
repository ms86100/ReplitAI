import { supabase } from '@/integrations/supabase/client';

// Environment-aware API service for budget management
class BudgetApiService {
  private getBaseUrl(): string {
    const viteApiUrl = (import.meta as any)?.env?.VITE_API_URL as string | undefined;
    const isLocalByEnv = !!viteApiUrl && viteApiUrl.includes('localhost');
    const isLocalByHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isLocal = isLocalByEnv || isLocalByHost;
    return isLocal ? 'http://localhost:3001' : 'https://knivoexfpvqohsvpsziq.supabase.co/functions/v1';
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuaXZvZXhmcHZxb2hzdnBzemlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMjgyOTgsImV4cCI6MjA3MTgwNDI5OH0.TfV3FF9FNYXVv_f5TTgne4-CrDWmN1xOed2ZIjzn96Q'
    };

    // Check if supabase client is available
    if (!supabase) {
      try {
        const storedAuth = localStorage.getItem('auth_session') || localStorage.getItem('app_session');
        if (storedAuth) {
          const session = JSON.parse(storedAuth);
          const token = session?.access_token || session?.token || session?.accessToken;
          if (token) headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (e) {
        console.warn('Failed to parse local session for token');
      }
      return headers;
    }
    
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const baseUrl = this.getBaseUrl();
    const headers = await this.getAuthHeaders();
    const fullUrl = `${baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(fullUrl, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Budget API Error:', {
        error: error.message,
        url: fullUrl
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