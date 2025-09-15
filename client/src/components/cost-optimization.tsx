import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { OptimizationSettings } from "@/lib/types";

interface CostOptimizationProps {
  settings: OptimizationSettings;
  onChange: (settings: OptimizationSettings) => void;
}

export function CostOptimization({ settings, onChange }: CostOptimizationProps) {
  const handleSettingChange = (key: keyof OptimizationSettings, value: boolean) => {
    onChange({
      ...settings,
      [key]: value,
    });
  };

  return (
    <Card data-testid="cost-optimization-card">
      <CardHeader>
        <CardTitle>Cost Optimization Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
            <div>
              <span className="text-sm font-medium text-secondary-foreground">
                Selective Schema Restoration
              </span>
              <p className="text-xs text-muted-foreground mt-1">
                Only restore essential schemas to reduce resource usage
              </p>
            </div>
            <Switch
              checked={settings.selectiveRestore}
              onCheckedChange={(checked) => handleSettingChange('selectiveRestore', checked)}
              data-testid="switch-selective-restore"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
            <div>
              <span className="text-sm font-medium text-secondary-foreground">
                Compress Data During Transfer
              </span>
              <p className="text-xs text-muted-foreground mt-1">
                Reduce bandwidth usage with compression
              </p>
            </div>
            <Switch
              checked={settings.compression}
              onCheckedChange={(checked) => handleSettingChange('compression', checked)}
              data-testid="switch-compression"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
            <div>
              <span className="text-sm font-medium text-secondary-foreground">
                Batch Processing
              </span>
              <p className="text-xs text-muted-foreground mt-1">
                Process data in smaller batches to reduce memory usage
              </p>
            </div>
            <Switch
              checked={settings.batching}
              onCheckedChange={(checked) => handleSettingChange('batching', checked)}
              data-testid="switch-batching"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
