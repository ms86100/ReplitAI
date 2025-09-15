const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { setUserId } = require('../utils/requestContext');

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Access token required',
        code: 'UNAUTHORIZED'
      });
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Fetch user from database to ensure they still exist
      const userResult = await query(
        'SELECT id, email, full_name, created_at, updated_at FROM profiles WHERE id = $1',
        [decoded.userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      req.user = {
        id: decoded.userId,
        email: decoded.email,
        ...userResult.rows[0]
      };
      
      // Make user id available to DB layer so triggers using auth.uid() work
      setUserId(decoded.userId);
      
      next();
    } catch (jwtError) {
      console.error('JWT verification error:', jwtError.message);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};

// Middleware to verify admin role
const verifyAdmin = async (req, res, next) => {
  try {
    const userRoleResult = await query(
      'SELECT role FROM user_roles WHERE user_id = $1 AND role = $2::app_role',
      [req.user.id, 'admin']
    );

    if (userRoleResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
        code: 'FORBIDDEN'
      });
    }

    next();
  } catch (error) {
    console.error('Admin verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Authorization error',
      code: 'AUTH_ERROR'
    });
  }
};

// Middleware to check project access
const verifyProjectAccess = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || req.params.id;
    const userId = req.user.id;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID required',
        code: 'MISSING_PROJECT_ID'
      });
    }

    // Check if user has access to project
    const accessQuery = `
      SELECT EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = $1 AND (
          p.created_by = $2 OR
          EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = $2 AND ur.role = 'admin') OR
          EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = $1 AND pm.user_id = $2) OR
          EXISTS (SELECT 1 FROM module_permissions mp WHERE mp.project_id = $1 AND mp.user_id = $2)
        )
      ) as has_access
    `;

    const result = await query(accessQuery, [projectId, userId]);
    
    if (!result.rows[0].has_access) {
      return res.status(403).json({
        success: false,
        error: 'Project access denied',
        code: 'FORBIDDEN'
      });
    }

    req.projectId = projectId;
    next();
  } catch (error) {
    console.error('Project access verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Project access verification failed',
      code: 'ACCESS_CHECK_ERROR'
    });
  }
};

module.exports = {
  verifyToken,
  verifyAdmin,
  verifyProjectAccess
};