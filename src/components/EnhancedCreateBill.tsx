import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Plus, Search, Trash2, Save, FileText } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "@/hooks/use-toast";
import { getCustomers, saveBill, getItems, saveItem, searchItems, getMostUsedItems, saveCustomer } from '@/lib/storage';
import { generateBillPDF } from '@/lib/pdf';
import { Customer, BillItem, ItemMaster } from '@/types';

interface CreateBillProps {
  onNavigate: (view: string) => void;
}

export const EnhancedCreateBill: React.FC<CreateBillProps> = ({ onNavigate }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [billDate, setBillDate] = useState<Date>(new Date());
  const [particulars, setParticulars] = useState('');
  const [billItems, setBillItems] = useState<BillItem[]>([
    { id: '1', itemName: '', quantity: 0, rate: 0, total: 0 }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [availableItems, setAvailableItems] = useState<ItemMaster[]>([]);
  const [mostUsedItems, setMostUsedItems] = useState<any[]>([]);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [newItemData, setNewItemData] = useState({
    name: '',
    type: 'variable' as 'fixed' | 'variable',
    rate: ''
  });
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [discount, setDiscount] = useState<string>('');
  const [discountType, setDiscountType] = useState<'percentage' | 'flat'>('percentage');

  // @ts-expect-error - Intentionally unused, kept for future use
  const _itemInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const CustomerSearchPopover = ({
    customers,
    selectedCustomer,
    onCustomerSelect,
    onAddNew
  }: {
    customers: Customer[];
    selectedCustomer: Customer | null;
    onCustomerSelect: (customer: Customer | null) => void;
    onAddNew: () => void;
  }) => {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredCustomers = searchQuery
      ? customers.filter(customer =>
          customer.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : customers;

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              value={selectedCustomer?.name || searchQuery}
              onChange={(e) => {
                const value = e.target.value;
                setSearchQuery(value);
                if (value && !open) setOpen(true);
                // Clear selection if user is typing
                if (selectedCustomer && value !== selectedCustomer.name) {
                  onCustomerSelect(null);
                }
              }}
              placeholder="Search or type customer name..."
              className="pr-10"
              required
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1">
              <Search className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search customers..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              {filteredCustomers.length > 0 && (
                <CommandGroup heading="Customers">
                  {filteredCustomers.map((customer) => (
                    <CommandItem
                      key={customer.id}
                      onSelect={() => {
                        onCustomerSelect(customer);
                        setOpen(false);
                        setSearchQuery('');
                      }}
                    >
                      <span>{customer.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {searchQuery && !filteredCustomers.some(customer => customer.name.toLowerCase() === searchQuery.toLowerCase()) && (
                <CommandGroup heading="Actions">
                  <CommandItem
                    onSelect={() => {
                      onAddNew();
                      setOpen(false);
                      setSearchQuery('');
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add "{searchQuery}" as new customer
                  </CommandItem>
                </CommandGroup>
              )}

              {filteredCustomers.length === 0 && !searchQuery && (
                <CommandEmpty>Start typing to search customers...</CommandEmpty>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  useEffect(() => {
    loadCustomers();
    loadItems();
    loadMostUsedItems();
  }, []);

  const loadCustomers = () => {
    const loadedCustomers = getCustomers();
    setCustomers(loadedCustomers);
  };

  const loadItems = () => {
    const items = getItems();
    setAvailableItems(items);
  };

  const loadMostUsedItems = () => {
    const mostUsed = getMostUsedItems(5);
    setMostUsedItems(mostUsed);
  };

  const searchAvailableItems = (query: string) => {
    // debounce/sync wrapper handled by callers; keep function thin
    return searchItems(query);
  };

  const handleItemSelect = (index: number, item: ItemMaster) => {
    const updatedItems = [...billItems];
    updatedItems[index] = {
      ...updatedItems[index],
      itemName: item.name,
      rate: item.type === 'fixed' && item.rate ? item.rate : 0,
      total: item.type === 'fixed' && item.rate ? updatedItems[index].quantity * item.rate : 0
    };
    setBillItems(updatedItems);
    setActiveItemIndex(null);
  };

  // @ts-expect-error - Intentionally unused, kept for future use
  const _handleQuickItemSelect = (index: number, itemName: string) => {
    const existingItem = availableItems.find(item => item.name === itemName);
    if (existingItem) {
      handleItemSelect(index, existingItem);
    }
  };

  const handleAddNewItem = () => {
    if (!newItemData.name.trim()) {
      toast({
        title: "Error",
        description: "Item name is required",
        variant: "destructive"
      });
      return;
    }

    if (newItemData.type === 'fixed' && (!newItemData.rate || parseFloat(newItemData.rate) <= 0)) {
      toast({
        title: "Error", 
        description: "Rate is required for fixed-price items",
        variant: "destructive"
      });
      return;
    }

    const itemToSave = {
      name: newItemData.name.trim(),
      type: newItemData.type,
      ...(newItemData.type === 'fixed' && { rate: parseFloat(newItemData.rate) })
    };

    try {
      const savedItem = saveItem(itemToSave);
      loadItems();

    // Add to current bill if there's an active item index
    if (activeItemIndex !== null) {
      handleItemSelect(activeItemIndex, savedItem);
    }

      setNewItemData({ name: '', type: 'variable', rate: '' });
      setShowAddItemDialog(false);
      
      toast({
        title: "Success",
        description: "Item added to master and available for selection"
      });
    } catch (error: any) {
      if (error && error.message === 'DUPLICATE_ITEM_NAME') {
        toast({
          title: "An item with this name already exists",
          description: "Please use a different name",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to add item",
          variant: "destructive"
        });
      }
    }
  };

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

  const getDiscountAmount = () => {
    const subtotal = billItems.reduce((total, item) => total + item.total, 0);
    const discountValue = parseFloat(discount) || 0;
    return discountType === 'percentage' 
      ? (subtotal * discountValue / 100)
      : discountValue;
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


  const ItemSearchPopover = ({ index, item }: { index: number, item: BillItem }) => {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const searchResults = searchQuery ? searchAvailableItems(searchQuery) : [];
    const isExistingItem = availableItems.find(availItem => availItem.name === item.itemName);

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              value={item.itemName}
              onChange={(e) => {
                handleItemNameChange(index, e.target.value);
                setSearchQuery(e.target.value);
                setActiveItemIndex(index);
                if (e.target.value && !open) setOpen(true);
              }}
              placeholder="Search or type item name..."
              className="pr-10"
              required
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1">
              {isExistingItem && (
                <Badge variant="outline" className="text-xs">
                  {isExistingItem.type === 'fixed' ? '₹' : '📝'}
                </Badge>
              )}
              <Search className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search items..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              {searchResults.length > 0 && (
                <CommandGroup heading="Available Items">
                  {searchResults.map((availItem) => (
                    <CommandItem
                      key={availItem.id}
                      onSelect={() => {
                        handleItemSelect(index, availItem);
                        setOpen(false);
                        setSearchQuery('');
                      }}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <Badge variant={availItem.type === 'fixed' ? 'default' : 'secondary'}>
                            {availItem.type === 'fixed' ? '₹' : '📝'}
                          </Badge>
                          <span>{availItem.name}</span>
                        </div>
                        {availItem.type === 'fixed' && availItem.rate && (
                          <span className="text-sm font-medium">₹{availItem.rate}</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {mostUsedItems.length > 0 && !searchQuery && (
                <CommandGroup heading="Most Used Items">
                  {mostUsedItems.map((mostUsedItem) => {
                    const masterItem = availableItems.find(item => item.name === mostUsedItem.itemName);
                    return (
                      <CommandItem
                        key={mostUsedItem.itemId}
                        onSelect={() => {
                          if (masterItem) {
                            handleItemSelect(index, masterItem);
                          } else {
                            handleItemNameChange(index, mostUsedItem.itemName);
                          }
                          setOpen(false);
                          setSearchQuery('');
                        }}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            {masterItem && (
                              <Badge variant={masterItem.type === 'fixed' ? 'default' : 'secondary'}>
                                {masterItem.type === 'fixed' ? '₹' : '📝'}
                              </Badge>
                            )}
                            <span>{mostUsedItem.itemName}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            Used {mostUsedItem.usageCount}x
                          </span>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

              {searchQuery && !searchResults.some(item => item.name.toLowerCase() === searchQuery.toLowerCase()) && (
                <CommandGroup heading="Actions">
                  <CommandItem
                    onSelect={() => {
                      setActiveItemIndex(index);
                      setNewItemData({ ...newItemData, name: searchQuery });
                      setShowAddItemDialog(true);
                      setOpen(false);
                      setSearchQuery('');
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add "{searchQuery}" as new item
                  </CommandItem>
                </CommandGroup>
              )}

              {searchResults.length === 0 && !searchQuery && (
                <CommandEmpty>Start typing to search items...</CommandEmpty>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
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
              <CustomerSearchPopover
                customers={customers}
                selectedCustomer={selectedCustomer}
                onCustomerSelect={(customer) => setSelectedCustomer(customer)}
                onAddNew={() => setShowNewCustomerDialog(true)}
              />
            </div>

            {/* Bill Date */}
            <div className="space-y-2">
              <Label htmlFor="billDate">Bill Date</Label>
              <DatePicker
                date={billDate}
                onDateChange={(date) => setBillDate(date || new Date())}
                placeholder="Select bill date"
                className="w-full"
              />
            </div>

            {/* Particulars */}
            <div className="space-y-2">
              <Label htmlFor="particulars">Particulars (Optional)</Label>
              <Textarea
                id="particulars"
                value={particulars}
                onChange={(e) => setParticulars(e.target.value)}
                placeholder="Enter bill particulars..."
                rows={2}
              />
            </div>

            {/* Items Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Items</Label>
                <Button variant="outline" size="sm" onClick={addNewItem}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>

              <div className="space-y-3">
                {billItems.map((item, index) => (
                  <Card key={item.id} className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                      {/* Item Name with Search */}
                      <div className="md:col-span-4 space-y-1">
                        <Label className="text-sm">Item Name</Label>
                        <ItemSearchPopover index={index} item={item} />
                      </div>

                      {/* Quantity */}
                      <div className="md:col-span-2 space-y-1">
                        <Label className="text-sm">Quantity</Label>
                        <Input
                          type="number"
                          value={item.quantity || ''}
                          onChange={(e) => handleQuantityChange(index, e.target.value)}
                          placeholder="Qty"
                          required
                          min="0"
                          step="0.01"
                        />
                      </div>

                      {/* Rate */}
                      <div className="md:col-span-2 space-y-1">
                        <Label className="text-sm">Rate</Label>
                        <Input
                          type="number"
                          value={item.rate || ''}
                          onChange={(e) => handleRateChange(index, e.target.value)}
                          placeholder="Rate"
                          required
                          min="0"
                          step="0.01"
                        />
                      </div>

                      {/* Total */}
                      <div className="md:col-span-2 space-y-1">
                        <Label className="text-sm">Total</Label>
                        <div className="p-2 bg-muted rounded-md text-sm font-medium">
                          ₹{item.total.toFixed(2)}
                        </div>
                      </div>

                      {/* Remove Button */}
                      <div className="md:col-span-2 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeItem(index)}
                          disabled={billItems.length === 1}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Discount Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <Select value={discountType} onValueChange={(value: 'percentage' | 'flat') => setDiscountType(value)}>
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
                <Label>Discount Value</Label>
                <Input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder={discountType === 'percentage' ? 'Enter %' : 'Enter ₹'}
                  min="0"
                  step="0.01"
                />
              </div>
              {(parseFloat(discount) || 0) > 0 && (
                <div className="space-y-2">
                  <Label>Discount Amount</Label>
                  <div className="p-2 bg-muted rounded-md text-sm font-medium">
                    -₹{getDiscountAmount().toFixed(2)}
                  </div>
                </div>
              )}
            </div>

            {/* Grand Total */}
            <Separator />
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Subtotal: ₹{billItems.reduce((total, item) => total + item.total, 0).toFixed(2)}</p>
                {(parseFloat(discount) || 0) > 0 && (
                  <p className="text-sm text-destructive">Discount: -₹{getDiscountAmount().toFixed(2)}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Grand Total</p>
                <p className="text-2xl font-bold">₹{calculateGrandTotal().toFixed(2)}</p>
              </div>
            </div>

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

      {/* Add New Customer Dialog */}
      <Dialog open={showNewCustomerDialog} onOpenChange={setShowNewCustomerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>Enter the customer name to add them to your list</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="newCustomerName">Customer Name</Label>
              <Input
                id="newCustomerName"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Enter customer name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowNewCustomerDialog(false);
                setNewCustomerName('');
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (newCustomerName.trim()) {
                  try {
                    const savedCustomer = saveCustomer({ name: newCustomerName.trim() });
                    setSelectedCustomer(savedCustomer);
                    loadCustomers();
                    setNewCustomerName('');
                    setShowNewCustomerDialog(false);
                    toast({
                      title: "Success",
                      description: "Customer added successfully"
                    });
                  } catch (error: any) {
                    if (error && error.message === 'DUPLICATE_CUSTOMER_NAME') {
                      toast({
                        title: "A customer with this name already exists",
                        description: "Please use a different name",
                        variant: "destructive"
                      });
                    } else {
                      toast({
                        title: "Error",
                        description: "Failed to add customer",
                        variant: "destructive"
                      });
                    }
                  }
                }
              }}
            >
              Add Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add New Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Item</DialogTitle>
            <DialogDescription>Add this item to your master list</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Item Name</Label>
              <Input
                value={newItemData.name}
                onChange={(e) => setNewItemData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter item name"
              />
            </div>
            <div>
              <Label>Price Type</Label>
              <Select 
                value={newItemData.type} 
                onValueChange={(value) => setNewItemData(prev => ({ 
                  ...prev, 
                  type: value as 'fixed' | 'variable',
                  ...(value === 'variable' && { rate: '' })
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">₹ Fixed Price</SelectItem>
                  <SelectItem value="variable">📝 Variable Price</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newItemData.type === 'fixed' && (
              <div>
                <Label>Default Rate</Label>
                <Input
                  type="number"
                  value={newItemData.rate}
                  onChange={(e) => setNewItemData(prev => ({ ...prev, rate: e.target.value }))}
                  placeholder="Enter default rate"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddItemDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddNewItem}>Add to Master</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};