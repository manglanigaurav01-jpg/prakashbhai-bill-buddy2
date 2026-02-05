import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, User, DollarSign } from "lucide-react";
import { getCustomers, saveCustomer, updateCustomer } from "@/lib/storage";
import { Customer } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { hapticSuccess, hapticError, hapticMedium } from '@/lib/haptics';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface CustomersProps {
  onNavigate: (view: 'create-bill' | 'customers' | 'balance' | 'dashboard') => void;
}

export const Customers = ({ onNavigate }: CustomersProps) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [startIdx, setStartIdx] = useState(0);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [balanceDialog, setBalanceDialog] = useState<{ show: boolean; customer: Customer | null }>({ show: false, customer: null });
  const [balanceAmount, setBalanceAmount] = useState("");
  const { toast } = useToast();

  // Track swipe state per customer
  const swipeState = useRef<{ [key: string]: { startX: number; startY: number; isSwiping: boolean } }>({});

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

  const handleTouchStart = (e: React.TouchEvent, customer: Customer) => {
    // Only allow swipe if balance is not set
    if (customer.balance !== undefined && customer.balance !== null) {
      return;
    }

    const touch = e.touches[0];
    swipeState.current[customer.id] = {
      startX: touch.clientX,
      startY: touch.clientY,
      isSwiping: false
    };
  };

  const handleTouchMove = (e: React.TouchEvent, customer: Customer) => {
    const state = swipeState.current[customer.id];
    if (!state) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - state.startX;
    const deltaY = touch.clientY - state.startY;

    // Check if horizontal swipe (more horizontal than vertical)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      state.isSwiping = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent, customer: Customer) => {
    const state = swipeState.current[customer.id];
    if (!state) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - state.startX;

    // Right swipe detection (swipe from left to right)
    if (state.isSwiping && deltaX > 100) {
      hapticMedium();
      setBalanceDialog({ show: true, customer });
    }

    // Clean up
    delete swipeState.current[customer.id];
  };

  const handleSaveBalance = () => {
    if (!balanceDialog.customer) return;

    const amount = parseFloat(balanceAmount);
    if (isNaN(amount) || amount < 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid balance amount",
        variant: "destructive",
      });
      return;
    }

    try {
      updateCustomer(balanceDialog.customer.id, { balance: amount });
      setCustomers(customers.map(c => 
        c.id === balanceDialog.customer!.id ? { ...c, balance: amount } : c
      ));
      hapticSuccess();
      toast({
        title: "Balance Added",
        description: `Initial balance of ₹${amount.toFixed(2)} set for ${balanceDialog.customer.name}`,
      });
      setBalanceDialog({ show: false, customer: null });
      setBalanceAmount("");
    } catch (error) {
      hapticError();
      toast({
        title: "Error",
        description: "Failed to save balance",
        variant: "destructive",
      });
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
              <p className="text-sm text-muted-foreground mt-2">
                💡 Swipe right on a customer to add their initial balance (one-time only)
              </p>
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
                  ref={listRef}
                  className="overflow-auto"
                  style={{ maxHeight: '480px' }}
                  onScroll={(e) => {
                    const el = e.currentTarget as HTMLDivElement;
                    const ITEM_H = 72;
                    const newStart = Math.floor(el.scrollTop / ITEM_H);
                    setStartIdx(newStart);
                  }}
                >
                  {(() => {
                    const ITEM_H = 72;
                    const overscan = 4;
                    const total = customers.length;
                    const containerH = listRef.current ? listRef.current.getBoundingClientRect().height : 480;
                    const visible = Math.ceil(containerH / ITEM_H) + overscan * 2;
                    const rs = Math.max(0, startIdx - overscan);
                    const re = Math.min(total, rs + visible);
                    const top = rs * ITEM_H;
                    const bottom = Math.max(0, (total - re) * ITEM_H);
                    const slice = customers.slice(rs, re);
                    return (
                      <div>
                        <div style={{ height: top }} />
                        <div className="space-y-2">
                          {slice.map((customer, idx) => {
                            const hasBalance = customer.balance !== undefined && customer.balance !== null;
                            return (
                              <div
                                key={customer.id}
                                className={`flex items-center justify-between p-4 border rounded-lg transition-colors select-none ${
                                  hasBalance 
                                    ? 'bg-muted/50 cursor-default' 
                                    : 'hover:bg-muted/50 active:bg-muted cursor-pointer'
                                }`}
                                {...(!hasBalance && {
                                  onTouchStart: (e) => handleTouchStart(e, customer),
                                  onTouchMove: (e) => handleTouchMove(e, customer),
                                  onTouchEnd: (e) => handleTouchEnd(e, customer)
                                })}
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                    <span className="text-sm font-medium text-primary">{rs + idx + 1}</span>
                                  </div>
                                  <div className="flex-1">
                                    <p className="font-medium">{customer.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                      Added on {new Date(customer.createdAt).toLocaleDateString()}
                                    </p>
                                  </div>
                                  {hasBalance && (
                                    <div className="flex items-center gap-1 bg-green-500/10 text-green-600 dark:text-green-400 px-3 py-1 rounded-full">
                                      <DollarSign className="w-3 h-3" />
                                      <span className="text-sm font-medium">₹{customer.balance?.toFixed(2)}</span>
                                    </div>
                                  )}
                                  {!hasBalance && (
                                    <div className="text-xs text-muted-foreground bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2 py-1 rounded">
                                      Swipe right →
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ height: bottom }} />
                      </div>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Balance Input Dialog */}
      <Dialog open={balanceDialog.show} onOpenChange={(open) => !open && setBalanceDialog({ show: false, customer: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Initial Balance</DialogTitle>
            <DialogDescription>
              Enter the opening balance for {balanceDialog.customer?.name}. This can only be set once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="balance">Balance Amount (₹)</Label>
              <Input
                id="balance"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSaveBalance()}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBalanceDialog({ show: false, customer: null })}>
              Cancel
            </Button>
            <Button onClick={handleSaveBalance}>
              <DollarSign className="w-4 h-4 mr-2" />
              Save Balance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};