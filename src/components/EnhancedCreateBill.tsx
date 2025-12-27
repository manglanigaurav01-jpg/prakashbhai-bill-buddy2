import React, { useState } from 'react';
import { ArrowLeft, Save, FileText } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { saveBill } from '@/lib/storage';
import { generateBillPDF } from '@/lib/pdf';
import { Customer, BillItem } from '@/types';
import { CustomerSelector, BillForm } from './EnhancedCreateBill/index';

interface CreateBillProps {
  onNavigate: (view: string) => void;
}

export const EnhancedCreateBill: React.FC<CreateBillProps> = ({ onNavigate }) => {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [billDate, setBillDate] = useState<Date>(new Date());
  const [particulars, setParticulars] = useState('');
  const [billItems, setBillItems] = useState<BillItem[]>([
    { id: '1', itemName: '', quantity: 0, rate: 0, total: 0 }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [discount, setDiscount] = useState<string>('');
  const [discountType, setDiscountType] = useState<'percentage' | 'flat'>('percentage');

  const handleItemNameChange = (index: number, value: string) => {
    const updatedItems = [...billItems];
    updatedItems[index].itemName = value;
    setBillItems(updatedItems);
  };

  const handleQuantityChange = (index: number, value: string) => {
    const quantity = parseFloat(value) || 0;
    const updatedItems = [...billItems];
    updatedItems[index].quantity = quantity;
    updatedItems[index].total = quantity * updatedItems[index].rate;
    setBillItems(updatedItems);
  };

  const handleRateChange = (index: number, value: string) => {
    const rate = parseFloat(value) || 0;
    const updatedItems = [...billItems];
    updatedItems[index].rate = rate;
    updatedItems[index].total = updatedItems[index].quantity * rate;
    setBillItems(updatedItems);
  };

  const handleItemSelect = (index: number, item: any) => {
    const updatedItems = [...billItems];
    updatedItems[index] = {
      ...updatedItems[index],
      itemName: item.name,
      rate: item.type === 'fixed' && item.rate ? item.rate : updatedItems[index].rate,
      total: item.type === 'fixed' && item.rate ? updatedItems[index].quantity * item.rate : updatedItems[index].total
    };
    setBillItems(updatedItems);
  };

  const addNewItem = () => {
    const newItem: BillItem = {
      id: Date.now().toString(),
      itemName: '',
      quantity: 0,
      rate: 0,
      total: 0
    };
    setBillItems([...billItems, newItem]);
  };

  const removeItem = (index: number) => {
    if (billItems.length > 1) {
      setBillItems(billItems.filter((_, i) => i !== index));
    }
  };

  const calculateGrandTotal = () => {
    const subtotal = billItems.reduce((total, item) => total + item.total, 0);
    const discountValue = parseFloat(discount) || 0;
    const discountAmount = discountType === 'percentage'
      ? (subtotal * discountValue / 100)
      : discountValue;
    return subtotal - discountAmount;
  };

  const validateBill = () => {
    if (!selectedCustomer) {
      toast({
        title: "Error",
        description: "Please select a customer",
        variant: "destructive"
      });
      return false;
    }

    const invalidItems = billItems.filter(item =>
      !item.itemName.trim() || item.quantity <= 0 || item.rate <= 0
    );

    if (invalidItems.length > 0) {
      toast({
        title: "Error",
        description: "Please fill in all item details with valid values",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const saveBillOnly = async () => {
    if (!validateBill()) return;

    // Validate date with future warning
    const { validateBillDateWithFutureWarning, validateLargeAmount } = await import('@/lib/validation');
    const { getBills } = await import('@/lib/storage');
    const { hapticWarning } = await import('@/lib/haptics');

    const dateValidation = validateBillDateWithFutureWarning(billDate);
    if (dateValidation.warning) {
      toast({
        title: "Date Warning",
        description: dateValidation.warning,
        variant: "default",
      });
      hapticWarning();
    }

    // Validate amount with large amount warning
    const allBills = getBills();
    const billAmounts = allBills.map(b => b.grandTotal);
    const grandTotal = calculateGrandTotal();
    const amountValidation = validateLargeAmount(grandTotal, 'bill', { bills: billAmounts });
    if (amountValidation.warning) {
      toast({
        title: "Amount Warning",
        description: amountValidation.warning,
        variant: "default",
      });
      hapticWarning();
    }

    setIsLoading(true);
    try {
      const discountValue = parseFloat(discount) || 0;
      const billData = {
        customerId: selectedCustomer!.id,
        customerName: selectedCustomer!.name,
        date: billDate.toISOString().split('T')[0],
        particulars,
        items: billItems,
        ...(discountValue > 0 && { discount: discountValue, discountType }),
        grandTotal: calculateGrandTotal(),
      };

      saveBill(billData);

      const { hapticSuccess } = await import('@/lib/haptics');
      hapticSuccess();

      toast({
        title: "Success",
        description: "Bill saved successfully"
      });

      // Reset form
      setSelectedCustomer(null);
      setBillDate(new Date());
      setParticulars('');
      setBillItems([{ id: '1', itemName: '', quantity: 0, rate: 0, total: 0 }]);
      setDiscount('');
      setDiscountType('percentage');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save bill. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveBillAsPDF = async () => {
    if (!validateBill()) return;

    // Validate date with future warning
    const { validateBillDateWithFutureWarning, validateLargeAmount } = await import('@/lib/validation');
    const { getBills } = await import('@/lib/storage');
    const { hapticWarning } = await import('@/lib/haptics');

    const dateValidation = validateBillDateWithFutureWarning(billDate);
    if (dateValidation.warning) {
      toast({
        title: "Date Warning",
        description: dateValidation.warning,
        variant: "default",
      });
      hapticWarning();
    }

    // Validate amount with large amount warning
    const allBills = getBills();
    const billAmounts = allBills.map(b => b.grandTotal);
    const grandTotal = calculateGrandTotal();
    const amountValidation = validateLargeAmount(grandTotal, 'bill', { bills: billAmounts });
    if (amountValidation.warning) {
      toast({
        title: "Amount Warning",
        description: amountValidation.warning,
        variant: "default",
      });
      hapticWarning();
    }

    setIsLoading(true);
    try {
      const discountValue = parseFloat(discount) || 0;
      const billData = {
        customerId: selectedCustomer!.id,
        customerName: selectedCustomer!.name,
        date: billDate.toISOString().split('T')[0],
        particulars,
        items: billItems,
        ...(discountValue > 0 && { discount: discountValue, discountType }),
        grandTotal: calculateGrandTotal(),
      };

      const savedBill = saveBill(billData);
      const result = await generateBillPDF(savedBill);

      if (result.success) {
        const { hapticSuccess } = await import('@/lib/haptics');
        hapticSuccess();
        toast({
          title: "Success",
          description: result.message
        });

        // Reset form
        setSelectedCustomer(null);
        setBillDate(new Date());
        setParticulars('');
        setBillItems([{ id: '1', itemName: '', quantity: 0, rate: 0, total: 0 }]);
        setDiscount('');
        setDiscountType('percentage');
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('dashboard')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Create Bill</h1>
            <p className="text-muted-foreground">Create a new bill with smart item selection</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bill Details</CardTitle>
            <CardDescription>Fill in the customer and item information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Customer Selection */}
            <div className="space-y-2">
              <Label htmlFor="customer">Customer</Label>
              <CustomerSelector
                selectedCustomer={selectedCustomer}
                onCustomerSelect={setSelectedCustomer}
                onAddNew={() => {}}
              />
            </div>

            {/* Bill Form */}
            <BillForm
              billDate={billDate}
              particulars={particulars}
              billItems={billItems}
              discount={discount}
              discountType={discountType}
              isLoading={isLoading}
              onBillDateChange={setBillDate}
              onParticularsChange={setParticulars}
              onItemNameChange={handleItemNameChange}
              onQuantityChange={handleQuantityChange}
              onRateChange={handleRateChange}
              onItemSelect={handleItemSelect}
              onAddItem={addNewItem}
              onRemoveItem={removeItem}
              onDiscountChange={setDiscount}
              onDiscountTypeChange={setDiscountType}
            />

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={saveBillOnly}
                disabled={isLoading}
                className="flex-1"
              >
                <Save className="w-4 h-4 mr-2" />
                {isLoading ? 'Saving...' : 'Save Bill'}
              </Button>
              <Button
                onClick={saveBillAsPDF}
                disabled={isLoading}
                variant="outline"
                className="flex-1"
              >
                <FileText className="w-4 h-4 mr-2" />
                {isLoading ? 'Generating...' : 'Save as PDF'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
