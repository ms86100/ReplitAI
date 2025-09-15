#!/usr/bin/env node

import fs from 'fs';

const backupFilePath = 'attached_assets/db_cluster-14-09-2025@16-48-00_1757946001919.backup';
const outputFilePath = 'public_schema_backup.sql';

console.log('Extracting public schema from Supabase backup...');

// Read the entire backup file
const content = fs.readFileSync(backupFilePath, 'utf8');
const lines = content.split('\n');

const extractedLines = [];
let inPublicSchema = false;
let skipBlock = false;
let blockDepth = 0;

// Skip patterns that cause issues in standard PostgreSQL
const skipPatterns = [
  /^\\restrict/,
  /^\\unrestrict/,
  /CREATE ROLE/,
  /ALTER ROLE.*WITH/,
  /GRANT.*TO.*WITH/,
  /CREATE SCHEMA (auth|extensions|graphql|pgbouncer|realtime|storage|vault|supabase_migrations)/,
  /CREATE EXTENSION/,
  /CREATE TYPE.*\.(aal_level|code_challenge_method|factor_status|factor_type|oauth_registration_type|one_time_token_type)/,
  /CREATE TYPE.*realtime\./,
  /CREATE FUNCTION.*(auth|extensions|graphql|pgbouncer|realtime|storage|vault)\./,
  /ALTER.*OWNER TO (supabase_admin|supabase_auth_admin|supabase_storage_admin|authenticator|service_role|anon|authenticated)/,
  /session_preload_libraries/,
  /COMMENT ON EXTENSION/
];

// Start including content from public schema tables
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Skip problematic patterns
  if (skipPatterns.some(pattern => pattern.test(line))) {
    continue;
  }
  
  // Look for public schema content
  if (line.includes('CREATE TABLE public.') || 
      line.includes('CREATE FUNCTION public.') ||
      line.includes('CREATE TYPE public.') ||
      (line.includes('COPY public.') && line.includes(' FROM stdin;'))) {
    inPublicSchema = true;
  }
  
  // Skip non-public schema content early in the file
  if (i < 3000 && !inPublicSchema) {
    continue;
  }
  
  // Include essential database setup
  if (line.startsWith('SET ') || 
      line.startsWith('SELECT pg_catalog.set_config') ||
      line.includes('standard_conforming_strings') ||
      line.includes('client_encoding')) {
    extractedLines.push(line);
    continue;
  }
  
  // Include public schema content
  if (inPublicSchema) {
    // Clean up ownership statements to use postgres instead of supabase roles
    let cleanedLine = line;
    if (line.includes('OWNER TO')) {
      cleanedLine = line.replace(/OWNER TO (supabase_admin|postgres)/, 'OWNER TO postgres');
    }
    
    extractedLines.push(cleanedLine);
  }
}

// Write the extracted content
const extractedContent = extractedLines.join('\n');
fs.writeFileSync(outputFilePath, extractedContent);

console.log(`✅ Extracted public schema to: ${outputFilePath}`);
console.log(`Original size: ${(content.length / 1024 / 1024).toFixed(2)} MB`);
console.log(`Extracted size: ${(extractedContent.length / 1024 / 1024).toFixed(2)} MB`);
console.log(`Extracted ${extractedLines.length} lines from ${lines.length} total lines`);