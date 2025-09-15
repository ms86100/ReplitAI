#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Database configuration from environment variables
const config = {
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: 'prod_Mgmt',
  username: process.env.PGUSER,
  password: process.env.PGPASSWORD
};

const backupFilePath = 'attached_assets/db_cluster-14-09-2025@16-48-00_1757946001919.backup';

async function restoreDatabase() {
  console.log('Starting database restoration...');
  console.log(`Target database: ${config.database}`);
  console.log(`Backup file: ${backupFilePath}`);

  // Check if backup file exists
  if (!fs.existsSync(backupFilePath)) {
    console.error(`Error: Backup file not found: ${backupFilePath}`);
    process.exit(1);
  }

  // Build connection string
  const connectionString = `postgresql://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`;

  // Run psql to restore text format dump
  const args = [
    connectionString,
    '-X',                   // Ignore .psqlrc settings
    '-f', backupFilePath    // Input file
  ];

  console.log('Executing psql...');
  
  const restore = spawn('psql', args, {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  restore.stdout.on('data', (data) => {
    console.log(`[INFO] ${data.toString().trim()}`);
  });

  restore.stderr.on('data', (data) => {
    const output = data.toString().trim();
    if (!output.includes('NOTICE') && !output.includes('WARNING')) {
      console.error(`[ERROR] ${output}`);
    } else {
      console.log(`[NOTICE] ${output}`);
    }
  });

  restore.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ Database restoration completed successfully!');
      console.log(`Database "${config.database}" is ready for use.`);
    } else {
      console.error(`\n❌ Restoration failed with exit code: ${code}`);
      process.exit(1);
    }
  });

  restore.on('error', (error) => {
    console.error(`\n❌ Failed to start pg_restore: ${error.message}`);
    process.exit(1);
  });
}

// Run the restoration
restoreDatabase().catch(error => {
  console.error('Restoration failed:', error);
  process.exit(1);
});