import { useState, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  getItemUsageAnalytics, 
  getMostUsedItems,
} from '@/lib/storage';
import { ItemMaster as ItemMasterType, ItemUsage } from '@/types';

interface ItemAnalyticsProps {
    items: ItemMasterType[];
    showAnalytics: boolean;
}

export const ItemAnalytics: React.FC<ItemAnalyticsProps> = ({ items, showAnalytics }) => {
    const [analytics, setAnalytics] = useState<ItemUsage[]>([]);
    const [mostUsed, setMostUsed] = useState<ItemUsage[]>([]);
  
    useEffect(() => {
      if (showAnalytics) {
        const analyticsData = getItemUsageAnalytics();
        const mostUsedData = getMostUsedItems(5);
        setAnalytics(analyticsData);
        setMostUsed(mostUsedData);
      }
    }, [showAnalytics, getItemUsageAnalytics, getMostUsedItems]);
  
    const totalItems = analytics.length;
    const fixedPriceItems = items.filter(item => item.type === 'fixed').length;
    const variablePriceItems = items.filter(item => item.type === 'variable').length;
    const totalRevenue = analytics.reduce((sum, item) => sum + item.totalRevenue, 0);
  
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{totalItems}</div>
              <p className="text-sm text-muted-foreground">Total Items</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{fixedPriceItems}</div>
              <p className="text-sm text-muted-foreground">Fixed Price</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{variablePriceItems}</div>
              <p className="text-sm text-muted-foreground">Variable Price</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-purple-600">₹{totalRevenue.toFixed(2)}</div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
            </CardContent>
          </Card>
        </div>
  
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Most Used Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mostUsed.map((item, index) => (
                <div key={item.itemId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{item.itemName}</p>
                      <p className="text-sm text-muted-foreground">
                        Used {item.usageCount} times • Qty: {item.totalQuantity}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">₹{item.totalRevenue.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">Revenue</p>
                  </div>
                </div>
              ))}
              {mostUsed.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No usage data available</p>
              )}
            </div>
          </CardContent>
        </Card>
  
        <Card>
          <CardHeader>
            <CardTitle>All Items Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.map((item) => (
                <div key={item.itemId} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded">
                  <div className="flex-1">
                    <p className="font-medium">{item.itemName}</p>
                  </div>
                  <div className="flex gap-6 text-sm text-muted-foreground">
                    <span>Uses: {item.usageCount}</span>
                    <span>Qty: {item.totalQuantity}</span>
                    <span className="font-medium">₹{item.totalRevenue.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };
  