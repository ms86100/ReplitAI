import { exec } from 'child_process';
import { promisify } from 'util';
import { storage } from '../storage';
import { DatabaseConfig } from './database-restorer';

const execAsync = promisify(exec);

export class DatabaseVerifier {
  async verifyRestoration(jobId: string, config: DatabaseConfig): Promise<void> {
    try {
      await storage.updateMigrationJob(jobId, { 
        status: 'verifying', 
        progress: 90 
      });

      const connectionString = `postgresql://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`;

      // Get list of schemas and tables
      const schemas = await this.getSchemas(connectionString);
      
      let verifiedCount = 0;
      const totalTables = schemas.reduce((sum, schema) => sum + schema.tables.length, 0);

      for (const schema of schemas) {
        for (const table of schema.tables) {
          try {
            const count = await this.getTableRowCount(connectionString, schema.name, table);
            
            await storage.createVerificationResult({
              jobId,
              schemaName: schema.name,
              tableName: table,
              actualCount: count,
              verified: true, // If we can count rows, table exists and is accessible
            });

            verifiedCount++;
            const progress = 90 + Math.floor((verifiedCount / totalTables) * 10);
            await storage.updateMigrationJob(jobId, { progress });

          } catch (error) {
            await storage.createVerificationResult({
              jobId,
              schemaName: schema.name,
              tableName: table,
              actualCount: 0,
              verified: false,
            });
          }
        }
      }

      await storage.updateMigrationJob(jobId, { 
        status: 'completed', 
        progress: 100 
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      await storage.updateMigrationJob(jobId, { 
        status: 'failed', 
        errorMessage 
      });
      throw error;
    }
  }

  private async getSchemas(connectionString: string): Promise<Array<{ name: string; tables: string[] }>> {
    try {
      const query = `
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        ORDER BY schemaname, tablename;
      `;

      const { stdout } = await execAsync(`psql "${connectionString}" -t -c "${query}"`);
      
      const lines = stdout.trim().split('\n').filter(line => line.trim());
      const schemaMap = new Map<string, string[]>();

      for (const line of lines) {
        const parts = line.trim().split('|').map(part => part.trim());
        if (parts.length === 2) {
          const [schemaName, tableName] = parts;
          if (!schemaMap.has(schemaName)) {
            schemaMap.set(schemaName, []);
          }
          schemaMap.get(schemaName)!.push(tableName);
        }
      }

      return Array.from(schemaMap.entries()).map(([name, tables]) => ({
        name,
        tables,
      }));
    } catch (error) {
      throw new Error(`Failed to get schemas: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getTableRowCount(connectionString: string, schema: string, table: string): Promise<number> {
    try {
      const query = `SELECT COUNT(*) FROM "${schema}"."${table}";`;
      const { stdout } = await execAsync(`psql "${connectionString}" -t -c "${query}"`);
      return parseInt(stdout.trim()) || 0;
    } catch (error) {
      throw new Error(`Failed to count rows in ${schema}.${table}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
