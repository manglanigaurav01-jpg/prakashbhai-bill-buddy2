import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft, DollarSign, Save, Trash2, CalendarIcon, Search, Plus } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { getCustomers, getPaymentHistory, deletePayment, saveCustomer } from "@/lib/storage";
import { Customer, Payment } from "@/types";
import { useToast } from "@/hooks/use-toast";

interface AmountTrackerProps {
  onNavigate: (view: 'create-bill' | 'customers' | 'balance' | 'amount-tracker' | 'dashboard' | 'total-business' | 'last-balance') => void;
}

export const AmountTracker = ({ onNavigate }: AmountTrackerProps) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Other'>('Cash');
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const customerList = getCustomers();
    setCustomers(customerList);
    loadPaymentHistory();
  }, []);

  const loadPaymentHistory = () => {
    const history = getPaymentHistory();
    setPaymentHistory(history);
  };

  const handleRecordPayment = async () => {
    if (!selectedCustomer || !amount) {
      toast({
        title: "Missing Information",
        description: "Please select a customer and enter an amount",
        variant: "destructive",
      });
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid positive amount",
        variant: "destructive",
      });
      return;
    }

    // Update the recordPayment function to accept a date and payment method
    const { savePayment } = await import('@/lib/storage');
    savePayment({
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      amount: amountNum,
      date: paymentDate.toISOString().split('T')[0],
      paymentMethod,
    });

    loadPaymentHistory();

    toast({
      title: "Payment Recorded",
      description: `₹${amountNum.toFixed(2)} recorded for ${selectedCustomer.name}`,
    });

    setAmount("");
  };

  const handleDeletePayment = (paymentId: string) => {
    deletePayment(paymentId);
    loadPaymentHistory();
    toast({
      title: "Payment Deleted",
      description: "Payment record has been deleted",
    });
  };

  const CustomerSearchPopover = ({
    customers,
    selectedCustomer,
    onCustomerSelect,
    onAddNew
  }: {
    customers: Customer[];
    selectedCustomer: Customer | null;
    onCustomerSelect: (customer: Customer | null) => void;
    onAddNew: () => void;
  }) => {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredCustomers = searchQuery
      ? customers.filter(customer =>
          customer.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : customers;

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              value={selectedCustomer?.name || searchQuery}
              onChange={(e) => {
                const value = e.target.value;
                setSearchQuery(value);
                if (value && !open) setOpen(true);
                // Clear selection if user is typing
                if (selectedCustomer && value !== selectedCustomer.name) {
                  onCustomerSelect(null);
                }
              }}
              placeholder="Search or type customer name..."
              className="pr-10"
              required
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1">
              <Search className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search customers..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              {filteredCustomers.length > 0 && (
                <CommandGroup heading="Customers">
                  {filteredCustomers.map((customer) => (
                    <CommandItem
                      key={customer.id}
                      onSelect={() => {
                        onCustomerSelect(customer);
                        setOpen(false);
                        setSearchQuery('');
                      }}
                    >
                      <span>{customer.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {searchQuery && !filteredCustomers.some(customer => customer.name.toLowerCase() === searchQuery.toLowerCase()) && (
                <CommandGroup heading="Actions">
                  <CommandItem
                    onSelect={() => {
                      onAddNew();
                      setOpen(false);
                      setSearchQuery('');
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add "{searchQuery}" as new customer
                  </CommandItem>
                </CommandGroup>
              )}

              {filteredCustomers.length === 0 && !searchQuery && (
                <CommandEmpty>Start typing to search customers...</CommandEmpty>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={() => onNavigate('dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Amount Paid/Not Paid</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Record Payment Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Record Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select Customer</Label>
                <CustomerSearchPopover
                  customers={customers}
                  selectedCustomer={selectedCustomer}
                  onCustomerSelect={(customer) => setSelectedCustomer(customer)}
                  onAddNew={() => setShowNewCustomerDialog(true)}
                />
              </div>

              <div className="space-y-2">
                <Label>Amount Paid</Label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  step="0.01"
                  min="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Payment Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !paymentDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {paymentDate ? format(paymentDate, "dd/MM/yyyy") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={paymentDate}
                      onSelect={(date) => date && setPaymentDate(date)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleRecordPayment} className="w-full">
                <Save className="w-4 h-4 mr-2" />
                Record Payment
              </Button>
            </CardContent>
          </Card>

          {/* Payment History */}
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {paymentHistory.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No payment records found</p>
                ) : (
                  paymentHistory.map(payment => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium">{payment.customerName}</div>
                        <div className="text-sm text-muted-foreground">
                          {(() => {
                            const date = new Date(payment.date);
                            const day = date.getDate().toString().padStart(2, '0');
                            const month = (date.getMonth() + 1).toString().padStart(2, '0');
                            const year = date.getFullYear();
                            return `${day}/${month}/${year}`;
                          })()}
                          {payment.paymentMethod && ` • ${payment.paymentMethod}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-accent">₹{payment.amount.toFixed(2)}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeletePayment(payment.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add New Customer Dialog */}
        <Dialog open={showNewCustomerDialog} onOpenChange={setShowNewCustomerDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Customer</DialogTitle>
              <DialogDescription>Enter the customer name to add them to your list</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="newCustomerName">Customer Name</Label>
                <Input
                  id="newCustomerName"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewCustomerDialog(false);
                  setNewCustomerName('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (newCustomerName.trim()) {
                    try {
                      const savedCustomer = saveCustomer({ name: newCustomerName.trim() });
                      setSelectedCustomer(savedCustomer);
                      setCustomers(getCustomers());
                      setNewCustomerName('');
                      setShowNewCustomerDialog(false);
                      toast({
                        title: "Success",
                        description: "Customer added successfully"
                      });
                    } catch (error: any) {
                      if (error && error.message === 'DUPLICATE_CUSTOMER_NAME') {
                        toast({
                          title: "A customer with this name already exists",
                          description: "Please use a different name",
                          variant: "destructive"
                        });
                      } else {
                        toast({
                          title: "Error",
                          description: "Failed to add customer",
                          variant: "destructive"
                        });
                      }
                    }
                  }
                }}
              >
                Add Customer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
