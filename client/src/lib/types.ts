export interface MigrationJob {
  id: string;
  filename: string;
  fileSize: number;
  status: string;
  backupInfo?: BackupInfo;
  config?: DatabaseConfig;
  progress: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackupInfo {
  fileSize: number;
  version: string;
  schemas: Array<{
    name: string;
    tableCount: number;
  }>;
  estimatedTime: string;
  estimatedStorage: string;
  estimatedMemory: string;
}

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

export interface RestorationLog {
  id: string;
  jobId: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

export interface VerificationResult {
  id: string;
  jobId: string;
  schemaName: string;
  tableName: string;
  expectedCount?: number;
  actualCount?: number;
  verified: boolean;
  createdAt: string;
}
