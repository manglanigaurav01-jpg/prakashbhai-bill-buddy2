import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Download, Search, Plus } from "lucide-react";
import { getCustomers, saveCustomer } from "@/lib/storage";
import { generateLastBalancePDF } from "@/lib/last-balance-pdf";
import { Customer, MonthlyBalance } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { generateMonthlyBalances } from "@/lib/monthly-balance";

interface LastBalanceProps {
  onNavigate: (view: string) => void;
}

interface CustomerSummary {
  customerId: string;
  customerName: string;
  totalBills: number;
  totalPayments: number;
  currentBalance: number;
  lastMonthBalance?: number;
}

export const LastBalance = ({ onNavigate }: LastBalanceProps) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [, setMonthlyBalances] = useState<MonthlyBalance[]>([]);
  const [customerSummary, setCustomerSummary] = useState<CustomerSummary | undefined>();
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const { toast } = useToast();

  // Load customers once
  useEffect(() => {
    const loadCustomers = () => {
      const customerList = getCustomers();
      setCustomers(customerList);
    };
    loadCustomers();
  }, []);

  // Update customer balance when customer is selected
  useEffect(() => {
    const loadBalances = async () => {
      if (!selectedCustomer) {
        setCustomerSummary(undefined);
        return;
      }

      try {
        const balances = await generateMonthlyBalances(selectedCustomer);
        setMonthlyBalances(balances);

        const customer = customers.find(c => c.id === selectedCustomer);
        const lastMonth = balances[balances.length - 2]; // Second to last entry is last month
        const currentMonth = balances[balances.length - 1]; // Last entry is current month

        if (customer && currentMonth) {
          setCustomerSummary({
            customerId: selectedCustomer,
            customerName: customer.name,
            totalBills: currentMonth.bills,
            totalPayments: currentMonth.payments,
            currentBalance: currentMonth.closingBalance,
            lastMonthBalance: lastMonth?.closingBalance
          });
        }
      } catch (error) {
        console.error('Error loading balance details:', error);
        toast({
          title: "Error",
          description: "Failed to load balance details",
          variant: "destructive",
        });
      }
    };

    loadBalances();
  }, [selectedCustomer, customers, toast]);

  const CustomerSearchPopover = ({
    customers,
    selectedCustomer,
    onCustomerSelect,
    onAddNew
  }: {
    customers: Customer[];
    selectedCustomer: string;
    onCustomerSelect: (customerId: string) => void;
    onAddNew: () => void;
  }) => {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredCustomers = searchQuery
      ? customers.filter(customer =>
          customer.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : customers;

    const selectedCustomerObj = customers.find(c => c.id === selectedCustomer);

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              value={selectedCustomerObj?.name || searchQuery}
              onChange={(e) => {
                const value = e.target.value;
                setSearchQuery(value);
                if (value && !open) setOpen(true);
                // Clear selection if user is typing
                if (selectedCustomerObj && value !== selectedCustomerObj.name) {
                  onCustomerSelect('');
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
                        onCustomerSelect(customer.id);
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

  const handleGenerateLastBalancePDF = async () => {
    if (!selectedCustomer || !customerSummary) {
      toast({
        title: "Error",
        description: "Please select a customer first",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "Processing",
        description: "Generating PDF, please wait...",
      });

      const result = await generateLastBalancePDF(selectedCustomer, customerSummary.customerName);

      if (result.success) {
        toast({
          title: "Success",
          description: result.message || "PDF generated successfully"
        });
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to generate PDF",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('PDF generation failed:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate Last Balance PDF",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => onNavigate('dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Last Balance</h1>
            <p className="text-muted-foreground">View and generate last balance statements</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">Last Balance Report</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Customer</Label>
                  <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer to view balance" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map(customer => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {customerSummary && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Balance Summary - {customerSummary.customerName}</span>
                  <Button 
                    onClick={handleGenerateLastBalancePDF}
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <Download className="w-4 h-4" />
                    Generate PDF
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 bg-primary/5 rounded-lg">
                    <div className="text-sm text-muted-foreground">Last Balance</div>
                    <div className="font-bold text-primary">₹{(customerSummary.lastMonthBalance || 0).toFixed(2)}</div>
                  </div>
                  <div className="p-3 bg-accent/5 rounded-lg">
                    <div className="text-sm text-muted-foreground">Current Bills</div>
                    <div className="font-bold text-accent">₹{customerSummary.totalBills.toFixed(2)}</div>
                  </div>
                  <div className="p-3 bg-destructive/5 rounded-lg">
                    <div className="text-sm text-muted-foreground">Current Balance</div>
                    <div className="font-bold text-destructive">₹{customerSummary.currentBalance.toFixed(2)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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
                        setSelectedCustomer(savedCustomer.id);
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
    </div>
  );

};
