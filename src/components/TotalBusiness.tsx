import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, TrendingUp, ChevronDown, Download } from "lucide-react";
import { Capacitor } from '@capacitor/core';
import { getAllCustomerBalances } from "@/lib/storage";
import { CustomerBalance } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { generatePendingPDF, generateAdvancePDF } from "@/lib/pdf";

interface TotalBusinessProps {
  onNavigate: (view: 'create-bill' | 'customers' | 'balance' | 'amount-tracker' | 'last-balance' | 'dashboard') => void;
}

export const TotalBusiness = ({ onNavigate }: TotalBusinessProps) => {
  const [allBalances, setAllBalances] = useState<CustomerBalance[]>([]);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setAllBalances(getAllCustomerBalances());
  }, []);

  const businessSummary = allBalances.reduce(
    (summary, balance) => ({
      totalSales: summary.totalSales + balance.totalSales,
      totalPaid: summary.totalPaid + balance.totalPaid,
      totalPending: summary.totalPending + (balance.pending > 0 ? balance.pending : 0),
      totalAdvance: summary.totalAdvance + (balance.pending < 0 ? Math.abs(balance.pending) : 0),
    }),
    { totalSales: 0, totalPaid: 0, totalPending: 0, totalAdvance: 0 }
  );

  const pendingCustomers = allBalances.filter(balance => balance.pending > 0);
  const advanceCustomers = allBalances.filter(balance => balance.pending < 0);

  const handleGeneratePendingPDF = async () => {
    try {
      const result = await generatePendingPDF(pendingCustomers, businessSummary.totalPending, Capacitor.isNativePlatform());
      if (result.success) {
        toast({
          title: "Success",
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
        description: "Failed to generate pending amounts report.",
        variant: "destructive",
      });
    }
  };

  const handleGenerateAdvancePDF = async () => {
    try {
      const result = await generateAdvancePDF(advanceCustomers, businessSummary.totalAdvance, Capacitor.isNativePlatform());
      if (result.success) {
        toast({
          title: "Success",
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
        description: "Failed to generate advance amounts report.",
        variant: "destructive",
      });
    }
  };



  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={() => onNavigate('dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Total Business</h1>
        </div>

        <div className="space-y-6">
          {/* Business Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Business Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Total Sales */}
                <div className="p-4 bg-primary/5 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Total Sales</div>
                  <div className="text-2xl font-bold text-primary">₹{businessSummary.totalSales.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground mt-1">All customers combined</div>
                </div>

                {/* Total Paid */}
                <div className="p-4 bg-accent/5 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Total Amount Paid</div>
                  <div className="text-2xl font-bold text-accent">₹{businessSummary.totalPaid.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Received from customers</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending Amounts Section */}
          <Card>
            <CardContent className="pt-6">
              <Collapsible open={pendingOpen} onOpenChange={setPendingOpen}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-4 bg-destructive/5 rounded-lg cursor-pointer hover:bg-destructive/10 transition-colors">
                    <div>
                      <div className="text-sm text-muted-foreground">Total Pending Amount</div>
                      <div className="text-xl font-bold text-destructive">₹{businessSummary.totalPending.toFixed(2)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGeneratePendingPDF();
                        }}
                        disabled={pendingCustomers.length === 0}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <ChevronDown className={`w-4 h-4 transition-transform ${pendingOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-4 space-y-2">
                    {pendingCustomers.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No pending amounts</p>
                    ) : (
                      pendingCustomers.map(customer => (
                        <div
                          key={customer.customerId}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <span className="font-medium">{customer.customerName}</span>
                          <span className="font-bold text-destructive">₹{customer.pending.toFixed(2)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          {/* Advance Amounts Section */}
          {businessSummary.totalAdvance > 0 && (
            <Card>
              <CardContent className="pt-6">
                <Collapsible open={advanceOpen} onOpenChange={setAdvanceOpen}>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-4 bg-accent/5 rounded-lg cursor-pointer hover:bg-accent/10 transition-colors">
                      <div>
                        <div className="text-sm text-muted-foreground">Advance Amount</div>
                        <div className="text-xl font-bold text-accent">₹{businessSummary.totalAdvance.toFixed(2)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                                                                    <Button
                                                                      variant="outline"
                                                                      size="sm"
                                                                      onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleGenerateAdvancePDF();
                                                                      }}
                                                                      disabled={advanceCustomers.length === 0}
                                                                    >
                                                                      <Download className="w-4 h-4" />
                                                                    </Button>                                              <ChevronDown className={`w-4 h-4 transition-transform ${advanceOpen ? 'rotate-180' : ''}`} />                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-4 space-y-2">
                      {advanceCustomers.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">No advance amounts</p>
                      ) : (
                        advanceCustomers.map(customer => (
                          <div
                            key={customer.customerId}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <span className="font-medium">{customer.customerName}</span>
                            <span className="font-bold text-accent">₹{Math.abs(customer.pending).toFixed(2)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
