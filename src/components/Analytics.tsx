import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getBills, getPayments, getAllCustomerBalances } from '@/lib/storage';
import { utils } from 'xlsx';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem'; // Keep Directory imported
import { Share } from '@capacitor/share';
import { useToast } from '@/hooks/use-toast';

interface AnalyticsData {
  revenues: { date: string; amount: number }[];
  topItems: { name: string; quantity: number; revenue: number }[];
  customerPatterns: { customer: string; totalAmount: number; billCount: number; paymentFrequency: number }[];
  outstandingPayments: { customer: string; amount: number; daysOverdue: number; }[];
  seasonalTrends: { month: string; currentYear: number; previousYear: number }[];
}

interface AnalyticsProps {
  onNavigate: (view: string) => void;
}

export const Analytics: React.FC<AnalyticsProps> = ({ onNavigate }) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast(); // Moved toast hook call here

  const calculateAnalytics = useCallback(async () => {
    setLoading(true);
    const bills = getBills();
    const payments = getPayments();

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    switch (timeRange) {
      case '7d': startDate.setDate(endDate.getDate() - 7); break;
      case '30d': startDate.setDate(endDate.getDate() - 30); break;
      case '90d': startDate.setDate(endDate.getDate() - 90); break;
      case '1y': startDate.setFullYear(endDate.getFullYear() - 1); break;
    }

    // Revenue trends
    const revenues = bills.reduce((acc: { date: string; amount: number }[], bill) => {
      const billDate = new Date(bill.date);
      if (billDate >= startDate && billDate <= endDate) {
        const dateStr = billDate.toISOString().split('T')[0];
        const existing = acc.find(x => x.date === dateStr);
        if (existing) {
          existing.amount += bill.grandTotal;
        } else {
          acc.push({ date: dateStr, amount: bill.grandTotal });
        }
      }
      return acc;
    }, []).sort((a, b) => a.date.localeCompare(b.date));

    // Top selling items - using item names from bills since items might not have IDs
    const itemStats = new Map<string, { quantity: number; revenue: number }>();
    
    bills.forEach(bill => {
      const billDate = new Date(bill.date);
      if (billDate >= startDate && billDate <= endDate) {
        bill.items.forEach(item => {
          const existing = itemStats.get(item.itemName) || { quantity: 0, revenue: 0 };
          existing.quantity += item.quantity;
          existing.revenue += item.total;
          itemStats.set(item.itemName, existing);
        });
      }
    });

    const topItems = Array.from(itemStats.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Customer payment patterns
    const customerPatterns = bills.reduce((acc: any[], bill) => {
      if (new Date(bill.date) >= startDate && new Date(bill.date) <= endDate) {
        const customer = acc.find(c => c.customer === bill.customerName);
        if (customer) {
          customer.totalAmount += bill.grandTotal;
          customer.billCount += 1;
        } else {
          acc.push({
            customer: bill.customerName,
            totalAmount: bill.grandTotal,
            billCount: 1,
            paymentFrequency: 0
          });
        }
      }
      return acc;
    }, []);

    // Calculate payment frequency
    customerPatterns.forEach(customer => {
      const customerPayments = payments.filter(p => 
        p.customerName === customer.customer &&
        new Date(p.date) >= startDate &&
        new Date(p.date) <= endDate
      );
      customer.paymentFrequency = customerPayments.length / customer.billCount;
    });

    // Outstanding payments - using customer balances instead since payments don't have billId
    const customerBalances = getAllCustomerBalances();
    const outstandingPayments = customerBalances
      .filter((balance: any) => balance.pending > 0)
      .map((balance: any) => ({
        customer: balance.customerName,
        amount: balance.pending,
        daysOverdue: 0 // We don't have bill-specific payment tracking
      }))
      .sort((a: any, b: any) => b.amount - a.amount);

    // Seasonal trends
    const currentYearSales = new Array(12).fill(0);
    const previousYearSales = new Array(12).fill(0);
    
    bills.forEach(bill => {
      const date = new Date(bill.date);
      const month = date.getMonth();
      const year = date.getFullYear();
      
      if (year === endDate.getFullYear()) {
        currentYearSales[month] += bill.grandTotal;
      } else if (year === endDate.getFullYear() - 1) {
        previousYearSales[month] += bill.grandTotal;
      }
    });

    const seasonalTrends = currentYearSales.map((amount, idx) => ({
      month: new Date(2024, idx).toLocaleString('default', { month: 'short' }),
      currentYear: amount,
      previousYear: previousYearSales[idx]
    }));

    setAnalyticsData({ revenues, topItems, customerPatterns, outstandingPayments, seasonalTrends });
    setLoading(false);
  }, [timeRange]);

  useEffect(() => {
    calculateAnalytics();
  }, [timeRange, calculateAnalytics]);

  const exportToExcel = async () => {
    if (!analyticsData) return;

    const fileName = `analytics_${timeRange}_${new Date().toISOString().split('T')[0]}.xlsx`;

    try {
      const worker = new Worker(new URL('@/workers/export-worker.ts', import.meta.url));
      worker.postMessage({ type: 'export-xlsx', workbook: {
        SheetNames: ['Revenue', 'Top Items', 'Customer Patterns', 'Outstanding', 'Seasonal'],
        Sheets: {
          'Revenue': utils.json_to_sheet(analyticsData.revenues),
          'Top Items': utils.json_to_sheet(analyticsData.topItems),
          'Customer Patterns': utils.json_to_sheet(analyticsData.customerPatterns),
          'Outstanding': utils.json_to_sheet(analyticsData.outstandingPayments),
          'Seasonal': utils.json_to_sheet(analyticsData.seasonalTrends)
        }
      }, fileName });

      worker.onmessage = async (ev) => {
        const msg = ev.data as any;
        if (msg.type === 'export-xlsx-result') {
          const buffer = msg.buffer as ArrayBuffer;
          worker.terminate();

          if (Capacitor.isNativePlatform()) {
            try {
              // Convert ArrayBuffer to Blob, then to base64 for Filesystem.writeFile
              const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
              const reader = new FileReader();
              reader.readAsDataURL(blob);
              reader.onloadend = async () => {
                const base64data = reader.result as string; // data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,...

                const cleanBase64 = base64data.split(',')[1]; // Remove data:mime/type;base64, prefix

                await Filesystem.writeFile({
                  path: fileName,
                  data: cleanBase64,
                  directory: 'DOCUMENTS' as Directory, // Using string literal with type assertion
                });

                const fileUri = await Filesystem.getUri({
                  directory: 'DOCUMENTS' as Directory, // Using string literal with type assertion
                  path: fileName
                });

                await Share.share({
                  title: 'Analytics Report',
                  text: 'Analytics report generated from Bill Buddy',
                  url: fileUri.uri,
                  dialogTitle: 'Share Analytics Report'
                });
                toast({
                  title: 'Share Successful',
                  description: 'Analytics report shared.',
                });
              };
            } catch (error) {
              console.error('Error saving or sharing XLSX on native:', error);
              toast({
                title: 'Share Failed',
                description: 'Could not save or share analytics report. Please try again.',
                variant: 'destructive',
              });
            }
          } else {
            // Web platform: trigger download
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');

            link.href = url;
            link.download = msg.fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast({
              title: 'Download Successful',
              description: 'Analytics report downloaded.',
            });
          }
        } else if (msg.type === 'error') {
          console.error('Worker error:', msg.message);
          worker.terminate();
          toast({
            title: 'Export Failed',
            description: 'Could not generate analytics report. Please try again.',
            variant: 'destructive',
          });
        }
      };
      worker.onerror = (err) => {
        console.error('Worker runtime error:', err);
        worker.terminate();
        toast({
          title: 'Export Failed',
          description: 'An unexpected error occurred during report generation. Please try again.',
          variant: 'destructive',
        });
      };

    } catch (err) {
      console.error('Worker creation or main thread fallback failed:', err);
      toast({
        title: 'Export Failed',
        description: 'Failed to initiate analytics report generation. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => onNavigate('dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Analytics</h1>
        </div>
        <div className="text-center py-8">Loading analytics...</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => onNavigate('dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Business Analytics</h1>
            <p className="text-muted-foreground">Insights into your business performance</p>
          </div>
        </div>

        <div className="flex justify-end items-center gap-2">
          <Select value={timeRange} onValueChange={(value: '7d' | '30d' | '90d' | '1y') => setTimeRange(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportToExcel} className="ml-2">
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
        </div>

      {analyticsData && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Revenue Summary */}
          <Card className="col-span-2">
            <CardHeader>
              <CardTitle>Revenue Summary</CardTitle>
              <CardDescription>Total revenue for selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                ₹{analyticsData.revenues.reduce((sum, r) => sum + r.amount, 0).toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                {analyticsData.revenues.length} days with sales
              </div>
              <div className="mt-4 space-y-2">
                {analyticsData.revenues.slice(-5).map((revenue, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-sm">{new Date(revenue.date).toLocaleDateString()}</span>
                    <span className="font-medium">₹{revenue.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Selling Items */}
          <Card>
            <CardHeader>
              <CardTitle>Top Selling Items</CardTitle>
              <CardDescription>Best performing products by revenue</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analyticsData.topItems.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Qty: {item.quantity}
                      </div>
                    </div>
                    <div className="font-medium">₹{item.revenue.toLocaleString()}</div>
                  </div>
                ))}
                {analyticsData.topItems.length === 0 && (
                  <div className="text-center text-muted-foreground py-4">
                    No items found for this period
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Customer Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Top Customers</CardTitle>
              <CardDescription>Customers by total sales</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analyticsData.customerPatterns
                  .sort((a, b) => b.totalAmount - a.totalAmount)
                  .slice(0, 5)
                  .map((customer, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{customer.customer}</div>
                        <div className="text-sm text-muted-foreground">
                          {customer.billCount} bills • {(customer.paymentFrequency * 100).toFixed(0)}% payment rate
                        </div>
                      </div>
                      <div className="font-medium">₹{customer.totalAmount.toLocaleString()}</div>
                    </div>
                  ))}
                {analyticsData.customerPatterns.length === 0 && (
                  <div className="text-center text-muted-foreground py-4">
                    No customers found for this period
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Outstanding Payments */}
          <Card>
            <CardHeader>
              <CardTitle>Outstanding Payments</CardTitle>
              <CardDescription>Pending payments from customers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analyticsData.outstandingPayments.slice(0, 5).map((payment, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{payment.customer}</div>
                      <div className="text-sm text-muted-foreground">
                        Pending payment
                      </div>
                    </div>
                    <div className="font-medium text-red-600">₹{payment.amount.toLocaleString()}</div>
                  </div>
                ))}
                {analyticsData.outstandingPayments.length === 0 && (
                  <div className="text-center text-muted-foreground py-4">
                    No outstanding payments
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Monthly Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Performance</CardTitle>
              <CardDescription>Current year vs previous year</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analyticsData.seasonalTrends
                  .filter(trend => trend.currentYear > 0 || trend.previousYear > 0)
                  .slice(-6)
                  .map((trend, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <div className="font-medium">{trend.month}</div>
                      <div className="flex gap-4">
                        <div className="text-sm">
                          <span className="text-muted-foreground">This year: </span>
                          <span className="font-medium">₹{trend.currentYear.toLocaleString()}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Last year: </span>
                          <span className="font-medium">₹{trend.previousYear.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      </div>
    </div>
  );
};