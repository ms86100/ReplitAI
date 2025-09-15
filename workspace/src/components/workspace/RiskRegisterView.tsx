import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, AlertTriangle, Clock, User, Trash2, Edit } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useApiAuth } from '@/hooks/useApiAuth';
import { apiClient } from '@/services/api';

interface Risk {
  id: string;
  risk_code: string;
  title: string;
  description?: string;
  category?: string;
  cause?: string;
  consequence?: string;
  likelihood?: number;
  impact?: number;
  risk_score?: number;
  owner?: string;
  response_strategy?: string;
  mitigation_plan?: string[];
  contingency_plan?: string;
  status?: string;
  identified_date?: string;
  last_updated?: string;
  next_review_date?: string;
  residual_likelihood?: number;
  residual_impact?: number;
  residual_risk_score?: number;
  notes?: string;
  created_at: string;
}

interface RiskRegisterViewProps {
  projectId: string;
}

const likelihoodScale = {
  1: "Rare",
  2: "Unlikely", 
  3: "Possible",
  4: "Likely",
  5: "Almost Certain"
};

const impactScale = {
  1: "Negligible",
  2: "Minor",
  3: "Moderate", 
  4: "Major",
  5: "Severe"
};

const categories = ["Schedule", "Financial", "Technical", "Resource", "Quality", "External", "Legal"];
const strategies = ["Avoid", "Mitigate", "Transfer", "Accept"];
const statuses = ["Open", "In Progress", "Closed", "Monitoring"];

export function RiskRegisterView({ projectId }: RiskRegisterViewProps) {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRisk, setEditingRisk] = useState<Risk | null>(null);
  const { user } = useApiAuth();

  const [newRisk, setNewRisk] = useState({
    risk_code: '',
    title: '',
    description: '',
    category: '',
    cause: '',
    consequence: '',
    likelihood: '',
    impact: '',
    owner: '',
    response_strategy: '',
    mitigation_plan: '',
    contingency_plan: '',
    status: 'Open',
    identified_date: new Date().toISOString().split('T')[0],
    next_review_date: '',
    residual_likelihood: '',
    residual_impact: '',
    notes: ''
  });

  useEffect(() => {
    fetchRisks();
  }, [projectId]);

  const fetchRisks = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getRisks(projectId);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch risks');
      }
      
      setRisks(response.data || []);
    } catch (error: any) {
      console.error('🔥 Full fetch risks error details:', error);
      
      // Extract detailed error message from response
      let errorMessage = "Failed to load risks";
      if (error?.response?.data) {
        const responseData = error.response.data;
        if (responseData.error) {
          errorMessage = responseData.error;
        }
        if (responseData.debug) {
          console.error('🔍 Debug details:', responseData.debug);
          errorMessage += ` (${responseData.debug.code || 'Unknown error'})`;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error loading risks",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddRisk = async () => {
    if (!newRisk.risk_code || !newRisk.title) {
      toast({
        title: "Required fields missing",
        description: "Risk code and title are required.",
        variant: "destructive",
      });
      return;
    }

    try {
      const riskData = {
        risk_code: newRisk.risk_code,
        title: newRisk.title,
        description: newRisk.description || null,
        category: newRisk.category || null,
        cause: newRisk.cause || null,
        consequence: newRisk.consequence || null,
        likelihood: newRisk.likelihood ? parseInt(newRisk.likelihood) : null,
        impact: newRisk.impact ? parseInt(newRisk.impact) : null,
        owner: newRisk.owner || null,
        response_strategy: newRisk.response_strategy || null,
        mitigation_plan: newRisk.mitigation_plan ? newRisk.mitigation_plan.split('\n').filter(p => p.trim()) : null,
        contingency_plan: newRisk.contingency_plan || null,
        status: newRisk.status,
        identified_date: newRisk.identified_date || null,
        last_updated: new Date().toISOString().split('T')[0],
        next_review_date: newRisk.next_review_date || null,
        residual_likelihood: newRisk.residual_likelihood ? parseInt(newRisk.residual_likelihood) : null,
        residual_impact: newRisk.residual_impact ? parseInt(newRisk.residual_impact) : null,
        notes: newRisk.notes || null
      };

      const response = await apiClient.createRisk(projectId, riskData);

      if (!response.success) {
        throw new Error(response.error || 'Failed to create risk');
      }

      toast({
        title: "Success",
        description: "Risk added successfully",
      });

      setIsAddDialogOpen(false);
      setNewRisk({
        risk_code: '',
        title: '',
        description: '',
        category: '',
        cause: '',
        consequence: '',
        likelihood: '',
        impact: '',
        owner: '',
        response_strategy: '',
        mitigation_plan: '',
        contingency_plan: '',
        status: 'Open',
        identified_date: new Date().toISOString().split('T')[0],
        next_review_date: '',
        residual_likelihood: '',
        residual_impact: '',
        notes: ''
      });
      
      fetchRisks();
    } catch (error: any) {
      console.error('🔥 Full add risk error details:', error);
      
      // Extract detailed error message from response
      let errorMessage = "Failed to create risk";
      if (error?.response?.data) {
        const responseData = error.response.data;
        if (responseData.error) {
          errorMessage = responseData.error;
        }
        if (responseData.debug) {
          console.error('🔍 Debug details:', responseData.debug);
          errorMessage += ` (${responseData.debug.code || 'Unknown error'})`;
          if (responseData.debug.detail) {
            errorMessage += ` - ${responseData.debug.detail}`;
          }
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error adding risk",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleDeleteRisk = async (riskId: string) => {
    try {
      const response = await apiClient.deleteRisk(projectId, riskId);

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete risk');
      }

      toast({
        title: "Success",
        description: "Risk deleted successfully",
      });

      fetchRisks();
    } catch (error: any) {
      toast({
        title: "Error deleting risk",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditRisk = (risk: Risk) => {
    setEditingRisk(risk);
    setNewRisk({
      risk_code: risk.risk_code,
      title: risk.title,
      description: risk.description || '',
      category: risk.category || '',
      cause: risk.cause || '',
      consequence: risk.consequence || '',
      likelihood: risk.likelihood?.toString() || '',
      impact: risk.impact?.toString() || '',
      owner: risk.owner || '',
      response_strategy: risk.response_strategy || '',
      mitigation_plan: risk.mitigation_plan?.join('\n') || '',
      contingency_plan: risk.contingency_plan || '',
      status: risk.status || 'Open',
      identified_date: risk.identified_date || new Date().toISOString().split('T')[0],
      next_review_date: risk.next_review_date || '',
      residual_likelihood: risk.residual_likelihood?.toString() || '',
      residual_impact: risk.residual_impact?.toString() || '',
      notes: risk.notes || ''
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateRisk = async () => {
    if (!editingRisk || !newRisk.risk_code || !newRisk.title) {
      toast({
        title: "Required fields missing",
        description: "Risk code and title are required.",
        variant: "destructive",
      });
      return;
    }

    try {
      const riskData = {
        risk_code: newRisk.risk_code,
        title: newRisk.title,
        description: newRisk.description || null,
        category: newRisk.category || null,
        cause: newRisk.cause || null,
        consequence: newRisk.consequence || null,
        likelihood: newRisk.likelihood ? parseInt(newRisk.likelihood) : null,
        impact: newRisk.impact ? parseInt(newRisk.impact) : null,
        owner: newRisk.owner || null,
        response_strategy: newRisk.response_strategy || null,
        mitigation_plan: newRisk.mitigation_plan ? newRisk.mitigation_plan.split('\n').filter(p => p.trim()) : null,
        contingency_plan: newRisk.contingency_plan || null,
        status: newRisk.status,
        identified_date: newRisk.identified_date || null,
        last_updated: new Date().toISOString().split('T')[0],
        next_review_date: newRisk.next_review_date || null,
        residual_likelihood: newRisk.residual_likelihood ? parseInt(newRisk.residual_likelihood) : null,
        residual_impact: newRisk.residual_impact ? parseInt(newRisk.residual_impact) : null,
        notes: newRisk.notes || null
      };

      const response = await apiClient.updateRisk(projectId, editingRisk.id, riskData);

      if (!response.success) {
        throw new Error(response.error || 'Failed to update risk');
      }

      toast({
        title: "Success",
        description: "Risk updated successfully",
      });

      setIsEditDialogOpen(false);
      setEditingRisk(null);
      setNewRisk({
        risk_code: '',
        title: '',
        description: '',
        category: '',
        cause: '',
        consequence: '',
        likelihood: '',
        impact: '',
        owner: '',
        response_strategy: '',
        mitigation_plan: '',
        contingency_plan: '',
        status: 'Open',
        identified_date: new Date().toISOString().split('T')[0],
        next_review_date: '',
        residual_likelihood: '',
        residual_impact: '',
        notes: ''
      });
      
      fetchRisks();
    } catch (error: any) {
      toast({
        title: "Error updating risk",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getRiskScoreColor = (score?: number) => {
    if (!score) return "bg-muted";
    if (score <= 5) return "bg-green-500";
    if (score <= 12) return "bg-yellow-500";
    if (score <= 20) return "bg-orange-500";
    return "bg-red-500";
  };

  const getRiskScoreLabel = (score?: number) => {
    if (!score) return "N/A";
    if (score <= 5) return "Low";
    if (score <= 12) return "Medium";
    if (score <= 20) return "High";
    return "Critical";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const filteredRisks = risks.filter(risk =>
    risk.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    risk.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    risk.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    risk.owner?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Risk Register</h2>
          <p className="text-muted-foreground">
            Identify, assess, and manage project risks
          </p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Risk
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto z-[9998]">
            <DialogHeader>
              <DialogTitle>Add New Risk</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 space-y-4 relative z-[9999]">
              <div className="col-span-1 space-y-2">
                <Label htmlFor="risk_code">Risk Code *</Label>
                <Input
                  id="risk_code"
                  value={newRisk.risk_code}
                  onChange={(e) => setNewRisk({ ...newRisk, risk_code: e.target.value })}
                  placeholder="R001"
                />
              </div>
              
              <div className="col-span-1 space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={newRisk.category} onValueChange={(value) => setNewRisk({ ...newRisk, category: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={newRisk.title}
                  onChange={(e) => setNewRisk({ ...newRisk, title: e.target.value })}
                  placeholder="Risk title"
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newRisk.description}
                  onChange={(e) => setNewRisk({ ...newRisk, description: e.target.value })}
                  placeholder="Risk description"
                />
              </div>

              <div className="col-span-1 space-y-2">
                <Label htmlFor="cause">Cause</Label>
                <Textarea
                  id="cause"
                  value={newRisk.cause}
                  onChange={(e) => setNewRisk({ ...newRisk, cause: e.target.value })}
                  placeholder="What causes this risk?"
                />
              </div>

              <div className="col-span-1 space-y-2">
                <Label htmlFor="consequence">Consequence</Label>
                <Textarea
                  id="consequence"
                  value={newRisk.consequence}
                  onChange={(e) => setNewRisk({ ...newRisk, consequence: e.target.value })}
                  placeholder="What happens if this risk occurs?"
                />
              </div>

              <div className="col-span-1 space-y-2">
                <Label htmlFor="likelihood">Likelihood (1-5)</Label>
                <Select value={newRisk.likelihood} onValueChange={(value) => setNewRisk({ ...newRisk, likelihood: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select likelihood" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(likelihoodScale).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{value} - {label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-1 space-y-2">
                <Label htmlFor="impact">Impact (1-5)</Label>
                <Select value={newRisk.impact} onValueChange={(value) => setNewRisk({ ...newRisk, impact: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select impact" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(impactScale).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{value} - {label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-1 space-y-2">
                <Label htmlFor="owner">Owner</Label>
                <Input
                  id="owner"
                  value={newRisk.owner}
                  onChange={(e) => setNewRisk({ ...newRisk, owner: e.target.value })}
                  placeholder="Risk owner"
                />
              </div>

              <div className="col-span-1 space-y-2">
                <Label htmlFor="response_strategy">Response Strategy</Label>
                <Select value={newRisk.response_strategy} onValueChange={(value) => setNewRisk({ ...newRisk, response_strategy: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    {strategies.map((strategy) => (
                      <SelectItem key={strategy} value={strategy}>{strategy}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="mitigation_plan">Mitigation Plan (one per line)</Label>
                <Textarea
                  id="mitigation_plan"
                  value={newRisk.mitigation_plan}
                  onChange={(e) => setNewRisk({ ...newRisk, mitigation_plan: e.target.value })}
                  placeholder="Action 1&#10;Action 2&#10;Action 3"
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="contingency_plan">Contingency Plan</Label>
                <Textarea
                  id="contingency_plan"
                  value={newRisk.contingency_plan}
                  onChange={(e) => setNewRisk({ ...newRisk, contingency_plan: e.target.value })}
                  placeholder="What to do if mitigation fails"
                />
              </div>

              <div className="col-span-1 space-y-2">
                <Label htmlFor="next_review_date">Next Review Date</Label>
                <Input
                  id="next_review_date"
                  type="date"
                  value={newRisk.next_review_date}
                  onChange={(e) => setNewRisk({ ...newRisk, next_review_date: e.target.value })}
                />
              </div>

              <div className="col-span-1 space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={newRisk.status} onValueChange={(value) => setNewRisk({ ...newRisk, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={newRisk.notes}
                  onChange={(e) => setNewRisk({ ...newRisk, notes: e.target.value })}
                  placeholder="Additional notes"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddRisk}>Add Risk</Button>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* Edit Risk Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto z-[9998]">
            <DialogHeader>
              <DialogTitle>Edit Risk</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 space-y-4 relative z-[9999]">
              <div className="col-span-1 space-y-2">
                <Label htmlFor="edit_risk_code">Risk Code *</Label>
                <Input
                  id="edit_risk_code"
                  value={newRisk.risk_code}
                  onChange={(e) => setNewRisk({ ...newRisk, risk_code: e.target.value })}
                  placeholder="R001"
                />
              </div>
              
              <div className="col-span-1 space-y-2">
                <Label htmlFor="edit_category">Category</Label>
                <Select value={newRisk.category} onValueChange={(value) => setNewRisk({ ...newRisk, category: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="edit_title">Title *</Label>
                <Input
                  id="edit_title"
                  value={newRisk.title}
                  onChange={(e) => setNewRisk({ ...newRisk, title: e.target.value })}
                  placeholder="Risk title"
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="edit_description">Description</Label>
                <Textarea
                  id="edit_description"
                  value={newRisk.description}
                  onChange={(e) => setNewRisk({ ...newRisk, description: e.target.value })}
                  placeholder="Risk description"
                />
              </div>

              <div className="col-span-1 space-y-2">
                <Label htmlFor="edit_cause">Cause</Label>
                <Textarea
                  id="edit_cause"
                  value={newRisk.cause}
                  onChange={(e) => setNewRisk({ ...newRisk, cause: e.target.value })}
                  placeholder="What causes this risk?"
                />
              </div>

              <div className="col-span-1 space-y-2">
                <Label htmlFor="edit_consequence">Consequence</Label>
                <Textarea
                  id="edit_consequence"
                  value={newRisk.consequence}
                  onChange={(e) => setNewRisk({ ...newRisk, consequence: e.target.value })}
                  placeholder="What happens if this risk occurs?"
                />
              </div>

              <div className="col-span-1 space-y-2">
                <Label htmlFor="edit_likelihood">Likelihood (1-5)</Label>
                <Select value={newRisk.likelihood} onValueChange={(value) => setNewRisk({ ...newRisk, likelihood: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select likelihood" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(likelihoodScale).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{value} - {label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-1 space-y-2">
                <Label htmlFor="edit_impact">Impact (1-5)</Label>
                <Select value={newRisk.impact} onValueChange={(value) => setNewRisk({ ...newRisk, impact: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select impact" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(impactScale).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{value} - {label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-1 space-y-2">
                <Label htmlFor="edit_owner">Owner</Label>
                <Input
                  id="edit_owner"
                  value={newRisk.owner}
                  onChange={(e) => setNewRisk({ ...newRisk, owner: e.target.value })}
                  placeholder="Risk owner"
                />
              </div>

              <div className="col-span-1 space-y-2">
                <Label htmlFor="edit_response_strategy">Response Strategy</Label>
                <Select value={newRisk.response_strategy} onValueChange={(value) => setNewRisk({ ...newRisk, response_strategy: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    {strategies.map((strategy) => (
                      <SelectItem key={strategy} value={strategy}>{strategy}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="edit_mitigation_plan">Mitigation Plan (one per line)</Label>
                <Textarea
                  id="edit_mitigation_plan"
                  value={newRisk.mitigation_plan}
                  onChange={(e) => setNewRisk({ ...newRisk, mitigation_plan: e.target.value })}
                  placeholder="Action 1&#10;Action 2&#10;Action 3"
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="edit_contingency_plan">Contingency Plan</Label>
                <Textarea
                  id="edit_contingency_plan"
                  value={newRisk.contingency_plan}
                  onChange={(e) => setNewRisk({ ...newRisk, contingency_plan: e.target.value })}
                  placeholder="What to do if mitigation fails"
                />
              </div>

              <div className="col-span-1 space-y-2">
                <Label htmlFor="edit_next_review_date">Next Review Date</Label>
                <Input
                  id="edit_next_review_date"
                  type="date"
                  value={newRisk.next_review_date}
                  onChange={(e) => setNewRisk({ ...newRisk, next_review_date: e.target.value })}
                />
              </div>

              <div className="col-span-1 space-y-2">
                <Label htmlFor="edit_status">Status</Label>
                <Select value={newRisk.status} onValueChange={(value) => setNewRisk({ ...newRisk, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="edit_notes">Notes</Label>
                <Textarea
                  id="edit_notes"
                  value={newRisk.notes}
                  onChange={(e) => setNewRisk({ ...newRisk, notes: e.target.value })}
                  placeholder="Additional notes"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateRisk}>Update Risk</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search risks..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {filteredRisks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-xl font-semibold mb-2">
              {searchTerm ? 'No risks found' : 'No Risks Identified'}
            </p>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm 
                ? 'Try adjusting your search criteria'
                : 'Start building your risk register by adding potential project risks.'
              }
            </p>
            {!searchTerm && (
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Risk
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredRisks.map((risk) => (
            <Card key={risk.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{risk.risk_code}</Badge>
                      {risk.category && (
                        <Badge variant="secondary">{risk.category}</Badge>
                      )}
                      <Badge 
                        className={`text-white ${getRiskScoreColor(risk.risk_score)}`}
                      >
                        {getRiskScoreLabel(risk.risk_score)} ({risk.risk_score || 'N/A'})
                      </Badge>
                      <Badge variant={risk.status === 'Open' ? 'destructive' : 
                                     risk.status === 'Closed' ? 'default' : 'secondary'}>
                        {risk.status}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg">{risk.title}</CardTitle>
                    {risk.description && (
                      <p className="text-muted-foreground mt-2">{risk.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleEditRisk(risk)}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Risk</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete risk "{risk.risk_code} - {risk.title}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>No, Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDeleteRisk(risk.id)}
                            className="bg-red-500 hover:bg-red-600"
                          >
                            Yes, Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  {risk.cause && (
                    <div>
                      <p className="font-medium text-muted-foreground">Cause</p>
                      <p>{risk.cause}</p>
                    </div>
                  )}
                  {risk.consequence && (
                    <div>
                      <p className="font-medium text-muted-foreground">Consequence</p>
                      <p>{risk.consequence}</p>
                    </div>
                  )}
                  {(risk.likelihood || risk.impact) && (
                    <div>
                      <p className="font-medium text-muted-foreground">Assessment</p>
                      <p>
                        {risk.likelihood && `Likelihood: ${risk.likelihood} (${likelihoodScale[risk.likelihood as keyof typeof likelihoodScale]})`}
                        {risk.likelihood && risk.impact && <br />}
                        {risk.impact && `Impact: ${risk.impact} (${impactScale[risk.impact as keyof typeof impactScale]})`}
                      </p>
                    </div>
                  )}
                  {risk.owner && (
                    <div>
                      <p className="font-medium text-muted-foreground">Owner</p>
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>{risk.owner}</span>
                      </div>
                    </div>
                  )}
                  {risk.response_strategy && (
                    <div>
                      <p className="font-medium text-muted-foreground">Strategy</p>
                      <p>{risk.response_strategy}</p>
                    </div>
                  )}
                  {risk.next_review_date && (
                    <div>
                      <p className="font-medium text-muted-foreground">Next Review</p>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(risk.next_review_date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  )}
                </div>
                
                {risk.mitigation_plan && risk.mitigation_plan.length > 0 && (
                  <div className="mt-4">
                    <p className="font-medium text-muted-foreground mb-2">Mitigation Plan</p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {risk.mitigation_plan.map((action, index) => (
                        <li key={index}>{action}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {risk.contingency_plan && (
                  <div className="mt-4">
                    <p className="font-medium text-muted-foreground mb-2">Contingency Plan</p>
                    <p className="text-sm">{risk.contingency_plan}</p>
                  </div>
                )}
                
                {risk.notes && (
                  <div className="mt-4">
                    <p className="font-medium text-muted-foreground mb-2">Notes</p>
                    <p className="text-sm italic">{risk.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}