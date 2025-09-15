# Project Management Backend

A Node.js/Express backend that mirrors all Supabase edge functions for the project management application.

## Features

- **Authentication**: JWT-based auth with login, register, logout, refresh tokens
- **Projects**: Full CRUD operations for project management  
- **Stakeholders**: Manage project stakeholders with RACI matrix
- **Roadmap**: Milestone management and tracking
- **Backlog**: Task backlog with status tracking
- **Access Control**: Module-based permissions system
- **Audit**: Comprehensive activity logging
- **Capacity**: Team capacity planning and tracking
- **Retrospectives**: Sprint retrospectives with action items
- **Workspace**: Dashboard and summary views
- **Wizard**: Project creation wizard
- **Departments**: Department management

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment setup:**
   ```bash
   cp .env.example .env
   # Edit .env with your database and configuration values
   ```

3. **Database setup:**
   - Create a PostgreSQL database
   - Run the same migrations from your Supabase project
   - Update DATABASE_URL in .env

4. **Start server:**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## API Documentation

All endpoints follow the same structure as the Supabase edge functions:

### Authentication
- `POST /auth-service/login` - User login
- `POST /auth-service/register` - User registration  
- `POST /auth-service/logout` - User logout
- `GET /auth-service/user` - Get current user
- `POST /auth-service/refresh` - Refresh token

### Projects
- `GET /projects-service/projects` - List projects
- `POST /projects-service/projects` - Create project
- `GET /projects-service/projects/:id` - Get project
- `PUT /projects-service/projects/:id` - Update project
- `DELETE /projects-service/projects/:id` - Delete project

### Other Services
- `/stakeholder-service/*` - Stakeholder management
- `/roadmap-service/*` - Milestone management
- `/backlog-service/*` - Task backlog
- `/access-service/*` - Access control
- `/audit-service/*` - Activity logging
- `/capacity-service/*` - Team capacity
- `/retro-service/*` - Retrospectives
- `/workspace-service/*` - Dashboard
- `/wizard-service/*` - Project wizard
- `/department-service/*` - Departments

## Security Features

- JWT authentication with refresh tokens
- Rate limiting (100 requests per 15 minutes)
- CORS protection
- Helmet security headers
- SQL injection protection via parameterized queries
- Project-level access control
- Admin role verification

## Environment Variables

```env
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
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=your-refresh-secret

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Admin
ADMIN_EMAIL=admin@admin.com
```

## Health Check

Visit `http://localhost:3001/health` to verify the server is running.

## Development

The server includes:
- Hot reloading with nodemon
- Comprehensive logging
- Error handling middleware
- CORS support for local development
- Database connection pooling

## Production Deployment

1. Set `NODE_ENV=production`
2. Configure SSL for database connections
3. Set secure JWT secrets
4. Configure allowed origins for CORS
5. Set up reverse proxy (nginx)
6. Enable SSL/TLS