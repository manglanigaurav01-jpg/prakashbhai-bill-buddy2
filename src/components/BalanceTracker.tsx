import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, FileText, AlertCircle, TrendingUp, Download, MessageCircle } from "lucide-react";
import { getCustomers, getCustomerBalance, getAllCustomerBalances } from "@/lib/storage";
import { generateCustomerSummaryPDF } from "@/lib/pdf";
import { shareViaWhatsApp, createPaymentReminderMessage } from "@/lib/whatsapp";
import { Customer, CustomerBalance } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Capacitor } from '@capacitor/core'; // Added import

interface BalanceTrackerProps {
  onNavigate: (view: 'create-bill' | 'customers' | 'balance' | 'dashboard') => void;
}

export const BalanceTracker = ({ onNavigate }: BalanceTrackerProps) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [customerBalance, setCustomerBalance] = useState<CustomerBalance | null>(null);
  const [allBalances, setAllBalances] = useState<CustomerBalance[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    // Optimized for 300+ customers - getAllCustomerBalances uses single-pass algorithm
    const customerList = getCustomers();
    setCustomers(customerList);
    // Use setTimeout to prevent blocking UI with large datasets
    setTimeout(() => {
      setAllBalances(getAllCustomerBalances());
    }, 0);
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      const balance = getCustomerBalance(selectedCustomer);
      setCustomerBalance(balance);
    } else {
      setCustomerBalance(null);
    }
  }, [selectedCustomer]);

  const handleGenerateSummaryPDF = async (customerId: string) => {
    try {
      const result = await generateCustomerSummaryPDF(customerId, Capacitor.isNativePlatform());
      if (result.success) {
        toast({
          title: "Summary Generated",
          description: result.message,
        });
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate summary PDF",
        variant: "destructive",
      });
    }
  };

  const overallSummary = allBalances.reduce(
    (summary, balance) => ({
      totalSales: summary.totalSales + balance.totalSales,
      totalPaid: summary.totalPaid + balance.totalPaid,
      totalPending: summary.totalPending + (balance.pending > 0 ? balance.pending : 0),
      totalAdvance: summary.totalAdvance + (balance.pending < 0 ? Math.abs(balance.pending) : 0),
    }),
    { totalSales: 0, totalPaid: 0, totalPending: 0, totalAdvance: 0 }
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={() => onNavigate('dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Balance Tracker</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Customer Balance Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Customer</Label>
                  <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer to view details" />
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
              </CardContent>
            </Card>

            {/* Customer Balance Details */}
            {customerBalance && (
              <Card>
                <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>Balance Details - {customerBalance.customerName}</span>
                    <div className="flex gap-2">
                      {customerBalance.pending > 0 && (
                        <Button 
                          onClick={async () => {
                            const message = createPaymentReminderMessage(customerBalance.customerName, customerBalance.pending);
                            await shareViaWhatsApp('', message);
                          }}
                          variant="outline"
                          className="flex items-center gap-2"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Send Reminder
                        </Button>
                      )}
                      <Button 
                        onClick={() => handleGenerateSummaryPDF(customerBalance.customerId)}
                        className="flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Generate PDF
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    readOnly
                    value={`Customer: ${customerBalance.customerName}
Total Sales: ₹${customerBalance.totalSales.toFixed(2)}
Total Paid: ₹${customerBalance.totalPaid.toFixed(2)}
${customerBalance.pending > 0 ? `Pending Amount: ₹${customerBalance.pending.toFixed(2)}` : 
  customerBalance.pending < 0 ? `Advance Amount: ₹${Math.abs(customerBalance.pending).toFixed(2)}` : 'No Pending Amount'}

Payment Status: ${customerBalance.pending > 0 ? 'Outstanding' : customerBalance.pending < 0 ? 'Advance Given' : 'Cleared'}`}
                    className="h-32"
                  />
                </CardContent>
              </Card>
            )}

            {/* Per-Customer Summary */}
            <Card>
              <CardHeader>
                <CardTitle>All Customers Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {allBalances.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No customer data available</p>
                  ) : (
                    allBalances.map(balance => (
                      <div
                        key={balance.customerId}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="font-medium">{balance.customerName}</div>
                        <div className="flex gap-4 text-sm">
                          <span className="text-muted-foreground">
                            Sales: ₹{balance.totalSales.toFixed(2)}
                          </span>
                          <span className="text-accent">
                            Paid: ₹{balance.totalPaid.toFixed(2)}
                          </span>
                          {balance.pending > 0 ? (
                            <span className="font-medium text-destructive">
                              Pending: ₹{balance.pending.toFixed(2)}
                            </span>
                          ) : balance.pending < 0 ? (
                            <span className="font-medium text-accent">
                              Advance: ₹{Math.abs(balance.pending).toFixed(2)}
                            </span>
                          ) : (
                            <span className="font-medium text-accent">
                              Cleared
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Overall Summary Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Overall Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-primary/5 rounded-lg">
                    <span className="font-medium">Total Sales</span>
                    <span className="font-bold text-primary">₹{overallSummary.totalSales.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-accent/5 rounded-lg">
                    <span className="font-medium">Total Paid</span>
                    <span className="font-bold text-accent">₹{overallSummary.totalPaid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-destructive/5 rounded-lg">
                    <span className="font-medium">Total Pending</span>
                    <span className="font-bold text-destructive">₹{overallSummary.totalPending.toFixed(2)}</span>
                  </div>
                  {overallSummary.totalAdvance > 0 && (
                    <div className="flex justify-between items-center p-3 bg-accent/5 rounded-lg">
                      <span className="font-medium">Total Advance</span>
                      <span className="font-bold text-accent">₹{overallSummary.totalAdvance.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {overallSummary.totalPending > 0 && (
              <Card className="border-destructive/20 bg-destructive/5">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-medium">Outstanding Amount</span>
                  </div>
                  <p className="text-2xl font-bold text-destructive mt-2">
                    ₹{overallSummary.totalPending.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {allBalances.filter(b => b.pending > 0).length} customers have pending payments
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};