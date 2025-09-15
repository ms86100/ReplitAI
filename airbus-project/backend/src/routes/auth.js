const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const { createSuccessResponse, createErrorResponse, sendResponse } = require('../utils/responses');

const router = express.Router();

// Helper function to generate tokens
const generateTokens = (user) => {
  const payload = {
    userId: user.id,
    email: user.email
  };
  
  const jwtSecret = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
  const refreshSecret = process.env.REFRESH_TOKEN_SECRET || 'dev_refresh_secret_change_me';

  const accessToken = jwt.sign(payload, jwtSecret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
  
  const refreshToken = jwt.sign(payload, refreshSecret, {
    expiresIn: '30d'
  });
  
  return { accessToken, refreshToken };
};

// POST /auth-service/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return sendResponse(res, createErrorResponse('Email and password required', 'MISSING_FIELDS', 400));
    }

    // Find user by email
    const userResult = await query(
      'SELECT p.*, au.encrypted_password FROM profiles p JOIN auth.users au ON p.id = au.id WHERE p.email = $1',
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Invalid credentials', 'INVALID_CREDENTIALS', 401));
    }

    const user = userResult.rows[0];
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.encrypted_password);
    if (!isValidPassword) {
      return sendResponse(res, createErrorResponse('Invalid credentials', 'INVALID_CREDENTIALS', 401));
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);
    
    // Create session object
    const session = {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
      expires_in: 604800, // 7 days in seconds
      expires_at: Math.floor(Date.now() / 1000) + 604800,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    };

    sendResponse(res, createSuccessResponse({
      user: session.user,
      session
    }));
  } catch (error) {
    console.error('Login error:', error);
    sendResponse(res, createErrorResponse('Login failed', 'LOGIN_ERROR', 500));
  }
});

// POST /auth-service/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    
    if (!email || !password) {
      return sendResponse(res, createErrorResponse('Email and password required', 'MISSING_FIELDS', 400));
    }

    // Check if user already exists (auth + profile), handle orphaned profiles gracefully
    const lowerEmail = email.toLowerCase();
    const existingProfile = await query('SELECT id FROM profiles WHERE email = $1', [lowerEmail]);
    const existingAuth = await query('SELECT id FROM auth.users WHERE email = $1', [lowerEmail]);
    if (existingAuth.rows.length > 0) {
      // If auth user exists but profile is missing, repair the account instead of failing
      if (existingProfile.rows.length === 0) {
        const existingUserId = existingAuth.rows[0].id;
        const client = await require('../config/database').getClient();
        try {
          await client.query('BEGIN');
          await client.query(
            'INSERT INTO profiles (id, email, full_name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
            [existingUserId, lowerEmail, fullName || email, new Date(), new Date()]
          );
          const role = lowerEmail === process.env.ADMIN_EMAIL ? 'admin' : 'project_coordinator';
          await client.query(
            `INSERT INTO user_roles (user_id, role)
             SELECT $1, $2::app_role
             WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = $1)`,
            [existingUserId, role]
          );
          await client.query('COMMIT');
        } catch (repairErr) {
          await client.query('ROLLBACK');
          console.error('Account repair error:', repairErr);
          throw repairErr;
        } finally {
          client.release();
        }

        const user = {
          id: existingUserId,
          email: lowerEmail,
          full_name: fullName || email,
          created_at: new Date(),
          updated_at: new Date()
        };

        const { accessToken, refreshToken } = generateTokens(user);
        const session = {
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: 'bearer',
          expires_in: 604800,
          expires_at: Math.floor(Date.now() / 1000) + 604800,
          user
        };

        return sendResponse(res, createSuccessResponse({
          user,
          session,
          message: 'Account repaired and registration completed'
        }));
      }

      // Otherwise, user truly exists
      return sendResponse(res, createErrorResponse('User already exists', 'USER_EXISTS', 400));
    }
    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Always create a fresh auth user; profile will be created by trigger
    const userId = uuidv4();
    
    // Start transaction
    const client = await require('../config/database').getClient();
    
    try {
      await client.query('BEGIN');
      
      await client.query(
        'INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [userId, lowerEmail, hashedPassword, new Date(), new Date(), new Date()]
      );

      // Populate extended auth.users columns only if they exist to avoid aborting the transaction
      const updateIfCol = async (column, sql, params) => {
        const colCheck = await client.query(
          "SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = $1",
          [column]
        );
        if (colCheck.rowCount > 0) {
          await client.query(sql, params);
        }
      };
      await updateIfCol('aud', 'UPDATE auth.users SET aud = $2 WHERE id = $1', [userId, 'authenticated']);
      await updateIfCol('role', 'UPDATE auth.users SET role = $2 WHERE id = $1', [userId, 'authenticated']);
      await updateIfCol('raw_app_meta_data', 'UPDATE auth.users SET raw_app_meta_data = $2::jsonb WHERE id = $1', [userId, JSON.stringify({ provider: 'email', providers: ['email'] })]);
      await updateIfCol('raw_user_meta_data', "UPDATE auth.users SET raw_user_meta_data = jsonb_build_object('full_name', $2::text) WHERE id = $1", [userId, fullName || email]);
      // Skip confirmed_at updates: some deployments use generated columns we must not modify
      await updateIfCol('is_super_admin', 'UPDATE auth.users SET is_super_admin = FALSE WHERE id = $1', [userId]);
      await updateIfCol('is_sso_user', 'UPDATE auth.users SET is_sso_user = FALSE WHERE id = $1', [userId]);
      await updateIfCol('is_anonymous', 'UPDATE auth.users SET is_anonymous = FALSE WHERE id = $1', [userId]);
      
      // Ensure profile exists (trigger should create it; fallback here for local setups)
      await client.query(
        `INSERT INTO profiles (id, email, full_name, created_at, updated_at)
         SELECT $1, $2, $3, $4, $5
         WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE id = $1)`,
        [userId, lowerEmail, fullName || email, new Date(), new Date()]
      );

      // Assign default role if not already present
      const role = lowerEmail === process.env.ADMIN_EMAIL ? 'admin' : 'project_coordinator';
      await client.query(
        `INSERT INTO user_roles (user_id, role)
         SELECT $1, $2::app_role
         WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = $1)`,
        [userId, role]
      );
      
      await client.query('COMMIT');
      
      const user = {
        id: userId,
        email: email.toLowerCase(),
        full_name: fullName || email,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user);
      
      // Create session object
      const session = {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'bearer',
        expires_in: 604800,
        expires_at: Math.floor(Date.now() / 1000) + 604800,
        user
      };

      sendResponse(res, createSuccessResponse({
        user,
        session,
        message: 'Registration successful'
      }));
      
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === '23505') {
      sendResponse(res, createErrorResponse('User already exists', 'USER_EXISTS', 400));
    } else {
      const host = (req.headers?.host || '').toLowerCase();
      const origin = (req.headers?.origin || '').toLowerCase();
      const expose = process.env.NODE_ENV !== 'production' || host.includes('localhost') || host.includes('127.0.0.1') || origin.includes('localhost') || origin.includes('127.0.0.1');
      const errorMsg = expose
        ? [error.detail, error.message, error.code, error.constraint, error.table, error.stack].filter(Boolean).join(' | ')
        : 'Registration failed';
      sendResponse(res, createErrorResponse(errorMsg, 'REGISTRATION_ERROR', 500));
    }
  }
});

// POST /auth-service/logout
router.post('/logout', verifyToken, async (req, res) => {
  try {
    // In a real implementation, you might want to blacklist the token
    sendResponse(res, createSuccessResponse({ message: 'Logged out successfully' }));
  } catch (error) {
    console.error('Logout error:', error);
    sendResponse(res, createErrorResponse('Logout failed', 'LOGOUT_ERROR', 500));
  }
});

// GET /auth-service/user
router.get('/user', verifyToken, async (req, res) => {
  try {
    sendResponse(res, createSuccessResponse({ user: req.user }));
  } catch (error) {
    console.error('Get user error:', error);
    sendResponse(res, createErrorResponse('Failed to get user', 'GET_USER_ERROR', 500));
  }
});

// POST /auth-service/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      return sendResponse(res, createErrorResponse('Refresh token required', 'MISSING_REFRESH_TOKEN', 400));
    }

    // Verify refresh token
    const decoded = jwt.verify(refresh_token, process.env.REFRESH_TOKEN_SECRET);
    
    // Get user from database
    const userResult = await query(
      'SELECT id, email, full_name, created_at, updated_at FROM profiles WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return sendResponse(res, createErrorResponse('User not found', 'USER_NOT_FOUND', 401));
    }

    const user = userResult.rows[0];
    
    // Generate new tokens
    const { accessToken, refreshToken } = generateTokens(user);
    
    const session = {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
      expires_in: 604800,
      expires_at: Math.floor(Date.now() / 1000) + 604800,
      user
    };

    sendResponse(res, createSuccessResponse({ user, session }));
  } catch (error) {
    console.error('Refresh token error:', error);
    sendResponse(res, createErrorResponse('Invalid refresh token', 'INVALID_REFRESH_TOKEN', 401));
  }
});

// GET /auth-service/users/:id/profile
router.get('/users/:id/profile', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const userResult = await query(
      'SELECT id, email, full_name, department_id, created_at, updated_at FROM profiles WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Profile not found', 'PROFILE_NOT_FOUND', 404));
    }

    sendResponse(res, createSuccessResponse(userResult.rows[0]));
  } catch (error) {
    console.error('Get profile error:', error);
    sendResponse(res, createErrorResponse('Failed to get profile', 'GET_PROFILE_ERROR', 500));
  }
});

// GET /auth-service/users/:id/role
router.get('/users/:id/role', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const roleResult = await query(
      'SELECT role FROM user_roles WHERE user_id = $1',
      [id]
    );

    if (roleResult.rows.length === 0) {
      return sendResponse(res, createSuccessResponse({ role: null }));
    }

    sendResponse(res, createSuccessResponse({ role: roleResult.rows[0].role }));
  } catch (error) {
    console.error('Get role error:', error);
    sendResponse(res, createErrorResponse('Failed to get user role', 'GET_ROLE_ERROR', 500));
  }
});

// GET /auth-service/session
router.get('/session', verifyToken, async (req, res) => {
  try {
    // Get user role
    const roleResult = await query(
      'SELECT role FROM user_roles WHERE user_id = $1',
      [req.user.id]
    );

    const role = roleResult.rows.length > 0 ? roleResult.rows[0].role : null;

    sendResponse(res, createSuccessResponse({
      user: req.user,
      role
    }));
  } catch (error) {
    console.error('Get session error:', error);
    sendResponse(res, createErrorResponse('Failed to get session', 'GET_SESSION_ERROR', 500));
  }
});

// PUT /auth-service/profiles/:id/department
router.put('/profiles/:id/department', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { department_id } = req.body;
    
    // Only allow users to update their own profile or admins to update any profile
    if (req.user.id !== id) {
      const adminResult = await query(
        'SELECT role FROM user_roles WHERE user_id = $1 AND role = $2::app_role',
        [req.user.id, 'admin']
      );
      
      if (adminResult.rows.length === 0) {
        return sendResponse(res, createErrorResponse('Access denied', 'FORBIDDEN', 403));
      }
    }
    
    const updateQuery = `
      UPDATE profiles 
      SET department_id = $2, updated_at = $3
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await query(updateQuery, [id, department_id, new Date()]);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Profile not found', 'PROFILE_NOT_FOUND', 404));
    }
    
    sendResponse(res, createSuccessResponse({ message: 'Department updated successfully' }));
  } catch (error) {
    console.error('Update department error:', error);
    sendResponse(res, createErrorResponse('Failed to update department', 'UPDATE_ERROR', 500));
  }
});

// GET /auth-service/profiles/:id
router.get('/profiles/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const profileQuery = `
      SELECT p.*, d.name as department_name
      FROM profiles p
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE p.id = $1
    `;
    
    const result = await query(profileQuery, [id]);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Profile not found', 'PROFILE_NOT_FOUND', 404));
    }
    
    const profile = result.rows[0];
    
    // Return departments as nested object for compatibility
    if (profile.department_name) {
      profile.departments = { name: profile.department_name };
    }
    
    sendResponse(res, createSuccessResponse(profile));
  } catch (error) {
    console.error('Get profile error:', error);
    sendResponse(res, createErrorResponse('Failed to get profile', 'GET_PROFILE_ERROR', 500));
  }
});

// POST /auth-service/profiles/batch
router.post('/profiles/batch', verifyToken, async (req, res) => {
  try {
    const { user_ids } = req.body;
    
    if (!user_ids || !Array.isArray(user_ids)) {
      return sendResponse(res, createErrorResponse('User IDs array required', 'MISSING_FIELDS', 400));
    }
    
    const profilesQuery = `
      SELECT id, email, full_name, department_id, created_at, updated_at
      FROM profiles
      WHERE id = ANY($1::uuid[])
    `;
    
    const result = await query(profilesQuery, [user_ids]);
    
    sendResponse(res, createSuccessResponse({ profiles: result.rows }));
  } catch (error) {
    console.error('Get profiles batch error:', error);
    sendResponse(res, createErrorResponse('Failed to get profiles', 'GET_PROFILES_ERROR', 500));
  }
});

// GET /auth-service/profiles/:userId
router.get('/profiles/:userId', verifyToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const profileQuery = `
      SELECT pr.*, ur.role as user_role, d.name as department_name
      FROM profiles pr
      LEFT JOIN user_roles ur ON pr.id = ur.user_id
      LEFT JOIN departments d ON pr.department_id = d.id
      WHERE pr.id = $1
    `;
    
    const result = await query(profileQuery, [userId]);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Profile not found', 'NOT_FOUND', 404));
    }
    
    sendResponse(res, createSuccessResponse(result.rows[0]));
  } catch (error) {
    console.error('Get profile error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch profile', 'FETCH_ERROR', 500));
  }
});

// POST /auth-service/profiles/batch
router.post('/profiles/batch', verifyToken, async (req, res) => {
  try {
    const { user_ids } = req.body;
    
    if (!user_ids || !Array.isArray(user_ids)) {
      return sendResponse(res, createErrorResponse('user_ids array is required', 'MISSING_FIELDS', 400));
    }
    
    const placeholders = user_ids.map((_, index) => `$${index + 1}`).join(',');
    const profilesQuery = `
      SELECT pr.*, ur.role as user_role, d.name as department_name
      FROM profiles pr
      LEFT JOIN user_roles ur ON pr.id = ur.user_id
      LEFT JOIN departments d ON pr.department_id = d.id
      WHERE pr.id IN (${placeholders})
    `;
    
    const result = await query(profilesQuery, user_ids);
    
    sendResponse(res, createSuccessResponse({ profiles: result.rows }));
  } catch (error) {
    console.error('Get profiles batch error:', error);
    sendResponse(res, createErrorResponse('Failed to fetch profiles', 'FETCH_ERROR', 500));
  }
});

// PUT /auth-service/profiles/:userId/department
router.put('/profiles/:userId/department', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const userId = req.params.userId;
    const { department_id } = req.body;
    
    const updateQuery = `
      UPDATE profiles 
      SET department_id = $1, updated_at = $2
      WHERE id = $3
      RETURNING *
    `;
    
    const result = await query(updateQuery, [department_id, new Date(), userId]);
    
    if (result.rows.length === 0) {
      return sendResponse(res, createErrorResponse('Profile not found', 'NOT_FOUND', 404));
    }
    
    sendResponse(res, createSuccessResponse({
      message: 'Department updated successfully',
      profile: result.rows[0]
    }));
  } catch (error) {
    console.error('Update profile department error:', error);
    sendResponse(res, createErrorResponse('Failed to update department', 'UPDATE_ERROR', 500));
  }
});

module.exports = router;