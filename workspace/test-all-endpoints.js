#!/usr/bin/env node

const axios = require('axios');
const colors = require('colors');

const BASE_URL = 'http://localhost:3001';
let authToken = null;
let testProjectId = null;
let testMilestoneId = null;
let testTaskId = null;

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString().substr(11, 8);
  switch (type) {
    case 'success':
      console.log(`[${timestamp}] ✅ ${message}`.green);
      break;
    case 'error':
      console.log(`[${timestamp}] ❌ ${message}`.red);
      break;
    case 'info':
      console.log(`[${timestamp}] ℹ️  ${message}`.blue);
      break;
    case 'header':
      console.log(`\n${'='.repeat(50)}`.yellow);
      console.log(`${message}`.yellow.bold);
      console.log(`${'='.repeat(50)}`.yellow);
      break;
  }
}

function recordTest(name, passed, error = null) {
  results.tests.push({ name, passed, error });
  if (passed) {
    results.passed++;
    log(`${name} - PASSED`, 'success');
  } else {
    results.failed++;
    log(`${name} - FAILED: ${error}`, 'error');
  }
}

async function makeRequest(method, endpoint, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        ...headers
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message,
      status: error.response?.status 
    };
  }
}

async function testAuth() {
  log('Testing Authentication Endpoints', 'header');
  
  // Test registration
  const registerData = {
    email: 'test@example.com',
    password: 'testpassword123',
    fullName: 'Test User'
  };
  
  const registerResult = await makeRequest('POST', '/auth-service/register', registerData);
  if (registerResult.success && registerResult.data.success) {
    authToken = registerResult.data.data.session.access_token;
    recordTest('Auth - Register', true);
  } else {
    // Try to login instead (user might already exist)
    const loginResult = await makeRequest('POST', '/auth-service/login', {
      email: 'test@example.com',
      password: 'testpassword123'
    });
    
    if (loginResult.success && loginResult.data.success) {
      authToken = loginResult.data.data.session.access_token;
      recordTest('Auth - Login (existing user)', true);
    } else {
      recordTest('Auth - Register/Login', false, loginResult.error);
      return false;
    }
  }
  
  // Test get current user
  const userResult = await makeRequest('GET', '/auth-service/user');
  recordTest('Auth - Get Current User', userResult.success && userResult.data.success);
  
  // Test session
  const sessionResult = await makeRequest('GET', '/auth-service/session');
  recordTest('Auth - Get Session', sessionResult.success && sessionResult.data.success);
  
  return true;
}

async function testDepartments() {
  log('Testing Department Endpoints', 'header');
  
  // Get departments
  const getDeptResult = await makeRequest('GET', '/department-service/departments');
  recordTest('Departments - Get All', getDeptResult.success && getDeptResult.data.success);
}

async function testProjects() {
  log('Testing Project Endpoints', 'header');
  
  // Create project
  const projectData = {
    name: 'Test Project - ' + Date.now(),
    description: 'A test project for endpoint validation',
    priority: 'high',
    status: 'planning'
  };
  
  const createResult = await makeRequest('POST', '/projects-service/projects', projectData);
  if (createResult.success && createResult.data.success) {
    testProjectId = createResult.data.data.id;
    recordTest('Projects - Create', true);
  } else {
    recordTest('Projects - Create', false, createResult.error);
    return false;
  }
  
  // Get all projects
  const getProjectsResult = await makeRequest('GET', '/projects-service/projects');
  recordTest('Projects - Get All', getProjectsResult.success && getProjectsResult.data.success);
  
  // Get single project
  const getProjectResult = await makeRequest('GET', `/projects-service/projects/${testProjectId}`);
  recordTest('Projects - Get Single', getProjectResult.success && getProjectResult.data.success);
  
  // Update project
  const updateResult = await makeRequest('PUT', `/projects-service/projects/${testProjectId}`, {
    description: 'Updated test project description'
  });
  recordTest('Projects - Update', updateResult.success && updateResult.data.success);
  
  return true;
}

async function testWizard() {
  log('Testing Wizard Endpoints', 'header');
  
  // Start wizard
  const startResult = await makeRequest('POST', '/wizard-service/projects/wizard/start', {});
  recordTest('Wizard - Start Session', startResult.success && startResult.data.success);
  
  // Create project with wizard
  const wizardData = {
    projectName: 'Wizard Test Project - ' + Date.now(),
    objective: 'Test wizard functionality',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    milestones: [{
      name: 'Test Milestone',
      dueDate: '2024-06-30',
      tasks: [{
        title: 'Test Task',
        description: 'A test task',
        priority: 'medium'
      }]
    }]
  };
  
  const wizardResult = await makeRequest('POST', '/wizard-service/projects/create', wizardData);
  recordTest('Wizard - Create Project with Structure', wizardResult.success && wizardResult.data.success);
}

async function testMilestones() {
  if (!testProjectId) return;
  
  log('Testing Milestone/Roadmap Endpoints', 'header');
  
  // Get roadmap
  const getRoadmapResult = await makeRequest('GET', `/roadmap-service/projects/${testProjectId}/roadmap`);
  recordTest('Roadmap - Get', getRoadmapResult.success && getRoadmapResult.data.success);
  
  // Create milestone
  const milestoneData = {
    name: 'Test Milestone - ' + Date.now(),
    description: 'A test milestone',
    dueDate: '2024-12-31',
    status: 'planning'
  };
  
  const createMilestoneResult = await makeRequest('POST', `/roadmap-service/projects/${testProjectId}/roadmap`, milestoneData);
  if (createMilestoneResult.success && createMilestoneResult.data.success) {
    testMilestoneId = createMilestoneResult.data.data.milestone.id;
    recordTest('Roadmap - Create Milestone', true);
  } else {
    recordTest('Roadmap - Create Milestone', false, createMilestoneResult.error);
  }
  
  // Update milestone
  if (testMilestoneId) {
    const updateMilestoneResult = await makeRequest('PUT', `/roadmap-service/projects/${testProjectId}/roadmap/${testMilestoneId}`, {
      description: 'Updated milestone description'
    });
    recordTest('Roadmap - Update Milestone', updateMilestoneResult.success && updateMilestoneResult.data.success);
  }
}

async function testTasks() {
  if (!testProjectId) return;
  
  log('Testing Task/Workspace Endpoints', 'header');
  
  // Get workspace
  const getWorkspaceResult = await makeRequest('GET', `/workspace-service/projects/${testProjectId}/workspace`);
  recordTest('Workspace - Get Project Workspace', getWorkspaceResult.success && getWorkspaceResult.data.success);
  
  // Get tasks
  const getTasksResult = await makeRequest('GET', `/workspace-service/projects/${testProjectId}/tasks`);
  recordTest('Workspace - Get Tasks', getTasksResult.success && getTasksResult.data.success);
  
  // Get milestones
  const getMilestonesResult = await makeRequest('GET', `/workspace-service/projects/${testProjectId}/milestones`);
  recordTest('Workspace - Get Milestones', getMilestonesResult.success && getMilestonesResult.data.success);
  
  // Create task
  const taskData = {
    title: 'Test Task - ' + Date.now(),
    description: 'A test task',
    priority: 'medium',
    status: 'todo',
    milestoneId: testMilestoneId
  };
  
  const createTaskResult = await makeRequest('POST', `/workspace-service/projects/${testProjectId}/tasks`, taskData);
  if (createTaskResult.success && createTaskResult.data.success) {
    testTaskId = createTaskResult.data.data.task.id;
    recordTest('Workspace - Create Task', true);
  } else {
    recordTest('Workspace - Create Task', false, createTaskResult.error);
  }
  
  // Update task
  if (testTaskId) {
    const updateTaskResult = await makeRequest('PUT', `/workspace-service/tasks/${testTaskId}`, {
      status: 'in_progress'
    });
    recordTest('Workspace - Update Task', updateTaskResult.success && updateTaskResult.data.success);
    
    // Get task status history
    const historyResult = await makeRequest('GET', `/workspace-service/tasks/${testTaskId}/status-history`);
    recordTest('Workspace - Get Task Status History', historyResult.success && historyResult.data.success);
  }
}

async function testStakeholders() {
  if (!testProjectId) return;
  
  log('Testing Stakeholder Endpoints', 'header');
  
  // Get stakeholders
  const getStakeholdersResult = await makeRequest('GET', `/stakeholder-service/projects/${testProjectId}/stakeholders`);
  recordTest('Stakeholders - Get', getStakeholdersResult.success && getStakeholdersResult.data.success);
  
  // Create stakeholder
  const stakeholderData = {
    name: 'Test Stakeholder',
    email: 'stakeholder@test.com',
    department: 'IT',
    raci: 'Informed',
    influence_level: 'High'
  };
  
  const createStakeholderResult = await makeRequest('POST', `/stakeholder-service/projects/${testProjectId}/stakeholders`, stakeholderData);
  recordTest('Stakeholders - Create', createStakeholderResult.success && createStakeholderResult.data.success);
}

async function testBacklog() {
  if (!testProjectId) return;
  
  log('Testing Backlog Endpoints', 'header');
  
  // Get backlog
  const getBacklogResult = await makeRequest('GET', `/backlog-service/projects/${testProjectId}/backlog`);
  recordTest('Backlog - Get', getBacklogResult.success && getBacklogResult.data.success);
  
  // Create backlog item
  const backlogData = {
    title: 'Test Backlog Item',
    description: 'A test backlog item',
    priority: 'medium'
  };
  
  const createBacklogResult = await makeRequest('POST', `/backlog-service/projects/${testProjectId}/backlog`, backlogData);
  recordTest('Backlog - Create Item', createBacklogResult.success && createBacklogResult.data.success);
}

async function testCapacity() {
  if (!testProjectId) return;
  
  log('Testing Capacity Endpoints', 'header');
  
  // Get capacity
  const getCapacityResult = await makeRequest('GET', `/capacity-service/projects/${testProjectId}/capacity`);
  recordTest('Capacity - Get', getCapacityResult.success && getCapacityResult.data.success);
  
  // Create iteration
  const iterationData = {
    type: 'iteration',
    iterationName: 'Test Sprint 1',
    startDate: '2024-01-01',
    endDate: '2024-01-14',
    workingDays: 10,
    committedStoryPoints: 50
  };
  
  const createIterationResult = await makeRequest('POST', `/capacity-service/projects/${testProjectId}/capacity`, iterationData);
  recordTest('Capacity - Create Iteration', createIterationResult.success && createIterationResult.data.success);
}

async function testRetrospectives() {
  if (!testProjectId) return;
  
  log('Testing Retrospective Endpoints', 'header');
  
  // Get retrospectives
  const getRetroResult = await makeRequest('GET', `/retro-service/projects/${testProjectId}/retrospectives`);
  recordTest('Retrospectives - Get', getRetroResult.success && getRetroResult.data.success);
  
  // Create retrospective
  const retroData = {
    framework: 'Classic',
    iterationId: testProjectId // Using project ID as iteration ID for test
  };
  
  const createRetroResult = await makeRequest('POST', `/retro-service/projects/${testProjectId}/retrospectives`, retroData);
  recordTest('Retrospectives - Create', createRetroResult.success && createRetroResult.data.success);
}

async function testAccessControl() {
  if (!testProjectId) return;
  
  log('Testing Access Control Endpoints', 'header');
  
  // Get project access
  const getAccessResult = await makeRequest('GET', `/access-service/projects/${testProjectId}/access`);
  recordTest('Access Control - Get Project Access', getAccessResult.success && getAccessResult.data.success);
  
  // Get user permissions
  const getPermissionsResult = await makeRequest('GET', '/access-service/permissions');
  recordTest('Access Control - Get User Permissions', getPermissionsResult.success && getPermissionsResult.data.success);
}

async function testAudit() {
  if (!testProjectId) return;
  
  log('Testing Audit Endpoints', 'header');
  
  // Get project history
  const getHistoryResult = await makeRequest('GET', `/audit-service/projects/${testProjectId}/history`);
  recordTest('Audit - Get Project History', getHistoryResult.success && getHistoryResult.data.success);
  
  // Create audit log entry
  const auditData = {
    projectId: testProjectId,
    module: 'tasks_milestones',
    action: 'test',
    description: 'Test audit log entry'
  };
  
  const createAuditResult = await makeRequest('POST', '/audit-service/audit/log', auditData);
  recordTest('Audit - Create Log Entry', createAuditResult.success && createAuditResult.data.success);
}

async function runAllTests() {
  log('Starting Comprehensive Backend API Testing', 'header');
  log(`Testing against: ${BASE_URL}`, 'info');
  
  try {
    // Authentication must pass for other tests to work
    const authSuccess = await testAuth();
    if (!authSuccess) {
      log('Authentication failed - stopping tests', 'error');
      return;
    }
    
    // Run all other tests
    await testDepartments();
    await testProjects();
    await testWizard();
    await testMilestones();
    await testTasks();
    await testStakeholders();
    await testBacklog();
    await testCapacity();
    await testRetrospectives();
    await testAccessControl();
    await testAudit();
    
  } catch (error) {
    log(`Test execution error: ${error.message}`, 'error');
  }
  
  // Print final results
  log('Test Results Summary', 'header');
  log(`Total Tests: ${results.passed + results.failed}`, 'info');
  log(`Passed: ${results.passed}`, 'success');
  log(`Failed: ${results.failed}`, 'error');
  
  if (results.failed > 0) {
    log('\nFailed Tests:', 'error');
    results.tests.filter(t => !t.passed).forEach(test => {
      log(`- ${test.name}: ${test.error}`, 'error');
    });
  }
  
  const successRate = Math.round((results.passed / (results.passed + results.failed)) * 100);
  log(`\nSuccess Rate: ${successRate}%`, successRate >= 80 ? 'success' : 'error');
}

// Run tests if called directly
if (require.main === module) {
  runAllTests()
    .then(() => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('Test runner error:', error);
      process.exit(1);
    });
}

module.exports = { runAllTests, results };