import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { storage } from '../storage';

const execAsync = promisify(exec);

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface OptimizationSettings {
  selectiveRestore: boolean;
  compression: boolean;
  batching: boolean;
  excludeSchemas?: string[];
  batchSize?: number;
}

export class DatabaseRestorer {
  async testConnection(config: DatabaseConfig): Promise<boolean> {
    try {
      const connectionString = `postgresql://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`;
      
      // Use a simple query to test connection
      const testCommand = `psql "${connectionString}" -c "SELECT version();"`;
      await execAsync(testCommand);
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  async restoreDatabase(
    jobId: string,
    backupFilePath: string,
    config: DatabaseConfig,
    optimization: OptimizationSettings
  ): Promise<void> {
    try {
      await storage.updateMigrationJob(jobId, { 
        status: 'restoring', 
        progress: 0 
      });

      await this.logMessage(jobId, 'info', 'Starting database restoration...');

      // Create connection string
      const connectionString = `postgresql://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`;

      // Prepare restoration command
      const restoreArgs = this.buildRestoreCommand(backupFilePath, connectionString, optimization);
      
      await this.logMessage(jobId, 'info', `Executing: pg_restore with optimizations`);

      // Execute restoration with progress tracking
      await this.executeRestore(jobId, restoreArgs, optimization);

      await storage.updateMigrationJob(jobId, { 
        status: 'verifying', 
        progress: 90 
      });

      await this.logMessage(jobId, 'info', 'Database restoration completed successfully');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await storage.updateMigrationJob(jobId, { 
        status: 'failed', 
        errorMessage 
      });
      await this.logMessage(jobId, 'error', `Restoration failed: ${errorMessage}`);
      throw error;
    }
  }

  private buildRestoreCommand(
    backupFilePath: string,
    connectionString: string,
    optimization: OptimizationSettings
  ): string[] {
    const args = ['pg_restore'];
    
    // Connection parameters
    args.push('-d', connectionString);
    
    // Optimization flags
    if (optimization.compression) {
      args.push('--no-compression'); // Disable additional compression since file might already be compressed
    }
    
    // Selective restoration
    if (optimization.selectiveRestore && optimization.excludeSchemas) {
      for (const schema of optimization.excludeSchemas) {
        args.push('--exclude-schema', schema);
      }
    }
    
    // Performance optimizations
    args.push('--no-owner'); // Skip ownership commands
    args.push('--no-privileges'); // Skip privilege commands initially
    args.push('--single-transaction'); // Use single transaction for consistency
    
    if (optimization.batching) {
      args.push('--jobs', '2'); // Parallel processing but limited for resource conservation
    }
    
    // Verbose output for progress tracking
    args.push('--verbose');
    
    // Input file
    args.push(backupFilePath);
    
    return args;
  }

  private async executeRestore(
    jobId: string,
    command: string[],
    optimization: OptimizationSettings
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn(command[0], command.slice(1), {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let progress = 10;
      
      process.stdout?.on('data', async (data) => {
        const output = data.toString();
        await this.logMessage(jobId, 'info', `Restore output: ${output.trim()}`);
        
        // Update progress based on output patterns
        if (output.includes('restoring')) {
          progress = Math.min(progress + 5, 80);
          await storage.updateMigrationJob(jobId, { progress });
        }
      });

      process.stderr?.on('data', async (data) => {
        const error = data.toString();
        if (!error.includes('NOTICE') && !error.includes('WARNING')) {
          await this.logMessage(jobId, 'error', `Restore error: ${error.trim()}`);
        } else {
          await this.logMessage(jobId, 'warn', `Restore notice: ${error.trim()}`);
        }
      });

      process.on('close', async (code) => {
        if (code === 0) {
          await storage.updateMigrationJob(jobId, { progress: 85 });
          resolve();
        } else {
          reject(new Error(`pg_restore process exited with code ${code}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to start pg_restore: ${error.message}`));
      });
    });
  }

  private async logMessage(jobId: string, level: 'info' | 'warn' | 'error', message: string): Promise<void> {
    try {
      await storage.createRestorationLog({
        jobId,
        level,
        message,
      });
    } catch (error) {
      console.error('Failed to log message:', error);
    }
  }
}
