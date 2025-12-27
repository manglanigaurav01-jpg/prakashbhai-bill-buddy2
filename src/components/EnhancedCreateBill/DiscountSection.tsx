import React from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DiscountSectionProps {
  discount: string;
  discountType: 'percentage' | 'flat';
  subtotal: number;
  onDiscountChange: (value: string) => void;
  onDiscountTypeChange: (type: 'percentage' | 'flat') => void;
}

export const DiscountSection: React.FC<DiscountSectionProps> = ({
  discount,
  discountType,
  subtotal,
  onDiscountChange,
  onDiscountTypeChange
}): JSX.Element => {
  const discountValue = parseFloat(discount) || 0;
  const discountAmount = discountType === 'percentage'
    ? (subtotal * discountValue / 100)
    : discountValue;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="space-y-2">
        <Label htmlFor="discountType">Discount Type</Label>
        <Select value={discountType} onValueChange={onDiscountTypeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="percentage">Percentage (%)</SelectItem>
            <SelectItem value="flat">Flat Amount (₹)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="discountValue">
          Discount Value {discountType === 'percentage' ? '(%)' : '(₹)'}
        </Label>
        <Input
          id="discountValue"
          type="number"
          value={discount}
          onChange={(e) => onDiscountChange(e.target.value)}
          placeholder={discountType === 'percentage' ? 'Enter %' : 'Enter ₹'}
          min="0"
          step="0.01"
          aria-describedby="discountAmount"
        />
      </div>
      {discountValue > 0 && (
        <div className="space-y-2">
          <Label>Discount Amount</Label>
          <div
            className="p-2 bg-muted rounded-md text-sm font-medium"
            id="discountAmount"
            aria-live="polite"
          >
            -₹{discountAmount.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
};
