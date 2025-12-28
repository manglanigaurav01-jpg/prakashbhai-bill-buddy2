 import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Download, TrendingUp, Users, Package, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getBills, getPayments, updateBusinessAnalytics } from '@/lib/storage';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface AnalyticsData {
  revenues: { date: string; amount: number }[];
  topItems: { name: string; quantity: number; revenue: number }[];
  customerPatterns: { customer: string; totalAmount: number; billCount: number; paymentFrequency: number }[];
  outstandingPayments: { customer: string; amount: number; daysOverdue: number }[];
  seasonalTrends: { month: string; currentYear: number; previousYear: number }[];
}

interface EnhancedAnalyticsProps {
  onNavigate: (view: string) => void;
}

export const EnhancedAnalytics: React.FC<EnhancedAnalyticsProps> = ({ onNavigate }) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const calculateAnalytics = React.useCallback(async () => {
    setLoading(true);
    
    // Use requestIdleCallback or setTimeout to prevent blocking UI with large datasets
    await new Promise(resolve => {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(resolve, { timeout: 100 });
      } else {
        setTimeout(resolve, 0);
      }
    });
    
    const bills = getBills();
    const payments = getPayments();
    await updateBusinessAnalytics();

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    switch (timeRange) {
      case '7d': startDate.setDate(endDate.getDate() - 7); break;
      case '30d': startDate.setDate(endDate.getDate() - 30); break;
      case '90d': startDate.setDate(endDate.getDate() - 90); break;
      case '1y': startDate.setFullYear(endDate.getFullYear() - 1); break;
    }

    // Filter bills first for better performance with large datasets
    const filteredBills = bills.filter(bill => {
      const billDate = new Date(bill.date);
      return billDate >= startDate && billDate <= endDate;
    });

    // Revenue trends - use filtered bills
    const revenues = filteredBills
      .reduce((acc: { date: string; amount: number }[], bill) => {
        const dateStr = bill.date.split('T')[0];
        const existing = acc.find(x => x.date === dateStr);
        if (existing) {
          existing.amount += bill.grandTotal;
        } else {
          acc.push({ date: dateStr, amount: bill.grandTotal });
        }
        return acc;
      }, [])
      .sort((a, b) => a.date.localeCompare(b.date));

    // Popular items analysis - use filtered bills
    const itemStats = new Map<string, { quantity: number; revenue: number }>();
    filteredBills.forEach(bill => {
      bill.items.forEach(item => {
        const stats = itemStats.get(item.itemName) || { quantity: 0, revenue: 0 };
        stats.quantity += item.quantity;
        stats.revenue += item.total;
        itemStats.set(item.itemName, stats);
      });
    });

    const topItems = Array.from(itemStats.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Customer payment patterns - use filtered bills
    const customerStats = new Map<string, {
      totalAmount: number;
      billCount: number;
      payments: number[];
      lastPaymentDate?: Date;
    }>();

    filteredBills.forEach(bill => {
      const stats = customerStats.get(bill.customerName) || {
        totalAmount: 0,
        billCount: 0,
        payments: []
      };
      stats.totalAmount += bill.grandTotal;
      stats.billCount += 1;
      customerStats.set(bill.customerName, stats);
    });
    
    // Filter payments by date range for better performance
    const filteredPayments = payments.filter(payment => {
      const paymentDate = new Date(payment.date);
      return paymentDate >= startDate && paymentDate <= endDate;
    });

    filteredPayments.forEach(payment => {
      const stats = customerStats.get(payment.customerName);
      if (stats) {
        stats.payments.push(payment.amount);
        const paymentDate = new Date(payment.date);
        if (!stats.lastPaymentDate || paymentDate > stats.lastPaymentDate) {
          stats.lastPaymentDate = paymentDate;
        }
      }
    });

    const customerPatterns = Array.from(customerStats.entries())
      .map(([customer, stats]) => ({
        customer,
        totalAmount: stats.totalAmount,
        billCount: stats.billCount,
        paymentFrequency: stats.payments.length ? Math.round(30 / (stats.payments.length / (stats.billCount || 1))) : 0
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    // Outstanding payments
    const outstandingPayments = Array.from(customerStats.entries())
      .map(([customer, stats]) => {
        const totalPaid = stats.payments.reduce((sum, amount) => sum + amount, 0);
        const outstanding = stats.totalAmount - totalPaid;
        const lastPayment = stats.lastPaymentDate || new Date(0);
        const daysOverdue = Math.floor((new Date().getTime() - lastPayment.getTime()) / (1000 * 60 * 60 * 24));
        return { customer, amount: outstanding, daysOverdue };
      })
      .filter(payment => payment.amount > 0)
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    setAnalyticsData({
      revenues,
      topItems,
      customerPatterns,
      outstandingPayments,
      seasonalTrends: [], // To be implemented
    });
    setLoading(false);
  }, [timeRange]);

  useEffect(() => {
    calculateAnalytics();
  }, [calculateAnalytics]);

  const exportToExcel = async () => {
    if (!analyticsData) {
      toast({
        title: "No data",
        description: "No analytics data available to export",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const workbook = XLSX.utils.book_new();
      
      // Revenue sheet
      const revenueData = analyticsData.revenues.map(r => ({
        Date: new Date(r.date).toLocaleDateString(),
        Revenue: r.amount
      }));
      if (revenueData.length > 0) {
        const revenueSheet = XLSX.utils.json_to_sheet(revenueData);
        XLSX.utils.book_append_sheet(workbook, revenueSheet, "Revenue Trends");
      }
      
      // Top Items sheet
      if (analyticsData.topItems.length > 0) {
        const itemsSheet = XLSX.utils.json_to_sheet(analyticsData.topItems);
        XLSX.utils.book_append_sheet(workbook, itemsSheet, "Top Items");
      }
      
      // Customer Patterns sheet
      if (analyticsData.customerPatterns.length > 0) {
        const customerSheet = XLSX.utils.json_to_sheet(analyticsData.customerPatterns);
        XLSX.utils.book_append_sheet(workbook, customerSheet, "Customer Patterns");
      }
      
      // Outstanding Payments sheet
      if (analyticsData.outstandingPayments.length > 0) {
        const outstandingSheet = XLSX.utils.json_to_sheet(analyticsData.outstandingPayments);
        XLSX.utils.book_append_sheet(workbook, outstandingSheet, "Outstanding Payments");
      }
      
      const fileName = `bill-buddy-analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.xlsx`;
      const isWeb = Capacitor.getPlatform() === 'web';
      
      if (isWeb) {
        // For web, use XLSX.writeFile which triggers download
        XLSX.writeFile(workbook, fileName);
        toast({
          title: "Export successful",
          description: `File downloaded: ${fileName}. Check your Downloads folder.`,
        });
      } else {
        // For mobile, save to Filesystem and share
        try {
          // Convert workbook to binary array
          const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
          
          // Convert ArrayBuffer to base64
          let binary = '';
          const bytes = new Uint8Array(excelBuffer);
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64Data = btoa(binary);
          
          // Save to Cache directory
          await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Cache
          });
          
          // Get file URI
          const fileInfo = await Filesystem.getUri({
            path: fileName,
            directory: Directory.Cache
          });
          
          if (!fileInfo.uri) {
            throw new Error('Could not get file URI');
          }
          
          // Share the file so user can choose where to save it
          await Share.share({
            title: 'Analytics Export',
            text: `Analytics data exported for ${timeRange}`,
            url: fileInfo.uri,
            dialogTitle: 'Save or Share Excel File'
          });
          
          toast({
            title: "Export successful",
            description: `File saved. Choose where to save it from the share dialog.`,
          });
        } catch (mobileError: any) {
          console.error('Mobile export error:', mobileError);
          // Fallback: try to use XLSX.writeFile anyway
          XLSX.writeFile(workbook, fileName);
          toast({
            title: "Export successful",
            description: `File saved: ${fileName}`,
          });
        }
      }
    } catch (error: any) {
      console.error('Excel export error:', error);
      toast({
        title: "Export failed",
        description: error.message || "Failed to export to Excel",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => onNavigate('dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
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
        </div>
        <Button onClick={exportToExcel}>
          <Download className="h-4 w-4 mr-2" />
          Export to Excel
        </Button>
      </div>

      {/* SyncStatus component removed - not currently used */}

      {loading ? (
        <div>Loading analytics...</div>
      ) : analyticsData ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <TrendingUp className="h-8 w-8 text-primary" />
                  <div>
                    <div className="text-sm font-medium">Total Revenue</div>
                    <div className="text-2xl font-bold">
                      ₹{analyticsData.revenues.reduce((sum, r) => sum + r.amount, 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Users className="h-8 w-8 text-primary" />
                  <div>
                    <div className="text-sm font-medium">Active Customers</div>
                    <div className="text-2xl font-bold">
                      {analyticsData.customerPatterns.length}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Package className="h-8 w-8 text-primary" />
                  <div>
                    <div className="text-sm font-medium">Top Item Revenue</div>
                    <div className="text-2xl font-bold">
                      ₹{(analyticsData.topItems[0]?.revenue || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <IndianRupee className="h-8 w-8 text-primary" />
                  <div>
                    <div className="text-sm font-medium">Outstanding</div>
                    <div className="text-2xl font-bold">
                      ₹{analyticsData.outstandingPayments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Revenue Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trends</CardTitle>
                <CardDescription>Daily revenue over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analyticsData.revenues.map((data, index) => (
                    <div key={index} className="flex justify-between items-center hover:bg-muted p-2 rounded-lg">
                      <span>{new Date(data.date).toLocaleDateString()}</span>
                      <span className="font-medium">₹{data.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Items */}
            <Card>
              <CardHeader>
                <CardTitle>Top Selling Items</CardTitle>
                <CardDescription>Best performing products</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analyticsData.topItems.map((item, index) => (
                    <div key={index} className="p-2 hover:bg-muted rounded-lg">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {item.quantity} units sold
                          </div>
                        </div>
                        <span className="font-medium">₹{item.revenue.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Customer Patterns */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Patterns</CardTitle>
                <CardDescription>Customer purchasing behavior</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analyticsData.customerPatterns.map((customer, index) => (
                    <div key={index} className="p-2 hover:bg-muted rounded-lg">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{customer.customer}</div>
                          <div className="text-sm text-muted-foreground">
                            {customer.billCount} bills • {customer.paymentFrequency} days avg. payment
                          </div>
                        </div>
                        <span className="font-medium">₹{customer.totalAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Outstanding Payments */}
            <Card>
              <CardHeader>
                <CardTitle>Outstanding Payments</CardTitle>
                <CardDescription>Payments requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analyticsData.outstandingPayments.map((payment, index) => (
                    <div key={index} className="p-2 hover:bg-muted rounded-lg">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{payment.customer}</div>
                          <div className="text-sm text-destructive">
                            {payment.daysOverdue} days overdue
                          </div>
                        </div>
                        <span className="font-medium">₹{payment.amount.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div>No data available</div>
      )}
    </div>
  );
};