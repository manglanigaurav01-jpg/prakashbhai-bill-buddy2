import type { Bill, Payment, ItemUsage, Customer } from '@/types';
import { getBills, getPayments, getCustomers, getItems } from './storage';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

// Types for analytics
interface SalesTrend {
  period: string;
  totalSales: number;
  billCount: number;
  averageBillValue: number;
}

interface PaymentPattern {
  customerId: string;
  customerName: string;
  averagePaymentDelay: number;
  totalPayments: number;
  preferredPaymentSize: number;
}

interface PopularItem {
  itemId: string;
  itemName: string;
  totalQuantity: number;
  totalValue: number;
  frequency: number;
}

interface SeasonalAnalysis {
  month: string;
  totalSales: number;
  topItems: PopularItem[];
  customerCount: number;
}

interface CashFlowPrediction {
  period: string;
  predictedInflow: number;
  predictedOutflow: number;
  confidence: number;
}

// Sales Trends Analysis
export const analyzeSalesTrends = (months: number = 6): SalesTrend[] => {
  const bills = getBills();
  const trends: SalesTrend[] = [];

  for (let i = 0; i < months; i++) {
    const periodStart = startOfMonth(subMonths(new Date(), i));
    const periodEnd = endOfMonth(subMonths(new Date(), i));
    const periodBills = bills.filter(bill => {
      const billDate = new Date(bill.date);
      return billDate >= periodStart && billDate <= periodEnd;
    });

    trends.push({
      period: format(periodStart, 'MMMM yyyy'),
      totalSales: periodBills.reduce((sum, bill) => sum + bill.grandTotal, 0),
      billCount: periodBills.length,
      averageBillValue: periodBills.length > 0 
        ? periodBills.reduce((sum, bill) => sum + bill.grandTotal, 0) / periodBills.length 
        : 0
    });
  }

  return trends.reverse();
};

// Customer Payment Patterns
export const analyzePaymentPatterns = (): PaymentPattern[] => {
  const payments = getPayments();
  const bills = getBills();
  const customers = getCustomers();
  const patterns: PaymentPattern[] = [];

  customers.forEach(customer => {
    const customerPayments = payments.filter(p => p.customerId === customer.id);
    const customerBills = bills.filter(b => b.customerId === customer.id);
    
    if (customerPayments.length === 0) return;

    const delays = customerBills.map(bill => {
      const billDate = new Date(bill.date);
      const payment = payments.find(p => p.customerId === bill.customerId);
      return payment ? (new Date(payment.date).getTime() - billDate.getTime()) / (1000 * 60 * 60 * 24) : 0;
    });

    patterns.push({
      customerId: customer.id,
      customerName: customer.name,
      averagePaymentDelay: delays.reduce((sum, delay) => sum + delay, 0) / delays.length,
      totalPayments: customerPayments.length,
      preferredPaymentSize: customerPayments.reduce((sum, p) => sum + p.amount, 0) / customerPayments.length
    });
  });

  return patterns;
};

// Popular Items Tracking
export const trackPopularItems = (_timeframe: 'month' | 'quarter' | 'year' = 'month'): PopularItem[] => {
  const bills = getBills();
  const items = getItems();
  const itemStats = new Map<string, PopularItem>();

  bills.forEach(bill => {
    bill.items.forEach(item => {
      const existingStats = itemStats.get(item.id) || {
        itemId: item.id,
        itemName: items.find(i => i.id === item.id)?.name || 'Unknown Item',
        totalQuantity: 0,
        totalValue: 0,
        frequency: 0
      };

      existingStats.totalQuantity += item.quantity;
      existingStats.totalValue += item.rate * item.quantity;
      existingStats.frequency += 1;

      itemStats.set(item.id, existingStats);
    });
  });

  return Array.from(itemStats.values())
    .sort((a, b) => b.totalValue - a.totalValue);
};

// Seasonal Business Analysis
export const analyzeSeasonalTrends = (): SeasonalAnalysis[] => {
  const bills = getBills();
  const analysis: SeasonalAnalysis[] = [];

  for (let i = 0; i < 12; i++) {
    const periodStart = startOfMonth(subMonths(new Date(), i));
    const periodEnd = endOfMonth(subMonths(new Date(), i));
    const periodBills = bills.filter(bill => {
      const billDate = new Date(bill.date);
      return billDate >= periodStart && billDate <= periodEnd;
    });

    const uniqueCustomers = new Set(periodBills.map(bill => bill.customerId));
    const popularItems = trackPopularItems('month').slice(0, 5);

    analysis.push({
      month: format(periodStart, 'MMMM yyyy'),
      totalSales: periodBills.reduce((sum, bill) => sum + bill.grandTotal, 0),
      topItems: popularItems,
      customerCount: uniqueCustomers.size
    });
  }

  return analysis.reverse();
};

// Cash Flow Predictions
export const predictCashFlow = (months: number = 3): CashFlowPrediction[] => {
  const bills = getBills();
  const payments = getPayments();
  const predictions: CashFlowPrediction[] = [];

  // Simple moving average based prediction
  for (let i = 0; i < months; i++) {
    const historicalStart = subMonths(new Date(), i + 3);
    const historicalEnd = subMonths(new Date(), i);
    
    const historicalBills = bills.filter(bill => {
      const billDate = new Date(bill.date);
      return billDate >= historicalStart && billDate <= historicalEnd;
    });

    const historicalPayments = payments.filter(payment => {
      const paymentDate = new Date(payment.date);
      return paymentDate >= historicalStart && paymentDate <= historicalEnd;
    });

    const avgMonthlyBills = historicalBills.reduce((sum, bill) => sum + bill.grandTotal, 0) / 3;
    const avgMonthlyPayments = historicalPayments.reduce((sum, payment) => sum + payment.amount, 0) / 3;

    predictions.push({
      period: format(subMonths(new Date(), -i), 'MMMM yyyy'),
      predictedInflow: avgMonthlyPayments,
      predictedOutflow: avgMonthlyBills * 0.8, // Assuming 80% of bills convert to outflow
      confidence: 0.7 - (i * 0.1) // Confidence decreases with prediction distance
    });
  }

  return predictions;
};