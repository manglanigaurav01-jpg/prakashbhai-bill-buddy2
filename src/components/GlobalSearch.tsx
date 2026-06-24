import { useState, useEffect } from 'react';
import { Search, X, FileText, IndianRupee, User, Package } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { getBills, getPayments, getCustomers, getItems } from '@/lib/storage';
import { globalSearch } from '@/lib/search';
import { Bill, Payment, Customer, ItemMaster } from '@/types';
import { formatDisplayDate } from '@/lib/formatters';

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: (view: string, data?: any) => void;
}

export const GlobalSearch = ({ open, onOpenChange, onNavigate }: GlobalSearchProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{
    bills: Bill[];
    payments: Payment[];
    customers: Customer[];
    items: ItemMaster[];
  }>({ bills: [], payments: [], customers: [], items: [] });

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!query.trim()) {
        setResults({ bills: [], payments: [], customers: [], items: [] });
        return;
      }

      // Limit results for performance with large datasets (300+ customers, 50+ bills)
      const bills = getBills();
      const payments = getPayments();
      const customers = getCustomers();
      const items = getItems();

      const searchResults = globalSearch(query, bills, payments, customers, items);
      
      // Limit results to prevent UI freezing with large datasets
      const MAX_RESULTS_PER_CATEGORY = 20;
      setResults({
        bills: searchResults.bills.slice(0, MAX_RESULTS_PER_CATEGORY),
        payments: searchResults.payments.slice(0, MAX_RESULTS_PER_CATEGORY),
        customers: searchResults.customers.slice(0, MAX_RESULTS_PER_CATEGORY),
        items: searchResults.items.slice(0, MAX_RESULTS_PER_CATEGORY),
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const handleClear = () => {
    setQuery('');
    setResults({ bills: [], payments: [], customers: [], items: [] });
  };

  const totalResults = 
    results.bills.length + 
    results.payments.length + 
    results.customers.length + 
    results.items.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Search Everything</DialogTitle>
        </DialogHeader>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search bills, payments, customers, items..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 pr-9"
            autoFocus
          />
          {query && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={handleClear}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <ScrollArea className="h-[400px] pr-4">
          {!query && (
            <div className="text-center py-8 text-muted-foreground">
              Start typing to search...
            </div>
          )}

          {query && totalResults === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No results found for "{query}"
            </div>
          )}

          {results.bills.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
                <FileText className="h-4 w-4" />
                Bills ({results.bills.length}{results.bills.length === 20 ? '+' : ''})
              </div>
              <div className="space-y-2">
                {results.bills.map(bill => (
                  <div
                    key={bill.id}
                    className="p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => {
                      onNavigate?.('edit-bills', bill);
                      onOpenChange(false);
                    }}
                  >
                    <div className="font-medium">{bill.customerName}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDisplayDate(bill.date)} • ₹{bill.grandTotal.toFixed(2)}
                    </div>
                    {bill.particulars && (
                      <div className="text-xs text-muted-foreground mt-1">{bill.particulars}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.payments.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
                <IndianRupee className="h-4 w-4" />
                Payments ({results.payments.length}{results.payments.length === 20 ? '+' : ''})
              </div>
              <div className="space-y-2">
                {results.payments.map(payment => (
                  <div
                    key={payment.id}
                    className="p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => {
                      onNavigate?.('edit-payments');
                      onOpenChange(false);
                    }}
                  >
                    <div className="font-medium">{payment.customerName}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDisplayDate(payment.date)} • ₹{payment.amount.toFixed(2)}
                      {payment.paymentMethod && ` • ${payment.paymentMethod}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.customers.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
                <User className="h-4 w-4" />
                Customers ({results.customers.length}{results.customers.length === 20 ? '+' : ''})
              </div>
              <div className="space-y-2">
                {results.customers.map(customer => (
                  <div
                    key={customer.id}
                    className="p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => {
                      onNavigate?.('customers');
                      onOpenChange(false);
                    }}
                  >
                    <div className="font-medium">{customer.name}</div>
                    {/* phone removed from customer display per settings */}
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.items.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
                <Package className="h-4 w-4" />
                Items ({results.items.length})
              </div>
              <div className="space-y-2">
                {results.items.map(item => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => {
                      onNavigate?.('item-master');
                      onOpenChange(false);
                    }}
                  >
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.type === 'fixed' ? `₹${item.rate}` : 'Variable price'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
