import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, FileText, Search, Plus } from "lucide-react";
import { Capacitor } from '@capacitor/core';
import { useToast } from "@/hooks/use-toast";
import { Customer, MonthlyBalance } from "@/types";
import { getCustomers, saveCustomer } from "@/lib/storage";
import { generateMonthlyBalances, getMonthLabel } from "@/lib/monthly-balance";
import { generateMonthlyBalancePDF } from "@/lib/last-balance-pdf";
import { hapticSuccess, hapticError } from "@/lib/haptics";

interface BalanceHistoryProps {
  onNavigate: (view: string) => void;
}

export const BalanceHistory = ({ onNavigate }: BalanceHistoryProps) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [monthlyBalances, setMonthlyBalances] = useState<MonthlyBalance[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      try {
        const customerList = getCustomers();
        setCustomers(customerList);
        
        if (selectedCustomer) {
          const balances = await generateMonthlyBalances(selectedCustomer);
          // generateMonthlyBalances returns oldest -> newest; reverse to show newest first
          const sortedBalances = [...balances].reverse();
          setMonthlyBalances(sortedBalances);
          // Reverse month order to show newest first
          setAvailableMonths(sortedBalances.map(b => `${b.year}-${b.month}`));
        }
      } catch (error) {
        console.error('Error loading balance history:', error);
        toast({
          title: "Error",
          description: "Failed to load balance history",
          variant: "destructive",
        });
      }
    };

    loadData();
  }, [selectedCustomer, toast]);

  const selectedBalance = selectedMonth && monthlyBalances ? 
    monthlyBalances.find(b => `${b.year}-${b.month}` === selectedMonth) : null;

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

  const handleGeneratePDF = async () => {
    if (!selectedCustomer || !selectedBalance) {
      toast({
        title: "Error",
        description: "Please select a customer and month",
        variant: "destructive",
      });
      return;
    }

    const customer = customers.find(c => c.id === selectedCustomer);
    if (!customer) return;

    try {
      await generateMonthlyBalancePDF(
        selectedCustomer,
        customer.name,
        selectedBalance.month,
        selectedBalance.year,
        Capacitor.isNativePlatform() // Pass forceShare based on platform
      );
      hapticSuccess();
      toast({
        title: "PDF Generated",
        description: `Balance PDF for ${getMonthLabel(selectedMonth)} has been generated successfully`,
      });
    } catch (error) {
      hapticError();
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate PDF",
        variant: "destructive",
      });
    }
  };



  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => onNavigate('dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Balance History</h1>
            <p className="text-muted-foreground">View historical balance sheets</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Select Customer</Label>
                <CustomerSearchPopover
                  customers={customers}
                  selectedCustomer={selectedCustomer}
                  onCustomerSelect={setSelectedCustomer}
                  onAddNew={() => setShowNewCustomerDialog(true)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Select Month</label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a month" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMonths.map(month => (
                      <SelectItem key={month} value={month}>
                        {getMonthLabel(month)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedBalance && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{customers.find(c => c.id === selectedCustomer)?.name} - {getMonthLabel(selectedMonth)}</CardTitle>
                <Button onClick={handleGeneratePDF} className="gap-2">
                  <FileText className="w-4 h-4" />
                  Generate PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 rounded-lg bg-muted">
                  <div className="text-sm font-medium text-muted-foreground">Opening Balance</div>
                  <div className="text-2xl font-bold">₹{selectedBalance.openingBalance.toFixed(2)}</div>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <div className="text-sm font-medium text-muted-foreground">Closing Balance</div>
                  <div className="text-2xl font-bold">₹{selectedBalance.closingBalance.toFixed(2)}</div>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <div className="text-sm font-medium text-muted-foreground">Total Bills</div>
                  <div className="text-2xl font-bold">₹{selectedBalance.bills.toFixed(2)}</div>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <div className="text-sm font-medium text-muted-foreground">Total Payments</div>
                  <div className="text-2xl font-bold">₹{selectedBalance.payments.toFixed(2)}</div>
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
  );
};
