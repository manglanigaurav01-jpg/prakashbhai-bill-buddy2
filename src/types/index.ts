
export interface Customer {
  id: string;
  name: string;
  createdAt: string;
}

export interface BillItem {
  id: string;
  itemName: string;
  quantity: number;
  rate: number;
  total: number;
}

export interface Bill {
  id: string;
  customerId: string;
  customerName: string;
  date: string;
  particulars: string;
  items: BillItem[];
  discount?: number;
  discountType?: 'percentage' | 'flat';
  grandTotal: number;
  createdAt: string;
}

export interface Payment {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  date: string;
  paymentMethod?: 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Other';
  createdAt: string;
}

export interface MonthlyBalance {
  month: string;
  year: number;
  openingBalance: number;
  bills: number;
  payments: number;
  closingBalance: number;
}

export interface CustomerBalance {
  customerId: string;
  customerName: string;
  totalSales: number;
  totalPaid: number;
  pending: number;
  monthlyBalances?: MonthlyBalance[];
  lastMonthBalance?: number;
}

export interface Customer {
  id: string;
  name: string;
  createdAt: string;
}

export interface ItemMaster {
  id: string;
  name: string;
  type: 'fixed' | 'variable';
  rate?: number; // Only for fixed-price items
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ItemRateHistory {
  id: string;
  itemId: string;
  oldRate: number;
  newRate: number;
  changedAt: string;
}

export interface ItemUsage {
  itemId: string;
  itemName: string;
  usageCount: number;
  totalQuantity: number;
  totalRevenue: number;
}

export interface BusinessAnalytics {
  version: string;
  lastUpdated: string;
  salesTrends: {
    monthly: { [key: string]: number };
    seasonal: { [key: string]: number };
  };
  customerPatterns: {
    paymentFrequency: { [customerId: string]: number };
    averageBillAmount: { [customerId: string]: number };
  };
  popularItems: {
    monthly: { [itemId: string]: number };
    overall: { [itemId: string]: number };
  };
  cashFlow: {
    predicted: { [key: string]: number };
    actual: { [key: string]: number };
  };
}

export interface RecycledItem {
  id: string;
  type: 'customer' | 'bill' | 'payment';
  data: Customer | Bill | Payment;
  deletedAt: string;
  displayName: string;
}

 