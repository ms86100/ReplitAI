# Backend Setup Guide

## Architecture Overview

This project supports both **local Express backend** and **Supabase Edge Functions** backend architectures:

- **Local Backend**: Express.js server with PostgreSQL database
- **Supabase Backend**: Edge Functions with Supabase PostgreSQL (default)

## Switching Between Backends

### Option 1: Local Express Backend

1. **Configure Frontend (.env file)**:
   ```bash
   # Create or edit .env file in project root
   VITE_API_URL=http://localhost:3001
   ```

2. **Configure Backend (backend/.env file)**:
   ```bash
   # Database
   DATABASE_URL=postgresql://user:password@localhost:5432/project_management
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=project_management
   DB_USER=postgres
   DB_PASSWORD=password
   
   # Server
   PORT=3001
   NODE_ENV=development
   
   # JWT
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   JWT_EXPIRES_IN=7d
   REFRESH_TOKEN_SECRET=your-super-secret-refresh-token-key
   
   # CORS
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8080
   ```

3. **Start Backend**:
   ```bash
   cd backend
   npm install
   npm start
   ```

### Option 2: Supabase Edge Functions (Default)

1. **Configure Frontend (.env file)**:
   ```bash
   # Remove or comment out VITE_API_URL to use Supabase
   # VITE_API_URL=http://localhost:3001
   
   VITE_SUPABASE_URL=https://knivoexfpvqohsvpsziq.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

2. **No additional setup required** - Edge Functions run on Supabase

## Available Modules & Endpoints

All modules have full CRUD operations available:

### Core Modules
- **Projects**: Create, read, update, delete projects
- **Auth**: Login, register, logout, session management
- **Wizard**: Project creation wizard with tasks/milestones

### Project Modules
- **Tasks & Milestones**: Task management with milestone tracking
- **Roadmap**: Project timeline and milestone visualization  
- **Stakeholders**: Stakeholder management with RACI matrix
- **Risk Register**: Risk identification and mitigation tracking
- **Discussions**: Project meetings and action items
- **Task Backlog**: Backlog item management and milestone promotion
- **Team Capacity**: Sprint planning and capacity tracking
- **Retrospectives**: Sprint retrospectives with action items

### System Modules
- **Access Control**: Module permissions and user roles
- **Audit**: Activity logging and change tracking
- **Departments**: Organization structure management

## Endpoint Mapping

The API client automatically maps Supabase Edge Function endpoints to local Express routes:

| Supabase Edge Function | Local Express Route |
|----------------------|-------------------|
| `/auth-service/*` | `/auth/*` |
| `/projects-service/*` | `/projects/*` |
| `/wizard-service/*` | `/wizard/*` |
| `/workspace-service/*` | `/workspace/*` |
| `/stakeholder-service/*` | `/stakeholders/*` |
| `/backlog-service/*` | `/backlog/*` |
| `/capacity-service/*` | `/capacity/*` |
| `/retro-service/*` | `/retro/*` |
| `/roadmap-service/*` | `/roadmap/*` |
| `/department-service/*` | `/departments/*` |
| `/access-service/*` | `/access/*` |
| `/audit-service/*` | `/audit/*` |

## Testing All Modules

Each module provides complete CRUD functionality:

### 1. Risk Register
- ✅ Create risks with impact/likelihood scoring
- ✅ Update risk details and mitigation plans
- ✅ Delete risks
- ✅ View all project risks

### 2. Discussions  
- ✅ Create meeting discussions
- ✅ Add action items to discussions
- ✅ Update discussion notes
- ✅ Delete discussions and action items

### 3. Task Backlog
- ✅ Create backlog items
- ✅ Update item priority/status  
- ✅ Move items to milestones (creates tasks)
- ✅ Delete backlog items

### 4. Team Capacity
- ✅ Create capacity iterations
- ✅ Add team members to iterations
- ✅ Update member availability/work mode
- ✅ Delete iterations and members

### 5. Retrospectives
- ✅ Create retrospectives with frameworks
- ✅ Add/edit/delete cards
- ✅ Vote on cards
- ✅ Create action items from cards
- ✅ Delete entire retrospectives

## Database Schema

The system uses the same PostgreSQL schema for both backends:
- Local backend uses your local PostgreSQL instance
- Supabase backend uses Supabase PostgreSQL with RLS policies

## No Tight Coupling

The project is **NOT tightly coupled** to Supabase:
- API client abstracts backend differences
- Same database schema works with both backends  
- Environment variable controls which backend to use
- All business logic is backend-agnostic