import React, { useState } from 'react';
import { ArrowLeft, AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getBills, getCustomerBalance, getCustomers, getPayments, resetCustomerHistory } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';

interface ResetCustomerHistoryProps {
  onNavigate: (view: string) => void;
}

export const ResetCustomerHistory: React.FC<ResetCustomerHistoryProps> = ({ onNavigate }) => {
  const { toast } = useToast();
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const customers = getCustomers().slice().sort((a, b) => a.name.localeCompare(b.name));
  const bills = getBills();
  const payments = getPayments();

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) || null;
  const customerBillCount = selectedCustomer ? bills.filter((bill) => bill.customerId === selectedCustomer.id).length : 0;
  const customerPaymentCount = selectedCustomer ? payments.filter((payment) => payment.customerId === selectedCustomer.id).length : 0;
  const hasHistory = customerBillCount > 0 || customerPaymentCount > 0;
  const currentBalance = selectedCustomer ? getCustomerBalance(selectedCustomer.id).pending : 0;
  const balanceColorClass = currentBalance === 0
    ? 'text-blue-600'
    : currentBalance > 0
      ? 'text-red-600'
      : 'text-green-600';
  const balanceLabel = currentBalance === 0
    ? 'No balance left'
    : currentBalance > 0
      ? 'Customer still has balance to pay'
      : 'Customer has paid extra';
  const balanceAmountText = `₹${Math.abs(currentBalance).toFixed(2)}`;

  const handleReset = () => {
    if (!selectedCustomer) {
      toast({
        title: 'Select customer',
        description: 'Please select a customer first.',
        variant: 'destructive',
      });
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirmReset = async () => {
    if (!selectedCustomer) return;

    try {
      setIsDeleting(true);
      const result = resetCustomerHistory(selectedCustomer.id);
      setConfirmOpen(false);
      setReloadKey((value) => value + 1);
      toast({
        title: 'History deleted',
        description: `${result.deletedBills} bills and ${result.deletedPayments} payments were removed for ${selectedCustomer.name}.`,
      });
    } catch (error) {
      console.error('Failed to reset customer history:', error);
      toast({
        title: 'Delete failed',
        description: 'Could not delete customer history. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-4 md:px-8 md:py-6 lg:px-12 lg:py-8">
      <div className="container mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => onNavigate('dashboard')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Reset Customer History</h1>
            <p className="text-muted-foreground">Delete all bills and payments for one customer, but keep the customer name.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Select Customer</CardTitle>
            <CardDescription>Choose the customer whose full history you want to clear.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Customer</Label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCustomer && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Bills</p>
                  <p className="text-2xl font-bold">{customerBillCount}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Payments</p>
                  <p className="text-2xl font-bold">{customerPaymentCount}</p>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900">
              This permanently deletes only the selected customer&apos;s bills and payments. The customer name stays in the app. This delete does not go to Recycle Bin.
            </div>

            <Button onClick={handleReset} disabled={!selectedCustomer || !hasHistory || isDeleting} className="w-full">
              {isDeleting ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete Customer History
            </Button>

            {selectedCustomer && !hasHistory && (
              <p className="text-sm text-muted-foreground">This customer currently has no bills or payments to delete.</p>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Delete full customer history?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {selectedCustomer
                  ? `Are you sure to delete ${selectedCustomer.name} all the data? This will permanently delete ${customerBillCount} bills and ${customerPaymentCount} payments. The customer name will remain in the app.`
                  : 'This will delete the selected customer history.'}
              </AlertDialogDescription>
              {selectedCustomer ? (
                <p className={`text-sm font-semibold ${balanceColorClass}`}>
                  {selectedCustomer.name} has balance of {balanceAmountText}. {balanceLabel}.
                </p>
              ) : null}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmReset} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
                {isDeleting ? 'Deleting...' : 'Delete History'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};
