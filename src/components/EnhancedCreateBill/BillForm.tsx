import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DatePicker } from "@/components/ui/date-picker";
import { BillItem } from '@/types';
import { ItemSelector } from './ItemSelector';
import { DiscountSection } from './DiscountSection';

interface BillFormProps {
  billDate: Date;
  particulars: string;
  billItems: BillItem[];
  discount: string;
  discountType: 'percentage' | 'flat';
  isLoading: boolean;
  onBillDateChange: (date: Date) => void;
  onParticularsChange: (value: string) => void;
  onQuantityChange: (index: number, value: string) => void;
  onRateChange: (index: number, value: string) => void;
  onItemSelect: (index: number, item: any) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
  onDiscountChange: (value: string) => void;
  onDiscountTypeChange: (type: 'percentage' | 'flat') => void;
}

interface BillItemRowProps {
  item: BillItem;
  index: number;
  isLoading: boolean;
  canRemove: boolean;
  onItemSelect: (index: number, item: any) => void;
  onQuantityChange: (index: number, value: string) => void;
  onRateChange: (index: number, value: string) => void;
  onRemoveItem: (index: number) => void;
}

const BillItemRow = React.memo(({
  item,
  index,
  isLoading,
  canRemove,
  onItemSelect,
  onQuantityChange,
  onRateChange,
  onRemoveItem,
}: BillItemRowProps) => {
  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="space-y-1">
          <Label className="text-sm">Item Name</Label>
          <ItemSelector
            index={index}
            item={item}
            onItemSelect={(selectedItem) => onItemSelect(index, selectedItem)}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-12 gap-3 items-end">
          <div className="space-y-1 md:col-span-3">
            <Label className="text-sm">Quantity</Label>
            <Input
              type="number"
              value={item.quantity || ''}
              onChange={(e) => onQuantityChange(index, e.target.value)}
              placeholder="Qty"
              required
              min="0"
              step="0.01"
              aria-label={`Quantity for item ${index + 1}`}
            />
          </div>

          <div className="space-y-1 md:col-span-3">
            <Label className="text-sm">Rate</Label>
            <Input
              type="number"
              value={item.rate || ''}
              onChange={(e) => onRateChange(index, e.target.value)}
              placeholder="Rate"
              required
              min="0"
              step="0.01"
              aria-label={`Rate for item ${index + 1}`}
            />
          </div>

          <div className="space-y-1 md:col-span-4">
            <Label className="text-sm">Total</Label>
            <div
              className="p-2 bg-muted rounded-md text-sm font-medium min-h-10 flex items-center"
              aria-label={`Total for item ${index + 1}`}
              aria-live="polite"
            >
              ₹{item.total.toFixed(2)}
            </div>
          </div>

          <div className="col-span-2 md:col-span-2 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRemoveItem(index)}
              disabled={!canRemove || isLoading}
              aria-label={`Remove item ${index + 1}`}
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
});

export const BillForm: React.FC<BillFormProps> = ({
  billDate,
  particulars,
  billItems,
  discount,
  discountType,
  isLoading,
  onBillDateChange,
  onParticularsChange,
  onQuantityChange,
  onRateChange,
  onItemSelect,
  onAddItem,
  onRemoveItem,
  onDiscountChange,
  onDiscountTypeChange
}): JSX.Element => {
  const calculateSubtotal = () => {
    return billItems.reduce((total, item) => total + item.total, 0);
  };

  const calculateGrandTotal = () => {
    const subtotal = calculateSubtotal();
    const discountValue = parseFloat(discount) || 0;
    const discountAmount = discountType === 'percentage'
      ? (subtotal * discountValue / 100)
      : discountValue;
    return subtotal - discountAmount;
  };

  return (
    <div className="space-y-6">
      {/* Bill Date */}
      <div className="space-y-2">
        <Label htmlFor="billDate">Bill Date</Label>
        <DatePicker
          date={billDate}
          onDateChange={(date) => onBillDateChange(date || new Date())}
          placeholder="Select bill date"
          className="w-full"
          aria-label="Bill date selection"
        />
      </div>

      {/* Note */}
      <div className="space-y-2">
        <Label htmlFor="particulars">Note (Optional)</Label>
        <Textarea
          id="particulars"
          value={particulars}
          onChange={(e) => onParticularsChange(e.target.value)}
          placeholder="Write a note for this bill..."
          rows={2}
          aria-label="Bill note"
        />
      </div>

      {/* Items Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Items</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={onAddItem}
            disabled={isLoading}
            aria-label="Add new item"
          >
            <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
            Add Item
          </Button>
        </div>

        <div className="space-y-3">
          {billItems.map((item, index) => (
            <BillItemRow
              key={item.id}
              item={item}
              index={index}
              isLoading={isLoading}
              canRemove={billItems.length > 1}
              onItemSelect={onItemSelect}
              onQuantityChange={onQuantityChange}
              onRateChange={onRateChange}
              onRemoveItem={onRemoveItem}
            />
          ))}
        </div>
      </div>

      {/* Discount Section */}
      <DiscountSection
        discount={discount}
        discountType={discountType}
        subtotal={calculateSubtotal()}
        onDiscountChange={onDiscountChange}
        onDiscountTypeChange={onDiscountTypeChange}
      />

      {/* Grand Total */}
      <Separator />
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-muted-foreground">
            Subtotal: ₹{calculateSubtotal().toFixed(2)}
          </p>
          {(parseFloat(discount) || 0) > 0 && (
            <p className="text-sm text-destructive">
              Discount: -₹{(discountType === 'percentage'
                ? (calculateSubtotal() * parseFloat(discount) / 100)
                : parseFloat(discount)).toFixed(2)}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Grand Total</p>
          <p className="text-2xl font-bold" aria-live="polite">
            ₹{calculateGrandTotal().toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
};
