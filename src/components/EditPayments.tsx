import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search, SortAsc, SortDesc, Edit3, Trash2, Save, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { toast } from '@/hooks/use-toast';
import { getPayments, getCustomers, updatePayment, deletePayment, saveCustomer } from '@/lib/storage';
import { Customer, Payment } from '@/types';
import { SwipeableItem } from '@/components/SwipeableItem';
import { hapticMedium, hapticError, hapticSuccess, hapticWarning } from '@/lib/haptics';
import { validatePaymentDateWithFutureWarning, validateLargeAmount } from '@/lib/validation';


interface EditPaymentsProps {
  onNavigate: (view: string) => void;
}

type SortKey = 'date' | 'customerName' | 'amount';

export const EditPayments: React.FC<EditPaymentsProps> = ({ onNavigate }) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [filterDate, setFilterDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Payment | null>(null);
  const [editingDate, setEditingDate] = useState<Date>(new Date());
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingAmount, setEditingAmount] = useState<string>('');
  const [showDeleteId, setShowDeleteId] = useState<string | null>(null);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const allPayments = getPayments();
        const allCustomers = getCustomers();
        
        console.log('Loaded payments:', allPayments); // Debug log
        console.log('Loaded customers:', allCustomers); // Debug log
        
        setPayments(allPayments);
        setCustomers(allCustomers);
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load payments and customers');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
    
    // Add event listener for storage changes
    window.addEventListener('storage', loadData);
    
    return () => {
      window.removeEventListener('storage', loadData);
    };
  }, []);

  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = payments.filter(p => {
      const matchesText = !q || p.customerName.toLowerCase().includes(q);
      const matchesDate = !filterDate || (new Date(p.date).toDateString() === filterDate.toDateString());
      return matchesText && matchesDate;
    });
    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === 'date') {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        return sortAsc ? da - db : db - da;
      }
      if (sortKey === 'customerName') {
        const ca = a.customerName.toLowerCase();
        const cb = b.customerName.toLowerCase();
        return sortAsc ? ca.localeCompare(cb) : cb.localeCompare(ca);
      }
      // amount
      return sortAsc ? a.amount - b.amount : b.amount - a.amount;
    });
    return sorted;
  }, [payments, query, sortKey, sortAsc, filterDate]);

  const startEdit = (payment: Payment) => {
    setEditing(payment);
    setEditingDate(new Date(payment.date));
    const cust = customers.find(c => c.id === payment.customerId) || null;
    setEditingCustomer(cust);
    setEditingAmount(payment.amount.toString());
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editingCustomer) {
      toast({ title: 'Error', description: 'Please select a customer', variant: 'destructive' });
      return;
    }
    const amt = parseFloat(editingAmount);
    if (!amt || amt <= 0) {
      toast({ title: 'Error', description: 'Enter a valid amount', variant: 'destructive' });
      return;
    }

    const dateValidation = validatePaymentDateWithFutureWarning(editingDate);
    if (dateValidation.warning) {
      toast({
        title: "Date Warning",
        description: dateValidation.warning,
        variant: "default",
      });
      hapticWarning();
    }

    // Validate amount with large amount warning
    const allPayments = getPayments();
    const paymentAmounts = allPayments.map(p => p.amount);
    const amountValidation = validateLargeAmount(amt, 'payment', { payments: paymentAmounts });
    if (amountValidation.warning) {
      toast({
        title: "Amount Warning",
        description: amountValidation.warning,
        variant: "default",
      });
      hapticWarning();
    }

    const updated = updatePayment(editing.id, {
      customerId: editingCustomer.id,
      customerName: editingCustomer.name,
      amount: amt,
      date: editingDate.toISOString().split('T')[0],
    });
    if (updated) {
      setPayments(getPayments());
      hapticSuccess();
      toast({ title: 'Payment updated', description: `Payment for ${updated.customerName} updated successfully` });
      setEditing(null);
    } else {
      toast({ title: 'Error', description: 'Failed to update payment', variant: 'destructive' });
    }
  };

  const handleDelete = (paymentId: string) => {
    hapticMedium();
    setShowDeleteId(paymentId);
  };

  const confirmDelete = () => {
    if (!showDeleteId) return;
    try {
      deletePayment(showDeleteId);
      setPayments(getPayments());
      hapticSuccess();
      toast({ title: 'Payment deleted', description: 'The payment has been removed' });
    } catch (error) {
      hapticError();
      toast({ title: 'Error', description: 'Failed to delete payment', variant: 'destructive' });
    } finally {
      setShowDeleteId(null);
    }
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

  const formatDate = (date: Date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => onNavigate('dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Edit Amt Paid</h1>
              <p className="text-muted-foreground">Loading payments...</p>
            </div>
          </div>
          <div className="text-center py-8">
            <div className="text-lg">Loading payments and customers...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => onNavigate('dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Edit Amt Paid</h1>
              <p className="text-muted-foreground">Error loading data</p>
            </div>
          </div>
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-red-600 mb-4">{error}</div>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => onNavigate('dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Edit Amt Paid</h1>
            <p className="text-muted-foreground">Filter, edit or delete payments</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filter by customer name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div>
              <Label className="mb-1 block">Date</Label>
              <DatePicker date={filterDate || undefined} onDateChange={(d) => setFilterDate(d || null)} placeholder="Filter by date" />
            </div>
            <div className="flex gap-2">
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                <SelectTrigger className="min-w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Sort by Date</SelectItem>
                  <SelectItem value="customerName">Sort by Customer</SelectItem>
                  <SelectItem value="amount">Sort by Amount</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setSortAsc(s => !s)}>
                {sortAsc ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Debug Info */}
        {payments.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">
                Debug: Found {payments.length} payments, showing {filteredSorted.length} after filtering
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {filteredSorted.map((p) => (
            <SwipeableItem
              key={p.id}
              onEdit={() => startEdit(p)}
              onDelete={() => handleDelete(p.id)}
            >
              <Card className="hover:shadow-md transition-all duration-200">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground">{formatDate(new Date(p.date))}</div>
                    <div className="text-lg font-semibold">{p.customerName}</div>
                    <div className="text-sm text-muted-foreground">Amount: ₹{p.amount.toFixed(2)}</div>
                  </div>
                  <div>
                    <Button size="sm" variant="outline" onClick={() => startEdit(p)}>
                      <Edit3 className="w-4 h-4 mr-1" /> Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </SwipeableItem>
          ))}
          {filteredSorted.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">No payments found</CardContent>
            </Card>
          )}
        </div>

        <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Payment</DialogTitle>
              <DialogDescription>Update payment details</DialogDescription>
            </DialogHeader>
            {editing && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Date</Label>
                    <DatePicker date={editingDate} onDateChange={(d) => d && setEditingDate(d)} />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>Customer</Label>
                    <CustomerSearchPopover
                      customers={customers}
                      selectedCustomer={editingCustomer}
                      onCustomerSelect={(customer) => setEditingCustomer(customer)}
                      onAddNew={() => setShowNewCustomerDialog(true)}
                    />
                  </div>
                </div>
                <div>
                  <Label>Amount</Label>
                  <Input type="number" step="0.01" value={editingAmount} onChange={(e) => setEditingAmount(e.target.value)} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                  <Button onClick={saveEdit}><Save className="w-4 h-4 mr-1" />Save</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!showDeleteId} onOpenChange={(open) => { if (!open) setShowDeleteId(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Payment</DialogTitle>
              <DialogDescription>Are you sure you want to delete this payment?</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={confirmDelete}><Trash2 className="w-4 h-4 mr-1" />Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                      setEditingCustomer(savedCustomer);
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


