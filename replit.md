# Overview

This is a full-stack project management application built with a hybrid architecture that supports both Supabase and local backend implementations. The application provides enterprise-grade project management capabilities with role-based access control, comprehensive module management, and database migration tools. It features a React frontend using shadcn/ui components and Tailwind CSS for styling, with a Node.js/Express backend that can work with PostgreSQL databases.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Library**: shadcn/ui components with Radix UI primitives for accessibility
- **Styling**: Tailwind CSS with custom design tokens for Airbus branding
- **State Management**: TanStack React Query for server state and custom Context providers for application state
- **Routing**: Both React Router and Wouter routing implementations (dual architecture)
- **Authentication**: Custom JWT-based authentication with refresh tokens

## Backend Architecture
- **Server**: Express.js with TypeScript support
- **Database Layer**: Drizzle ORM with PostgreSQL
- **Authentication**: JWT tokens with bcrypt for password hashing
- **File Handling**: Multer for backup file uploads and processing
- **Security**: Helmet for security headers, CORS configuration, rate limiting
- **Development**: Hot reloading with Vite integration for full-stack development

## Database Architecture
- **Primary Database**: PostgreSQL with Neon serverless driver
- **Migration System**: Drizzle Kit for schema migrations
- **Backup & Restore**: Custom backup analysis and database restoration services
- **Schema**: Includes migration jobs, restoration logs, and verification results tables

## Key Design Patterns
- **Hybrid Backend Support**: Application can switch between Supabase and local Express backend
- **Module-based Permissions**: Granular access control system for project modules
- **Service Layer**: Separate services for backup analysis, database restoration, and verification
- **Context Providers**: React context for authentication and project state management
- **Component Composition**: Reusable UI components with consistent design system

# External Dependencies

## Core Technologies
- **@neondatabase/serverless**: Serverless PostgreSQL driver for Neon database
- **drizzle-orm**: Type-safe ORM for database operations
- **@supabase/supabase-js**: Supabase client for fallback backend support
- **@tanstack/react-query**: Server state management and caching

## UI and Styling
- **@radix-ui/***: Comprehensive set of accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **@dnd-kit/***: Drag and drop functionality for Kanban boards
- **class-variance-authority**: Type-safe styling variants

## Development Tools
- **vite**: Build tool and development server
- **typescript**: Type safety and enhanced developer experience
- **eslint**: Code linting and quality enforcement
- **tsx**: TypeScript execution for server development

## Security and Authentication
- **bcryptjs**: Password hashing
- **jsonwebtoken**: JWT token generation and verification
- **helmet**: Security headers for Express
- **express-rate-limit**: API rate limiting

## File and Data Processing
- **multer**: File upload handling for backup restoration
- **compression**: Response compression middleware
- **morgan**: HTTP request logging

## Email Services
- **nodemailer**: SMTP email sending for overdue task reminders
- **Email Configuration**: Uses SMTP credentials stored in environment variables (EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS)
- **Overdue Task Reminders**: Automated email notifications for overdue tasks with HTML formatting