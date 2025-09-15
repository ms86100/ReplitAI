// Test script to verify all local Node.js backend endpoints
const axios = require('axios');

const API_BASE = 'http://localhost:3001';

// Test data
const testProjectId = 'b5f1efb3-a401-4223-b9b0-406fe4dc6dde'; // Replace with your actual project ID
const testToken = 'your-jwt-token-here'; // Replace with actual JWT token

const headers = {
  'Authorization': `Bearer ${testToken}`,
  'Content-Type': 'application/json'
};

const tests = [
  {
    name: 'Health Check',
    method: 'GET',
    url: `${API_BASE}/health`,
    headers: {}
  },
  {
    name: 'Get Project Workspace',
    method: 'GET',
    url: `${API_BASE}/workspace-service/projects/${testProjectId}/workspace`,
    headers
  },
  {
    name: 'Get Risks',
    method: 'GET',
    url: `${API_BASE}/workspace-service/projects/${testProjectId}/risks`,
    headers
  },
  {
    name: 'Create Risk',
    method: 'POST',
    url: `${API_BASE}/workspace-service/projects/${testProjectId}/risks`,
    headers,
    data: {
      risk_code: 'TEST-001',
      title: 'Test Risk',
      description: 'This is a test risk',
      category: 'Technical',
      cause: 'Testing',
      consequence: 'Test failure',
      likelihood: 3,
      impact: 2,
      owner: 'Test Owner',
      response_strategy: 'Monitor',
      mitigation_plan: 'Run more tests',
      contingency_plan: 'Fix bugs',
      status: 'open',
      notes: 'Test notes'
    }
  },
  {
    name: 'Get Discussions',
    method: 'GET',
    url: `${API_BASE}/workspace-service/projects/${testProjectId}/discussions`,
    headers
  },
  {
    name: 'Create Discussion',
    method: 'POST',
    url: `${API_BASE}/workspace-service/projects/${testProjectId}/discussions`,
    headers,
    data: {
      meeting_title: 'Test Meeting',
      meeting_date: '2024-01-15',
      attendees: ['John Doe', 'Jane Smith'],
      summary_notes: 'This is a test discussion'
    }
  },
  {
    name: 'Get Capacity Data',
    method: 'GET',
    url: `${API_BASE}/capacity-service/projects/${testProjectId}/capacity`,
    headers
  },
  {
    name: 'Create Capacity Iteration',
    method: 'POST',
    url: `${API_BASE}/capacity-service/projects/${testProjectId}/capacity`,
    headers,
    data: {
      type: 'iteration',
      iterationName: 'Test Sprint 1',
      startDate: '2024-01-15',
      endDate: '2024-01-29',
      workingDays: 10,
      committedStoryPoints: 50
    }
  }
];

async function runTests() {
  console.log('🚀 Starting API Tests...\n');
  
  for (const test of tests) {
    try {
      console.log(`🔍 Testing: ${test.name}`);
      console.log(`   ${test.method} ${test.url}`);
      
      const config = {
        method: test.method.toLowerCase(),
        url: test.url,
        headers: test.headers,
        ...(test.data && { data: test.data })
      };
      
      const response = await axios(config);
      console.log(`✅ ${test.name}: SUCCESS (${response.status})`);
      
      if (response.data) {
        console.log(`   Response: ${JSON.stringify(response.data, null, 2).substring(0, 200)}...`);
      }
      
    } catch (error) {
      console.log(`❌ ${test.name}: FAILED`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
      } else {
        console.log(`   Error: ${error.message}`);
      }
    }
    console.log('');
  }
  
  console.log('🏁 Tests completed');
}

if (require.main === module) {
  console.log('⚠️  Please update testProjectId and testToken variables before running tests\n');
  runTests().catch(console.error);
}

module.exports = { runTests, tests };