# 🚀 Complete Migration Guide: Supabase → Local Node.js Backend

This guide will help you migrate from Supabase edge functions to a local Node.js backend while maintaining the same functionality.

## 📋 Prerequisites

- PostgreSQL installed locally
- Node.js (v16 or higher)
- Your Supabase database backup/dump
- Git (optional, for version control)

## 🔧 Step 1: Database Setup

### 1.1 Restore Your Supabase Database

```bash
# Create local database
createdb project_management

# Restore from your Supabase backup
psql project_management < your_supabase_backup.sql

# Or if using pg_dump format:
pg_restore -d project_management your_supabase_backup.dump
```

### 1.2 Set Up Auth Tables

```bash
cd backend
chmod +x setup_database.sh
./setup_database.sh

# For Windows:
setup_database.bat
```

## 🛠️ Step 2: Backend Setup

### 2.1 Install Backend Dependencies

```bash
cd backend
npm install
```

### 2.2 Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your database credentials
nano .env
```

**Required .env variables:**
```env
# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/project_management
DB_HOST=localhost
DB_PORT=5432
DB_NAME=project_management
DB_USER=postgres
DB_PASSWORD=your_password

# Server Configuration
PORT=3001
NODE_ENV=development

# JWT Configuration (generate secure secrets)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=your-super-secret-refresh-token-key

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Admin Configuration
ADMIN_EMAIL=admin@admin.com
```

### 2.3 Start Backend Server

```bash
npm run dev
```

You should see:
```
🚀 Server running on port 3001
📊 Environment: development
🔗 Health check: http://localhost:3001/health
```

## 🎯 Step 3: Frontend Configuration

### 3.1 Set Frontend Environment

Create or update `.env` in your frontend root:

```env
# For local backend
VITE_API_URL=http://localhost:3001

# For Supabase backend (comment out or remove VITE_API_URL)
# VITE_API_URL=
```

### 3.2 Start Frontend

```bash
npm run dev
# or
npm start
```

## ✅ Step 4: Verification

### 4.1 Test Health Check

Visit: `http://localhost:3001/health`

Should return:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "environment": "development"
}
```

### 4.2 Test Authentication

1. Go to `/auth` in your frontend
2. Try registering a new user
3. Try logging in
4. Verify JWT tokens are working

### 4.3 Test Database Operations

1. Create a project
2. Add stakeholders
3. Create milestones
4. Verify data persists in your local database

## 🔄 Step 5: Switching Between Environments

### Local Backend → Supabase
```bash
# In frontend .env, comment out or remove:
# VITE_API_URL=http://localhost:3001
```

### Supabase → Local Backend
```bash
# In frontend .env, add:
VITE_API_URL=http://localhost:3001
```

## 🛡️ Security Features

The local backend includes:

- **JWT Authentication** with refresh tokens
- **Rate Limiting** (100 requests per 15 minutes)
- **CORS Protection** 
- **Helmet Security Headers**
- **SQL Injection Protection** via parameterized queries
- **Project-level Access Control**
- **Admin Role Verification**

## 📊 API Endpoints

All endpoints maintain the same structure as Supabase edge functions:

### Authentication
- `POST /auth-service/login`
- `POST /auth-service/register`
- `POST /auth-service/logout`
- `GET /auth-service/user`
- `POST /auth-service/refresh`

### Core Services
- `**/projects-service/**` - Project management
- `**/stakeholder-service/**` - Stakeholder management
- `**/roadmap-service/**` - Milestone management
- `**/backlog-service/**` - Task backlog
- `**/access-service/**` - Access control
- `**/audit-service/**` - Activity logging
- `**/capacity-service/**` - Team capacity planning
- `**/retro-service/**` - Retrospectives
- `**/workspace-service/**` - Dashboard & workspace
- `**/wizard-service/**` - Project creation wizard
- `**/department-service/**` - Department management

## 🚨 Troubleshooting

### Database Connection Issues

```bash
# Test PostgreSQL connection
psql -h localhost -p 5432 -U postgres -d project_management -c "SELECT 1;"

# Check if database exists
psql -h localhost -p 5432 -U postgres -l | grep project_management
```

### Port Already in Use

```bash
# Check what's using port 3001
lsof -i :3001

# Kill the process
kill -9 <PID>
```

### Authentication Issues

1. Check JWT secrets are set in `.env`
2. Verify admin user exists:
   ```sql
   SELECT * FROM profiles WHERE email = 'admin@admin.com';
   SELECT * FROM user_roles WHERE role = 'admin';
   ```
3. Clear browser localStorage:
   ```javascript
   localStorage.clear();
   ```

### CORS Issues

Ensure `ALLOWED_ORIGINS` in backend `.env` includes your frontend URL:
```env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

## 🎉 Success!

You're now running a complete local backend that:

- ✅ Handles all authentication
- ✅ Manages all database operations
- ✅ Maintains the same API interface
- ✅ Works with your existing frontend
- ✅ Can switch back to Supabase anytime

## 📝 Notes

- **No code changes** needed in components
- **Same API interface** as Supabase edge functions
- **Easy environment switching** via single env variable
- **Full compatibility** with your existing data structure
- **Production ready** with proper security measures

Your local development environment is now completely independent of Supabase while maintaining full compatibility!