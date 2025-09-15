#!/bin/bash

# Database Migration Script for Local Backend
# This script sets up the local PostgreSQL database for the project management backend

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Setting up local database for Project Management Backend${NC}"

# Load environment variables
if [ -f .env ]; then
    echo -e "${GREEN}✅ Loading environment variables from .env${NC}"
    export $(grep -v '^#' .env | xargs)
else
    echo -e "${YELLOW}⚠️  No .env file found. Using default values.${NC}"
    DB_HOST=${DB_HOST:-localhost}
    DB_PORT=${DB_PORT:-5432}
    DB_NAME=${DB_NAME:-project_management}
    DB_USER=${DB_USER:-postgres}
fi

echo -e "${BLUE}📋 Database Configuration:${NC}"
echo -e "  Host: ${DB_HOST}"
echo -e "  Port: ${DB_PORT}"
echo -e "  Database: ${DB_NAME}"
echo -e "  User: ${DB_USER}"

# Check if database exists
if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    echo -e "${GREEN}✅ Database '$DB_NAME' already exists${NC}"
else
    echo -e "${YELLOW}⚠️  Database '$DB_NAME' does not exist. Creating...${NC}"
    createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME
    echo -e "${GREEN}✅ Database '$DB_NAME' created successfully${NC}"
fi

# Run migrations sequentially
echo -e "${BLUE}🔧 Running auth tables migration (001)...${NC}"
if ! psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f migrations/001_setup_auth_tables.sql; then
  echo -e "${RED}❌ Auth tables migration failed${NC}"
  exit 1
fi

echo -e "${BLUE}🔧 Running completion migration (002)...${NC}"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f migrations/002_setup_complete.sql || echo -e "${YELLOW}⚠️  002 migration returned a non-zero exit (informational). Continuing...${NC}"

echo -e "${BLUE}🔧 Running capacity trigger fix (003)...${NC}"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f migrations/003_fix_capacity_member_trigger.sql || echo -e "${YELLOW}⚠️  003 migration returned a non-zero exit. Continuing...${NC}"

echo -e "${BLUE}🔧 Running budget tables migration (004)...${NC}"
if ! psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f migrations/004_create_budget_tables.sql; then
  echo -e "${RED}❌ Budget tables migration failed${NC}"
  exit 1
fi


# Test database connection
echo -e "${BLUE}🔍 Testing database connection...${NC}"
if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) FROM profiles;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database connection test successful${NC}"
else
    echo -e "${RED}❌ Database connection test failed${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 Database setup completed successfully!${NC}"
echo -e "${BLUE}💡 Next steps:${NC}"
echo -e "  1. Start the backend server: ${YELLOW}npm run dev${NC}"
echo -e "  2. Set frontend env variable: ${YELLOW}VITE_API_URL=http://localhost:3001${NC}"
echo -e "  3. Start your frontend application"