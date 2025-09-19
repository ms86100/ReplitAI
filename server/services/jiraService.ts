import { z } from 'zod';

// Jira API interfaces
export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description?: string;
    status: {
      name: string;
      id: string;
    };
    priority?: {
      name: string;
      id: string;
    };
    assignee?: {
      emailAddress: string;
      displayName: string;
    };
    updated: string;
    created: string;
  };
}

export interface JiraCreateIssuePayload {
  fields: {
    project: {
      key: string;
    };
    summary: string;
    description?: string;
    issuetype: {
      name: string;
    };
    priority?: {
      name: string;
    };
    assignee?: {
      emailAddress: string;
    };
  };
}

export interface JiraUpdateIssuePayload {
  fields: {
    summary?: string;
    description?: string;
    priority?: {
      name: string;
    };
    assignee?: {
      emailAddress: string;
    };
  };
}

export interface JiraTransitionPayload {
  transition: {
    id: string;
  };
}

// Field mapping configuration
export interface JiraFieldMapping {
  statusMapping: Record<string, string>; // local status -> jira status
  priorityMapping: Record<string, string>; // local priority -> jira priority
  issueType: string; // default issue type for synced tasks
}

export class JiraService {
  private baseUrl: string;
  private email: string;
  private apiToken: string;
  private projectKey: string;

  constructor(baseUrl: string, email: string, apiToken: string, projectKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.email = email;
    this.apiToken = apiToken;
    this.projectKey = projectKey;
  }

  private getAuthHeaders(): Record<string, string> {
    const auth = Buffer.from(`${this.email}:${this.apiToken}`).toString('base64');
    return {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}/rest/api/2${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jira API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  // Test connection to Jira
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.makeRequest('/myself');
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Get project information
  async getProject(): Promise<any> {
    return this.makeRequest(`/project/${this.projectKey}`);
  }

  // Get issue types for the project
  async getIssueTypes(): Promise<any[]> {
    const project = await this.getProject();
    return project.issueTypes || [];
  }

  // Get available transitions for an issue
  async getTransitions(issueKey: string): Promise<any[]> {
    const response = await this.makeRequest(`/issue/${issueKey}/transitions`);
    return response.transitions || [];
  }

  // Create a new issue in Jira
  async createIssue(payload: JiraCreateIssuePayload): Promise<JiraIssue> {
    return this.makeRequest('/issue', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // Update an existing issue
  async updateIssue(issueKey: string, payload: JiraUpdateIssuePayload): Promise<void> {
    await this.makeRequest(`/issue/${issueKey}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  // Transition issue status
  async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
    await this.makeRequest(`/issue/${issueKey}/transitions`, {
      method: 'POST',
      body: JSON.stringify({
        transition: { id: transitionId }
      })
    });
  }

  // Get issue by key
  async getIssue(issueKey: string): Promise<JiraIssue> {
    return this.makeRequest(`/issue/${issueKey}`);
  }

  // Search for issues
  async searchIssues(jql: string, maxResults: number = 50): Promise<{ issues: JiraIssue[] }> {
    const params = new URLSearchParams({
      jql,
      maxResults: maxResults.toString()
    });
    
    return this.makeRequest(`/search?${params}`);
  }

  // Add comment to issue
  async addComment(issueKey: string, comment: string): Promise<void> {
    await this.makeRequest(`/issue/${issueKey}/comment`, {
      method: 'POST',
      body: JSON.stringify({
        body: comment
      })
    });
  }

  // Helper method to map local task status to Jira transition
  async mapStatusToTransition(issueKey: string, localStatus: string, mapping: JiraFieldMapping): Promise<string | null> {
    try {
      const transitions = await this.getTransitions(issueKey);
      const jiraStatusName = mapping.statusMapping[localStatus];
      
      if (!jiraStatusName) {
        return null;
      }

      const transition = transitions.find(t => 
        t.to?.name?.toLowerCase() === jiraStatusName.toLowerCase()
      );

      return transition?.id || null;
    } catch (error) {
      console.error('Error mapping status to transition:', error);
      return null;
    }
  }

  // Convert local task to Jira issue payload
  static taskToJiraPayload(task: any, projectKey: string, mapping: JiraFieldMapping): JiraCreateIssuePayload {
    return {
      fields: {
        project: { key: projectKey },
        summary: task.title,
        description: task.description || '',
        issuetype: { name: mapping.issueType },
        priority: task.priority && mapping.priorityMapping[task.priority] 
          ? { name: mapping.priorityMapping[task.priority] }
          : undefined
      }
    };
  }

  // Convert Jira issue to local task format
  static jiraToTaskFormat(issue: JiraIssue): Partial<any> {
    return {
      title: issue.fields.summary,
      description: issue.fields.description || '',
      jira_issue_key: issue.key,
      jira_issue_id: issue.id,
      // Additional mappings would go here based on field mapping configuration
    };
  }
}

// Default field mapping
export const defaultJiraFieldMapping: JiraFieldMapping = {
  statusMapping: {
    'todo': 'To Do',
    'in_progress': 'In Progress',
    'completed': 'Done',
    'blocked': 'Blocked',
    'on_hold': 'On Hold'
  },
  priorityMapping: {
    'low': 'Low',
    'medium': 'Medium',
    'high': 'High',
    'urgent': 'Highest'
  },
  issueType: 'Task'
};