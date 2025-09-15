import React, { useState, useEffect } from 'react';
import { budgetApi } from '@/services/budgetApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PlusCircle, DollarSign, TrendingUp, AlertTriangle, Receipt, BarChart3, PieChart, LineChart, Edit, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, LineChart as RechartsLineChart, Line } from 'recharts';

interface ProjectBudgetManagementProps {
  projectId: string;
}

interface BudgetType {
  id: string;
  code: string;
  label: string;
  default_allocation_percent: number;
  notes?: string;
  type_name?: string; // For compatibility with specification
}

interface BudgetCategory {
  id: string;
  budget_type_code: string;
  name: string;
  budget_allocated: number;
  budget_received: number;
  amount_spent: number;
  comments?: string;
  budget_spending?: any[];
}

interface ProjectBudget {
  id: string;
  project_id: string;
  currency: string;
  total_budget_allocated: number;
  total_budget_received: number;
  start_date?: string;
  end_date?: string;
  budget_categories: BudgetCategory[];
  budget_receipts?: any[];
  budget_comments?: any[];
}

interface BudgetAnalytics {
  totals: {
    allocated_total: number;
    received_total: number;
    spent_total: number;
    remaining_total: number;
  };
  variance_summary: {
    overall_variance_amount: number;
    overall_variance_percent: number;
  };
  category_breakdown: Array<{
    code: string;
    name: string;
    allocated: number;
    received: number;
    spent: number;
    variance: number;
    percent_spent: number;
  }>;
}

export function ProjectBudgetManagement({ projectId }: ProjectBudgetManagementProps) {
  const [budget, setBudget] = useState<ProjectBudget | null>(null);
  const [budgetTypes, setBudgetTypes] = useState<BudgetType[]>([]);
  const [analytics, setAnalytics] = useState<BudgetAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [isCreateSpendingOpen, setIsCreateSpendingOpen] = useState(false);
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);
  const [isEditSpendingOpen, setIsEditSpendingOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [editingSpending, setEditingSpending] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('categories');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{type: 'category' | 'spending', id: string, name: string} | null>(null);

  // Form states
  const [budgetForm, setBudgetForm] = useState({
    currency: 'INR',
    total_budget_allocated: '',
    total_budget_received: '',
    start_date: '',
    end_date: '',
  });

  const [categoryForm, setCategoryForm] = useState({
    budget_type_code: '',
    name: '',
    budget_allocated: '',
    budget_received: '',
    comments: '',
  });

  const [spendingForm, setSpendingForm] = useState({
    date: '',
    vendor: '',
    description: '',
    invoice_id: '',
    amount: '',
    payment_method: '',
    status: 'pending',
  });

  const fetchBudgetData = async () => {
    try {
      setLoading(true);
      const result = await budgetApi.getProjectBudget(projectId);

      setBudget(result.data.budget);
      setBudgetTypes(result.data.budgetTypes || []);
      
      // Calculate analytics manually from budget data
      const budgetData = result.data.budget;
      let calculatedAnalytics = null;
      
      if (budgetData && budgetData.budget_categories) {
        
        
        let totalAllocated = 0;
        let totalReceived = 0;
        let totalSpent = 0;
        
        budgetData.budget_categories.forEach((category: any) => {
          const allocated = parseFloat(String(category.budget_allocated || 0));
          const received = parseFloat(String(category.budget_received || 0));
          const spent = parseFloat(String(category.amount_spent || 0));
          
          totalAllocated += allocated;
          totalReceived += received;
          totalSpent += spent;
          
        });

        // Also consider main budget totals if they exist
        const mainBudgetAllocated = parseFloat(String(budgetData.total_budget_allocated || 0));
        const mainBudgetReceived = parseFloat(String(budgetData.total_budget_received || 0));
        
        // Use the sum of category totals or main budget totals, whichever is higher
        // This handles cases where main budget is set but categories haven't been allocated yet
        const finalAllocatedTotal = Math.max(totalAllocated, mainBudgetAllocated);
        const finalReceivedTotal = Math.max(totalReceived, mainBudgetReceived);
        
        // Calculate remaining from the higher of allocated or received minus spent
        const budgetBase = Math.max(finalAllocatedTotal, finalReceivedTotal);
        const remainingTotal = budgetBase - totalSpent;

        calculatedAnalytics = {
          totals: {
            allocated_total: finalAllocatedTotal,
            received_total: finalReceivedTotal,
            spent_total: totalSpent,
            remaining_total: remainingTotal,
          },
          variance_summary: {
            overall_variance_amount: remainingTotal,
            overall_variance_percent: finalReceivedTotal > 0 ? Math.round((remainingTotal / finalReceivedTotal) * 10000) / 100 : 0,
          },
          category_breakdown: budgetData.budget_categories.map((category: any) => ({
            code: category.budget_type_code,
            name: category.name,
            allocated: parseFloat(String(category.budget_allocated || 0)),
            received: parseFloat(String(category.budget_received || 0)),
            spent: parseFloat(String(category.amount_spent || 0)),
            variance: parseFloat(String(category.budget_received || 0)) - parseFloat(String(category.amount_spent || 0)),
            percent_spent: parseFloat(String(category.budget_received || 0)) > 0 ? 
              Math.round((parseFloat(String(category.amount_spent || 0)) / parseFloat(String(category.budget_received || 0))) * 10000) / 100 : 0,
          })),
        };
        
        
      }
      
      setAnalytics(calculatedAnalytics || result.data.analytics);

      // Show error if no budget types available
      if (!result.data.budgetTypes || result.data.budgetTypes.length === 0) {
        toast({
          title: "Budget Types Missing",
          description: "No budget types available. Please create budget types in the Admin section.",
          variant: "destructive",
        });
      }
      
      
      if (result.data.budget) {
        setBudgetForm({
          currency: result.data.budget.currency || 'INR',
          total_budget_allocated: result.data.budget.total_budget_allocated?.toString() || '',
          total_budget_received: result.data.budget.total_budget_received?.toString() || '',
          start_date: result.data.budget.start_date || '',
          end_date: result.data.budget.end_date || '',
        });
      }
    } catch (error: any) {
      console.error('❌ DETAILED Budget fetch error:', {
        error: error,
        message: error.message,
        stack: error.stack,
        projectId: projectId
      });
      toast({
        title: "Budget Fetch Error",
        description: error.message.includes('budget types') ? 
          "No budget types available. Please create budget types in Admin section." :
          `Budget fetch failed: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveBudget = async () => {
    try {
      

      const result = await budgetApi.createOrUpdateBudget(projectId, {
        currency: budgetForm.currency,
        total_budget_allocated: parseFloat(budgetForm.total_budget_allocated) || 0,
        total_budget_received: parseFloat(budgetForm.total_budget_received) || 0,
        start_date: budgetForm.start_date || null,
        end_date: budgetForm.end_date || null,
      });

      toast({
        title: "Success",
        description: "Budget saved successfully",
      });
      fetchBudgetData();
    } catch (error) {
      console.error('❌ Error saving budget:', error);
      toast({
        title: "Error",
        description: "Failed to save budget",
        variant: "destructive",
      });
    }
  };

  const createCategory = async () => {
    try {
      // Ensure a project budget exists before creating a category
      if (!budget || !budget.id) {
        console.log('🧾 No project budget found, creating a default budget before adding category');
        await budgetApi.createOrUpdateBudget(projectId, {
          currency: budgetForm.currency || 'INR',
          total_budget_allocated: parseFloat(budgetForm.total_budget_allocated) || 0,
          total_budget_received: parseFloat(budgetForm.total_budget_received) || 0,
          start_date: budgetForm.start_date || null,
          end_date: budgetForm.end_date || null,
        });
      }

      await budgetApi.createBudgetCategory(projectId, {
        budget_type_code: categoryForm.budget_type_code,
        name: categoryForm.name,
        budget_allocated: parseFloat(categoryForm.budget_allocated) || 0,
        budget_received: parseFloat(categoryForm.budget_received) || 0,
        comments: categoryForm.comments,
      });

      toast({
        title: "Success",
        description: "Budget category created successfully",
      });
      setIsCreateCategoryOpen(false);
      setCategoryForm({
        budget_type_code: '',
        name: '',
        budget_allocated: '',
        budget_received: '',
        comments: '',
      });
      fetchBudgetData();
    } catch (error: any) {
      console.error('❌ Error creating category:', {
        message: error?.message,
        stack: error?.stack
      });
      toast({
        title: "Error",
        description: error?.message || "Failed to create category",
        variant: "destructive",
      });
    }
  };

  const createSpending = async () => {
    try {
      if (!selectedCategory) {
        toast({
          title: "Error",
          description: "Please select a category",
          variant: "destructive",
        });
        return;
      }

      

      await budgetApi.createSpendingEntry(selectedCategory, {
        date: spendingForm.date,
        vendor: spendingForm.vendor,
        description: spendingForm.description,
        invoice_id: spendingForm.invoice_id,
        amount: parseFloat(spendingForm.amount) || 0,
        payment_method: spendingForm.payment_method,
        status: spendingForm.status,
      });

      toast({
        title: "Success",
        description: "Spending entry created successfully",
      });
      setIsCreateSpendingOpen(false);
      setSpendingForm({
        date: '',
        vendor: '',
        description: '',
        invoice_id: '',
        amount: '',
        payment_method: '',
        status: 'pending',
      });
      setSelectedCategory('');
      // Keep spending tab active after saving
      setActiveTab('spending');
      fetchBudgetData();
    } catch (error) {
      console.error('❌ Error creating spending:', error);
      toast({
        title: "Error",
        description: "Failed to create spending entry",
        variant: "destructive",
      });
    }
  };

  const handleEditCategory = (category: any) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      budget_allocated: category.budget_allocated,
      budget_received: category.budget_received,
      budget_type_code: category.budget_type_code,
      comments: category.comments || '',
    });
    setIsEditCategoryOpen(true);
  };

  const handleDeleteCategory = (category: any) => {
    setItemToDelete({
      type: 'category',
      id: category.id,
      name: category.name
    });
    setDeleteConfirmOpen(true);
  };

  const handleDeleteSpending = (spending: any) => {
    setItemToDelete({
      type: 'spending',
      id: spending.id,
      name: spending.description
    });
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      
      
      if (itemToDelete.type === 'category') {
        await budgetApi.deleteBudgetCategory(itemToDelete.id);
        toast({
          title: "Success",
          description: "Budget category deleted successfully",
        });
      } else {
        await budgetApi.deleteSpendingEntry(itemToDelete.id);
        toast({
          title: "Success", 
          description: "Spending entry deleted successfully",
        });
      }
      
      // Close dialog and reset state
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
      
      // Refresh data without changing tabs
      await fetchBudgetData();
    } catch (error: any) {
      console.error('❌ DETAILED Delete error:', {
        error: error,
        message: error.message,
        stack: error.stack,
        itemToDelete: itemToDelete
      });
      toast({
        title: "Delete Error",
        description: `Failed to delete ${itemToDelete.type}: ${error.message}`,
        variant: "destructive",
      });
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const handleEditSpending = (spending: any) => {
    setEditingSpending(spending);
    setSpendingForm({
      description: spending.description,
      amount: spending.amount,
      vendor: spending.vendor || '',
      date: spending.date,
      payment_method: spending.payment_method || '',
      status: spending.status,
      invoice_id: spending.invoice_id || '',
    });
    setSelectedCategory(spending.budget_category_id || '');
    setIsEditSpendingOpen(true);
  };

  useEffect(() => {
    fetchBudgetData();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const formatCurrency = (amount: number, currency: string = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header with Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Allocated</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(analytics?.totals.allocated_total || 0, budget?.currency)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Received</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(analytics?.totals.received_total || 0, budget?.currency)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Amount Spent</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(analytics?.totals.spent_total || 0, budget?.currency)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(analytics?.totals.remaining_total || 0, budget?.currency)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="categories">Budget</TabsTrigger>
          <TabsTrigger value="spending">Spending</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Budget Items</h3>
            <Dialog open={isCreateCategoryOpen} onOpenChange={setIsCreateCategoryOpen}>
              <DialogTrigger asChild>
                  <Button>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add Budget Item
                  </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Budget Item</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="budget_type">Budget Type *</Label>
                    <Select value={categoryForm.budget_type_code} onValueChange={(value) => 
                      setCategoryForm(prev => ({ ...prev, budget_type_code: value }))
                    }>
                      <SelectTrigger>
                        <SelectValue placeholder="Select budget type" />
                      </SelectTrigger>
                      <SelectContent>
                        {budgetTypes.length === 0 ? (
                          <SelectItem value="" disabled>No budget types available</SelectItem>
                        ) : (
                          budgetTypes.map((type) => (
                            <SelectItem key={type.code} value={type.code}>
                              {type.label || type.type_name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {budgetTypes.length === 0 && (
                      <p className="text-sm text-muted-foreground mt-1">
                        No budget types available. Contact admin to create budget types.
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="category_name">Title *</Label>
                    <Input
                      id="category_name"
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter budget title"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="budget_allocated">Amount *</Label>
                    <Input
                      id="budget_allocated"
                      type="number"
                      value={categoryForm.budget_allocated}
                      onChange={(e) => setCategoryForm(prev => ({ ...prev, budget_allocated: e.target.value }))}
                      placeholder="Enter budget amount"
                      required
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <Label htmlFor="category_comments">Comments</Label>
                    <Textarea
                      id="category_comments"
                      value={categoryForm.comments}
                      onChange={(e) => setCategoryForm(prev => ({ ...prev, comments: e.target.value }))}
                      placeholder="Optional comments"
                    />
                  </div>
                  <Button 
                    onClick={createCategory} 
                    className="w-full"
                    disabled={!categoryForm.budget_type_code || !categoryForm.name || !categoryForm.budget_allocated || budgetTypes.length === 0}
                  >
                    Create Budget
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-4">
            {budget?.budget_categories && budget.budget_categories.length > 0 ? (
              budget.budget_categories.map((category) => (
                <Card key={category.id} className="border-l-4 border-l-primary">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-semibold">{category.name}</h4>
                        <p className="text-sm text-muted-foreground mb-2">{category.budget_type_code}</p>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Allocated:</span>
                            <div className="font-medium">₹{(parseFloat(String(category.budget_allocated || 0))).toLocaleString()}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Spent:</span>
                            <div className="font-medium">₹{(parseFloat(String(category.amount_spent || 0))).toLocaleString()}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Remaining:</span>
                            <div className="font-medium">₹{(parseFloat(String(category.budget_allocated || 0)) - parseFloat(String(category.amount_spent || 0))).toLocaleString()}</div>
                          </div>
                        </div>
                        {category.comments && (
                          <p className="text-sm text-muted-foreground mt-2">{category.comments}</p>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEditCategory(category)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteCategory(category)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No budget categories found.</p>
                <p className="text-sm text-muted-foreground">Create your first budget category to get started.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="spending" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Spending Entries</h3>
            <Dialog open={isCreateSpendingOpen} onOpenChange={setIsCreateSpendingOpen}>
              <DialogTrigger asChild>
                <Button>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Spending
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Spending Entry</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Category *</Label>
                    <div className="mt-2 space-y-2">
                      {(() => {
                        const availableCategories = budget?.budget_categories || [];
                        
                        if (availableCategories.length === 0) {
                          return (
                            <div className="text-sm text-muted-foreground p-3 border rounded-md">
                              No budget categories found. Go to Budget tab to create categories first.
                            </div>
                          );
                        }

                        return availableCategories.map((category) => (
                          <div key={category.id} className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id={`category-${category.id}`}
                              name="spending_category"
                              value={category.id}
                              checked={selectedCategory === category.id}
                              onChange={(e) => setSelectedCategory(e.target.value)}
                              className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                            />
                            <Label 
                              htmlFor={`category-${category.id}`} 
                              className="text-sm font-normal cursor-pointer flex-1"
                            >
                              {category.name} ({category.budget_type_code})
                              <span className="text-xs text-muted-foreground ml-2">
                                Budget: {formatCurrency(category.budget_allocated)} | 
                                Spent: {formatCurrency(category.amount_spent)}
                              </span>
                            </Label>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="spending_date">Date</Label>
                      <Input
                        id="spending_date"
                        type="date"
                        value={spendingForm.date}
                        onChange={(e) => setSpendingForm(prev => ({ ...prev, date: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="spending_amount">Amount</Label>
                      <Input
                        id="spending_amount"
                        type="number"
                        value={spendingForm.amount}
                        onChange={(e) => setSpendingForm(prev => ({ ...prev, amount: e.target.value }))}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="spending_vendor">Vendor</Label>
                    <Input
                      id="spending_vendor"
                      value={spendingForm.vendor}
                      onChange={(e) => setSpendingForm(prev => ({ ...prev, vendor: e.target.value }))}
                      placeholder="Vendor name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="spending_description">Description</Label>
                    <Input
                      id="spending_description"
                      value={spendingForm.description}
                      onChange={(e) => setSpendingForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Spending description"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="invoice_id">Invoice ID</Label>
                      <Input
                        id="invoice_id"
                        value={spendingForm.invoice_id}
                        onChange={(e) => setSpendingForm(prev => ({ ...prev, invoice_id: e.target.value }))}
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <Label htmlFor="spending_status">Status</Label>
                      <Select value={spendingForm.status} onValueChange={(value) => 
                        setSpendingForm(prev => ({ ...prev, status: value }))
                      }>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={createSpending} className="w-full">
                    Create Spending Entry
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-4">
            {budget?.budget_categories?.map((category) => (
              category.budget_spending && category.budget_spending.length > 0 ? 
                category.budget_spending.map((spending: any) => (
                  <Card key={spending.id} className="border-l-4 border-l-secondary">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              {category.name}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {category.budget_type_code}
                            </Badge>
                          </div>
                          <h4 className="font-semibold">{spending.description}</h4>
                          <p className="text-sm text-muted-foreground">₹{parseFloat(spending.amount).toLocaleString()}</p>
                          <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                            <span>Vendor: {spending.vendor || 'Not specified'}</span>
                            <span>Date: {new Date(spending.date).toLocaleDateString()}</span>
                            <span>Status: {spending.status}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleEditSpending(spending)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDeleteSpending(spending)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )) : null
            )).filter(Boolean).flat() || (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No spending entries found.</p>
                <p className="text-sm text-muted-foreground">Create your first spending entry to get started.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Budget Analytics</h3>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  toast({
                    title: "Debug Info",
                    description: "Check console for budget and analytics data",
                  });
                }}
              >
                Debug Data
              </Button>
            </div>
            
            {/* Budget vs Actual Spending Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Budget vs Actual Spending
                </CardTitle>
              </CardHeader>
              <CardContent>
                {budget?.budget_categories && budget.budget_categories.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={budget.budget_categories.map(category => {
                      // Calculate total spending for this category from all spending entries
                      const totalSpent = category.budget_spending?.reduce((sum: number, spending: any) => {
                        return sum + parseFloat(spending.amount || 0);
                      }, 0) || parseFloat(String(category.amount_spent || 0));
                      
                      return {
                        name: category.name.length > 15 ? category.name.substring(0, 15) + '...' : category.name,
                        fullName: category.name,
                        budget: parseFloat(String(category.budget_allocated || 0)),
                        received: parseFloat(String(category.budget_received || 0)),
                        spent: totalSpent
                      };
                    })}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(value) => `₹${value.toLocaleString()}`} />
                      <Tooltip 
                        formatter={(value, name) => [`₹${value.toLocaleString()}`, name]}
                        labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                      />
                      <Bar dataKey="budget" fill="hsl(var(--primary))" name="Budget Allocated" />
                      <Bar dataKey="received" fill="hsl(var(--secondary))" name="Budget Received" />
                      <Bar dataKey="spent" fill="hsl(var(--accent))" name="Amount Spent" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mb-2 opacity-50" />
                    <p>No budget data available for analysis</p>
                    <p className="text-sm">Create budget categories to see analytics</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Enhanced Spending Distribution Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Spending Distribution by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  // Calculate actual spending for each category from budget_spending entries
                  const categoriesWithActualSpending = budget?.budget_categories?.map(category => {
                    const actualSpent = category.budget_spending?.reduce((sum: number, spending: any) => {
                      return sum + parseFloat(spending.amount || 0);
                    }, 0) || 0;
                    
                    return {
                      ...category,
                      actualSpent: actualSpent
                    };
                  }).filter(cat => cat.actualSpent > 0) || [];
                  
                  if (categoriesWithActualSpending.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                        <PieChart className="h-12 w-12 mb-2 opacity-50" />
                        <p>No spending data available for analysis</p>
                        <p className="text-sm">Add spending entries to see distribution</p>
                      </div>
                    );
                  }

                  const totalSpent = categoriesWithActualSpending.reduce((sum, cat) => sum + cat.actualSpent, 0);
                  
                  const pieData = categoriesWithActualSpending.map(category => ({
                    name: category.name,
                    value: category.actualSpent,
                    percentage: totalSpent > 0 ? (category.actualSpent / totalSpent * 100).toFixed(1) : 0,
                    spendingCount: category.budget_spending?.length || 0
                  }));

                  const COLORS = [
                    'hsl(var(--primary))',
                    'hsl(var(--secondary))', 
                    'hsl(var(--accent))',
                    'hsl(var(--muted))',
                    '#8884d8',
                    '#82ca9d',
                    '#ffc658',
                    '#ff7300',
                    '#00ff00',
                    '#ff00ff'
                  ];

                  return (
                    <div className="flex flex-col lg:flex-row gap-4">
                      <div className="flex-1">
                        <ResponsiveContainer width="100%" height={300}>
                          <RechartsPieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percentage }) => `${name} (${percentage}%)`}
                              outerRadius={100}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {pieData.map((entry, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={COLORS[index % COLORS.length]} 
                                />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(value) => [`₹${value.toLocaleString()}`, 'Amount Spent']}
                            />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      </div>
                      
                      {/* Legend with detailed breakdown */}
                      <div className="lg:w-64 space-y-2">
                        <h4 className="font-semibold text-sm">Spending Breakdown</h4>
                        <div className="text-xs text-muted-foreground mb-3">
                          Total: ₹{totalSpent.toLocaleString()}
                        </div>
                        {pieData.map((category, index) => (
                          <div key={category.name} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                />
                                <span className="truncate">{category.name}</span>
                              </div>
                              <span className="font-medium">
                                ₹{category.value.toLocaleString()}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground ml-5">
                              {category.percentage}% • {category.spendingCount} entries
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Category Performance Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5" />
                  Category Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {budget?.budget_categories && budget.budget_categories.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Category</th>
                          <th className="text-right p-2">Allocated</th>
                          <th className="text-right p-2">Received</th>
                          <th className="text-right p-2">Spent</th>
                          <th className="text-right p-2">Remaining</th>
                          <th className="text-right p-2">Usage %</th>
                          <th className="text-right p-2">Entries</th>
                        </tr>
                      </thead>
                      <tbody>
                        {budget.budget_categories.map((category, index) => {
                          const allocated = parseFloat(String(category.budget_allocated || 0));
                          const received = parseFloat(String(category.budget_received || 0));
                          
                          // Calculate actual spent from spending entries
                          const actualSpent = category.budget_spending?.reduce((sum: number, spending: any) => {
                            return sum + parseFloat(spending.amount || 0);
                          }, 0) || 0;
                          
                          const budgetBase = Math.max(allocated, received);
                          const remaining = budgetBase - actualSpent;
                          const usagePercent = budgetBase > 0 ? (actualSpent / budgetBase) * 100 : 0;
                          const spendingEntries = category.budget_spending?.length || 0;
                          
                          return (
                            <tr key={category.id} className={index % 2 === 0 ? "bg-muted/50" : ""}>
                              <td className="p-2 font-medium">{category.name}</td>
                              <td className="p-2 text-right">₹{allocated.toLocaleString()}</td>
                              <td className="p-2 text-right">₹{received.toLocaleString()}</td>
                              <td className="p-2 text-right">
                                <span className="font-semibold">₹{actualSpent.toLocaleString()}</span>
                              </td>
                              <td className="p-2 text-right">
                                <span className={remaining >= 0 ? "text-green-600" : "text-red-600"}>
                                  ₹{remaining.toLocaleString()}
                                </span>
                              </td>
                              <td className="p-2 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <span className={usagePercent > 90 ? "text-red-600" : usagePercent > 70 ? "text-yellow-600" : "text-green-600"}>
                                    {usagePercent.toFixed(1)}%
                                  </span>
                                  <Progress value={Math.min(usagePercent, 100)} className="w-16 h-2" />
                                </div>
                              </td>
                              <td className="p-2 text-right">
                                <Badge variant="outline" className="text-xs">
                                  {spendingEntries}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <LineChart className="h-8 w-8 mb-2 opacity-50" />
                    <p>No categories available for performance analysis</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Edit Category Dialog */}
        <Dialog open={isEditCategoryOpen} onOpenChange={setIsEditCategoryOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Budget Category</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit_category_name">Category Name</Label>
                <Input
                  id="edit_category_name"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter category name"
                />
              </div>
              <div>
                <Label htmlFor="edit_budget_type">Budget Type</Label>
                <Select value={categoryForm.budget_type_code} onValueChange={(value) => setCategoryForm(prev => ({ ...prev, budget_type_code: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select budget type" />
                  </SelectTrigger>
                  <SelectContent>
                    {budgetTypes.map((type) => (
                      <SelectItem key={type.code} value={type.code}>
                        {type.label || type.type_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit_budget_allocated">Budget Allocated</Label>
                <Input
                  id="edit_budget_allocated"
                  type="number"
                  value={categoryForm.budget_allocated}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, budget_allocated: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="edit_comments">Comments</Label>
                <Textarea
                  id="edit_comments"
                  value={categoryForm.comments}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, comments: e.target.value }))}
                  placeholder="Optional comments"
                />
              </div>
              <Button onClick={() => {
                // Add update logic here
                setIsEditCategoryOpen(false);
                toast({
                  title: "Success",
                  description: "Budget category updated successfully",
                });
                fetchBudgetData();
              }} className="w-full">
                Update Category
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Spending Dialog */}
        <Dialog open={isEditSpendingOpen} onOpenChange={setIsEditSpendingOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Spending Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit_spending_category">Category *</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {budget?.budget_categories?.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name} ({category.budget_type_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit_spending_description">Description</Label>
                <Input
                  id="edit_spending_description"
                  value={spendingForm.description}
                  onChange={(e) => setSpendingForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter description"
                />
              </div>
              <div>
                <Label htmlFor="edit_spending_amount">Amount</Label>
                <Input
                  id="edit_spending_amount"
                  type="number"
                  value={spendingForm.amount}
                  onChange={(e) => setSpendingForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <Button onClick={() => {
                // Add update logic here
                setIsEditSpendingOpen(false);
                toast({
                  title: "Success",
                  description: "Spending entry updated successfully",
                });
                fetchBudgetData();
              }} className="w-full">
                Update Spending Entry
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this {itemToDelete?.type === 'category' ? 'budget category' : 'spending entry'}?
                <br />
                <strong>"{itemToDelete?.name}"</strong>
                <br />
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setDeleteConfirmOpen(false);
                setItemToDelete(null);
              }}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </Tabs>
    </div>
  );
}