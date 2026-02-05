import React, { useState } from 'react';
import { ArrowLeft, Save, FileText, User, Package, Calculator, CheckCircle, AlertCircle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { saveBill, getBills } from '@/lib/storage';
import { generateBillPDF } from '@/lib/pdf';
import { Customer, BillItem } from '@/types';
import { CustomerSelector, BillForm } from './EnhancedCreateBill/index';
import { validateBillDateWithFutureWarning, validateLargeAmount } from '@/lib/validation';
import { hapticWarning, hapticSuccess } from '@/lib/haptics';

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

  // New state for progressive disclosure and UX improvements
  const [customerSectionOpen, setCustomerSectionOpen] = useState(true);
  const [itemsSectionOpen, setItemsSectionOpen] = useState(true);
  const [discountSectionOpen, setDiscountSectionOpen] = useState(false);
  const [formProgress, setFormProgress] = useState(0);

  // Calculate form completion progress
  React.useEffect(() => {
    let progress = 0;
    if (selectedCustomer) progress += 25;
    if (billItems.some(item => item.itemName && item.quantity > 0 && item.rate > 0)) progress += 50;
    if (billDate) progress += 25;
    setFormProgress(progress);
  }, [selectedCustomer, billItems, billDate]);

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
      const result = await generateBillPDF(savedBill, Capacitor.isNativePlatform());

      if (result.success) {
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
    <div className="min-h-screen bg-background px-4 py-4 md:px-8 md:py-6 lg:px-12 lg:py-8">
      <div className="container mx-auto max-w-5xl space-y-6">
        {/* Enhanced Header with Progress */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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
          <div className="flex items-center gap-2 self-stretch md:self-auto justify-between md:justify-end">
            <Badge variant={formProgress === 100 ? "default" : "secondary"}>
              {formProgress === 100 ? (
                <CheckCircle className="w-3 h-3 mr-1" />
              ) : (
                <AlertCircle className="w-3 h-3 mr-1" />
              )}
              {formProgress}% Complete
            </Badge>
          </div>
        </div>

        {/* Progress Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Form Progress</span>
                <span>{formProgress}%</span>
              </div>
              <Progress value={formProgress} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Customer Section */}
        <Card>
          <Collapsible open={customerSectionOpen} onOpenChange={setCustomerSectionOpen}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-primary" />
                    <div>
                      <CardTitle className="text-lg">Customer Information</CardTitle>
                      <CardDescription>
                        {selectedCustomer ? `Selected: ${selectedCustomer.name}` : 'Select or add a customer'}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={selectedCustomer ? "default" : "secondary"}>
                    {selectedCustomer ? 'Complete' : 'Required'}
                  </Badge>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="customer">Customer</Label>
                    <CustomerSelector
                      selectedCustomer={selectedCustomer}
                      onCustomerSelect={setSelectedCustomer}
                    />
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Items Section */}
        <Card>
          <Collapsible open={itemsSectionOpen} onOpenChange={setItemsSectionOpen}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Package className="w-5 h-5 text-primary" />
                    <div>
                      <CardTitle className="text-lg">Items & Pricing</CardTitle>
                      <CardDescription>
                        {billItems.filter(item => item.itemName && item.quantity > 0 && item.rate > 0).length} of {billItems.length} items completed
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={billItems.some(item => item.itemName && item.quantity > 0 && item.rate > 0) ? "default" : "secondary"}>
                    {billItems.some(item => item.itemName && item.quantity > 0 && item.rate > 0) ? 'In Progress' : 'Required'}
                  </Badge>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <BillForm
                  billDate={billDate}
                  particulars={particulars}
                  billItems={billItems}
                  discount={discount}
                  discountType={discountType}
                  isLoading={isLoading}
                  onBillDateChange={setBillDate}
                  onParticularsChange={setParticulars}
                  onQuantityChange={handleQuantityChange}
                  onRateChange={handleRateChange}
                  onItemSelect={handleItemSelect}
                  onAddItem={addNewItem}
                  onRemoveItem={removeItem}
                  onDiscountChange={setDiscount}
                  onDiscountTypeChange={setDiscountType}
                />
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Discount Section (Optional) */}
        <Card>
          <Collapsible open={discountSectionOpen} onOpenChange={setDiscountSectionOpen}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calculator className="w-5 h-5 text-primary" />
                    <div>
                      <CardTitle className="text-lg">Discount (Optional)</CardTitle>
                      <CardDescription>
                        {parseFloat(discount) > 0 ? `Applied: ${discountType === 'percentage' ? `${discount}%` : `₹${discount}`}` : 'No discount applied'}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline">
                    Optional
                  </Badge>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="text-center py-8 text-muted-foreground">
                  <Calculator className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Discount functionality is integrated in the Items section above.</p>
                  <p className="text-sm">Expand the Items section to add discounts.</p>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Summary & Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Bill Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Subtotal</p>
                <p className="text-xl font-semibold">₹{billItems.reduce((sum, item) => sum + item.total, 0).toFixed(2)}</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Discount</p>
                <p className="text-xl font-semibold text-destructive">
                  -₹{(discountType === 'percentage'
                    ? (billItems.reduce((sum, item) => sum + item.total, 0) * parseFloat(discount) / 100)
                    : parseFloat(discount)).toFixed(2)}
                </p>
              </div>
              <div className="text-center p-4 bg-primary/10 rounded-lg">
                <p className="text-sm text-muted-foreground">Grand Total</p>
                <p className="text-2xl font-bold text-primary">₹{calculateGrandTotal().toFixed(2)}</p>
              </div>
            </div>

            <Separator />

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={saveBillOnly}
                disabled={isLoading || !selectedCustomer || !billItems.some(item => item.itemName && item.quantity > 0 && item.rate > 0)}
                className="flex-1"
                size="lg"
              >
                <Save className="w-4 h-4 mr-2" />
                {isLoading ? 'Saving...' : 'Save Bill'}
              </Button>
              <Button
                onClick={saveBillAsPDF}
                disabled={isLoading || !selectedCustomer || !billItems.some(item => item.itemName && item.quantity > 0 && item.rate > 0)}
                variant="outline"
                className="flex-1"
                size="lg"
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
