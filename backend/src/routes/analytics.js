const express = require('express');
const { query } = require('../config/database');
const { verifyToken, verifyProjectAccess } = require('../middleware/auth');
const { createSuccessResponse, createErrorResponse, sendResponse } = require('../utils/responses');

const router = express.Router();

// GET /analytics-service/projects/:id/project-overview
router.get('/projects/:id/project-overview', verifyToken, verifyProjectAccess, async (req, res) => {
  try {
    const projectId = req.projectId;

    // Tasks analytics
    const tasksRes = await query(`
      SELECT 
        COUNT(*) AS total_tasks,
        COUNT(*) FILTER (WHERE status = 'done') AS completed_tasks,
        COUNT(*) FILTER (WHERE status != 'done' AND due_date IS NOT NULL AND due_date < CURRENT_DATE) AS overdue_tasks,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400.0) AS avg_completion_time
      FROM tasks
      WHERE project_id = $1
    `, [projectId]);

    // Milestones completion rate (timeline proxy)
    const milestonesRes = await query(`
      SELECT 
        COUNT(*) AS total_milestones,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed_milestones
      FROM milestones
      WHERE project_id = $1
    `, [projectId]);

    // Risks analytics
    const risksRes = await query(`
      SELECT 
        COUNT(*) AS total_risks,
        COUNT(*) FILTER (WHERE COALESCE(likelihood,0) * COALESCE(impact,0) >= 9) AS high_risks,
        COUNT(*) FILTER (WHERE status IN ('closed','mitigated')) AS mitigated_risks
      FROM risk_register
      WHERE project_id = $1
    `, [projectId]);

    // Stakeholders analytics
    const stakeholdersRes = await query(`
      SELECT 
        COUNT(*) AS total_stakeholders
      FROM stakeholders
      WHERE project_id = $1
    `, [projectId]);

    // Team performance (capacity) - from iterations/members
    const teamPerfRes = await query(`
      SELECT 
        COUNT(DISTINCT tcm.id) AS total_members,
        COUNT(DISTINCT tci.id) AS total_iterations,
        COALESCE(AVG(NULLIF(tcm.availability_percent, 0)), 0) AS avg_availability,
        COALESCE(AVG(NULLIF(tcm.effective_capacity_days, 0)), 0) AS avg_capacity_days
      FROM team_capacity_iterations tci
      LEFT JOIN team_capacity_members tcm ON tcm.iteration_id = tci.id
      WHERE tci.project_id = $1
    `, [projectId]);

    // Budget analytics
    const budgetRes = await query(`
      SELECT 
        COALESCE(SUM(pb.total_budget_allocated), 0) AS total_allocated,
        COALESCE(SUM(pb.total_budget_received), 0) AS total_received
      FROM project_budgets pb
      WHERE pb.project_id = $1
    `, [projectId]);

    const spentRes = await query(`
      SELECT COALESCE(SUM(bs.amount), 0) AS total_spent
      FROM budget_spending bs
      JOIN budget_categories bc ON bc.id = bs.budget_category_id
      JOIN project_budgets pb ON pb.id = bc.project_budget_id
      WHERE pb.project_id = $1
    `, [projectId]);

    const tasks = tasksRes.rows[0] || {};
    const milestones = milestonesRes.rows[0] || {};
    const risks = risksRes.rows[0] || {};
    const stakeholders = stakeholdersRes.rows[0] || {};
    const teamPerf = teamPerfRes.rows[0] || {};
    const budget = budgetRes.rows[0] || {};
    const spent = spentRes.rows[0] || {};

    // Compute health scores (0-100) with simple heuristics
    const budgetAllocated = Number(budget.total_allocated || 0);
    const budgetSpent = Number(spent.total_spent || 0);
    const budgetHealth = budgetAllocated > 0 ? Math.max(0, 100 - Math.min(100, (budgetSpent / budgetAllocated) * 100)) : 0;

    const totalMilestones = Number(milestones.total_milestones || 0);
    const completedMilestones = Number(milestones.completed_milestones || 0);
    const timelineHealth = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

    const totalRisks = Number(risks.total_risks || 0);
    const highRisks = Number(risks.high_risks || 0);
    const riskHealth = totalRisks > 0 ? Math.max(0, Math.round((1 - highRisks / totalRisks) * 100)) : 0;

    const teamHealth = Math.round(Number(teamPerf.avg_availability || 0));

    const overall = Math.round((budgetHealth + timelineHealth + riskHealth + teamHealth) / 4);

    const response = {
      projectHealth: {
        overall,
        budget: budgetHealth,
        timeline: timelineHealth,
        risks: riskHealth,
        team: teamHealth,
      },
      budgetAnalytics: {
        totalAllocated: Number(budgetAllocated),
        totalSpent: Number(budgetSpent),
        remainingBudget: Math.max(0, Number(budgetAllocated) - Number(budgetSpent)),
        spendByCategory: [],
        burnRate: [],
      },
      teamPerformance: {
        totalMembers: Number(teamPerf.total_members || 0),
        activeMembers: Number(teamPerf.total_members || 0),
        avgCapacity: Number(teamPerf.avg_capacity_days || 0),
        avgEfficiency: Math.round(Number(teamPerf.avg_availability || 0)),
        topPerformers: [],
        capacityTrend: [],
      },
      taskAnalytics: {
        totalTasks: Number(tasks.total_tasks || 0),
        completedTasks: Number(tasks.completed_tasks || 0),
        overdueTasks: Number(tasks.overdue_tasks || 0),
        avgCompletionTime: Math.round(Number(tasks.avg_completion_time || 0)),
        tasksByStatus: [],
        productivityTrend: [],
      },
      riskAnalysis: {
        totalRisks: Number(totalRisks),
        highRisks: Number(highRisks),
        mitigatedRisks: Number(risks.mitigated_risks || 0),
        riskHeatmap: [],
        risksByCategory: [],
      },
      stakeholderAnalytics: {
        totalStakeholders: Number(stakeholders.total_stakeholders || 0),
        activeStakeholders: Number(stakeholders.total_stakeholders || 0),
        recentMeetings: 0,
        communicationFrequency: [],
      },
      retrospectiveAnalytics: {
        totalRetros: 0,
        totalActionItems: 0,
        convertedToTasks: 0,
        teamSatisfactionTrend: [],
      },
    };

    return sendResponse(res, createSuccessResponse(response));
  } catch (error) {
    console.error('Analytics overview error:', error);
    return sendResponse(res, createErrorResponse('Failed to load analytics overview', 'ANALYTICS_ERROR', 500));
  }
});

module.exports = router;