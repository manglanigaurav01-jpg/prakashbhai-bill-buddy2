import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, User } from "lucide-react";
import { getCustomers, saveCustomer, updateCustomer } from "@/lib/storage";
import { Customer } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { hapticSuccess, hapticError } from '@/lib/haptics';
import { SwipeableItem } from "@/components/SwipeableItem";

interface CustomersProps {
  onNavigate: (view: 'create-bill' | 'customers' | 'balance' | 'dashboard') => void;
}

export const Customers = ({ onNavigate }: CustomersProps) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editedCustomerName, setEditedCustomerName] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    setCustomers(getCustomers());
  }, []);

  const handleAddCustomer = () => {
    if (!newCustomerName.trim()) {
      toast({
        title: "Invalid Customer Name",
        description: "Please enter a customer name",
        variant: "destructive",
      });
      return;
    }

    try {
      const customer = saveCustomer({ 
        name: newCustomerName.trim()
      });
      setCustomers([...customers, customer]);
      setNewCustomerName("");
      hapticSuccess();
      toast({
        title: "Customer Added",
        description: `${customer.name} has been added successfully`,
      });
    } catch (error: any) {
      hapticError();
      if (error && error.message === 'DUPLICATE_CUSTOMER_NAME') {
        toast({
          title: "A customer with this name already exists",
          description: "Please use a different name",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to add customer",
          variant: "destructive",
        });
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddCustomer();
    }
  };

  const openEditDialog = (customer: Customer) => {
    setEditingCustomer(customer);
    setEditedCustomerName(customer.name);
  };

  const handleUpdateCustomer = () => {
    if (!editingCustomer) return;

    if (!editedCustomerName.trim()) {
      toast({
        title: "Invalid Customer Name",
        description: "Please enter a customer name",
        variant: "destructive",
      });
      return;
    }

    try {
      const updatedCustomer = updateCustomer(editingCustomer.id, {
        name: editedCustomerName,
      });

      if (!updatedCustomer) {
        throw new Error("CUSTOMER_NOT_FOUND");
      }

      setCustomers(currentCustomers =>
        currentCustomers.map(customer =>
          customer.id === editingCustomer.id ? updatedCustomer : customer
        )
      );
      setEditingCustomer(null);
      setEditedCustomerName("");
      hapticSuccess();
      toast({
        title: "Customer Updated",
        description: `${updatedCustomer.name} has been updated successfully`,
      });
    } catch (error: any) {
      hapticError();
      if (error?.message === 'DUPLICATE_CUSTOMER_NAME') {
        toast({
          title: "A customer with this name already exists",
          description: "Please use a different name",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to update customer",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={() => onNavigate('dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Customer Management</h1>
        </div>

        <div className="space-y-6">
          {/* Add Customer Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Add New Customer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="customerName">Customer Name</Label>
                  <Input
                    id="customerName"
                    placeholder="Enter customer name"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="mt-1"
                  />
                </div>

                <Button onClick={handleAddCustomer} disabled={!newCustomerName.trim()} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Customer
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Customer List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Customer List ({customers.length})
              </CardTitle>
              <p className="text-sm text-muted-foreground">Swipe left on a customer to edit the name.</p>
            </CardHeader>
            <CardContent>
              {customers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No customers added yet</p>
                  <p className="text-sm">Add your first customer above</p>
                </div>
              ) : (
                <div
                  className="overflow-y-auto overscroll-contain pr-1"
                  style={{ maxHeight: 'min(65vh, 720px)' }}
                >
                  <div className="space-y-2">
                    {customers.map((customer, idx) => (
                      <SwipeableItem
                        key={customer.id}
                        onSwipeLeft={() => openEditDialog(customer)}
                      >
                        <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors bg-card min-h-[72px]">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-sm font-medium text-primary">{idx + 1}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium break-words">{customer.name}</p>
                              <p className="text-sm text-muted-foreground">Added on {new Date(customer.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </div>
                      </SwipeableItem>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!editingCustomer} onOpenChange={(open) => {
        if (!open) {
          setEditingCustomer(null);
          setEditedCustomerName("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Customer Name</DialogTitle>
            <DialogDescription>
              Update the customer name. The app will now keep the same capital and small letters exactly as you type them.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="editCustomerName">Customer Name</Label>
            <Input
              id="editCustomerName"
              placeholder="Enter customer name"
              value={editedCustomerName}
              onChange={(e) => setEditedCustomerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleUpdateCustomer();
                }
              }}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingCustomer(null);
                setEditedCustomerName("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateCustomer} disabled={!editedCustomerName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
