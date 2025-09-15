import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon, PlugIcon } from "lucide-react";
import { DatabaseConfig } from "@/lib/types";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface DatabaseConfigProps {
  config: DatabaseConfig;
  onChange: (config: DatabaseConfig) => void;
  onTestConnection: () => void;
  isTestingConnection: boolean;
}

export function DatabaseConfiguration({ 
  config, 
  onChange, 
  onTestConnection,
  isTestingConnection 
}: DatabaseConfigProps) {
  const { toast } = useToast();

  const handleInputChange = (field: keyof DatabaseConfig, value: string | number) => {
    onChange({
      ...config,
      [field]: value,
    });
  };

  const testConnection = async () => {
    try {
      const response = await apiRequest('POST', '/api/test-connection', { config });
      const result = await response.json();
      
      if (result.connected) {
        toast({
          title: "Connection Successful",
          description: "Successfully connected to the database.",
        });
      } else {
        toast({
          title: "Connection Failed",
          description: "Could not connect to the database. Please check your credentials.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Connection Test Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <Card data-testid="database-config-card">
      <CardHeader>
        <CardTitle>Replit PostgreSQL Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="host" className="text-sm font-medium text-foreground">Host</Label>
              <Input
                id="host"
                type="text"
                value={config.host}
                onChange={(e) => handleInputChange('host', e.target.value)}
                placeholder="localhost"
                data-testid="input-host"
              />
            </div>
            <div>
              <Label htmlFor="port" className="text-sm font-medium text-foreground">Port</Label>
              <Input
                id="port"
                type="number"
                value={config.port}
                onChange={(e) => handleInputChange('port', parseInt(e.target.value) || 5432)}
                placeholder="5432"
                data-testid="input-port"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="database" className="text-sm font-medium text-foreground">Database Name</Label>
            <Input
              id="database"
              type="text"
              value={config.database}
              onChange={(e) => handleInputChange('database', e.target.value)}
              placeholder="postgres"
              data-testid="input-database"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="username" className="text-sm font-medium text-foreground">Username</Label>
              <Input
                id="username"
                type="text"
                value={config.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                placeholder="postgres"
                data-testid="input-username"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-sm font-medium text-foreground">Password</Label>
              <Input
                id="password"
                type="password"
                value={config.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                placeholder="••••••••"
                data-testid="input-password"
              />
            </div>
          </div>

          <Button 
            onClick={testConnection}
            disabled={isTestingConnection}
            className="w-full"
            data-testid="button-test-connection"
          >
            <PlugIcon className="w-4 h-4 mr-2" />
            {isTestingConnection ? "Testing Connection..." : "Test Connection"}
          </Button>
        </div>

        <Alert className="mt-6">
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            The system will automatically test the connection before proceeding with restoration.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
