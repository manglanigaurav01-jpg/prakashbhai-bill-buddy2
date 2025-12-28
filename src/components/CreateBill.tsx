import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DatePicker } from "@/components/ui/date-picker";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ArrowLeft, Plus, Trash2, FileDown, Save, Edit3, Search } from "lucide-react";
import { Capacitor } from '@capacitor/core';
import { getCustomers, saveBill, saveCustomer, getItems, saveItem } from "@/lib/storage";
import { generateBillPDF } from "@/lib/pdf";
import { Customer, BillItem } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { validateCustomerName, validateItemName, validateItemRate, validateItemQuantity, validateBillDate, validateForm, ValidationResult } from "@/lib/validation";

interface CreateBillProps {
  onNavigate: (view: 'create-bill' | 'customers' | 'balance' | 'dashboard') => void;
}

export const CreateBill = ({ onNavigate }: CreateBillProps) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomerName, setNewCustomerName] = useState("");

  const [date, setDate] = useState<Date>(new Date());
  const [particulars, setParticulars] = useState("");
  const [items, setItems] = useState<BillItem[]>([]);
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState<number | undefined>(undefined);
  const [rate, setRate] = useState<number | undefined>(undefined);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<Partial<BillItem>>({});

  // Loading and progress states
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const { toast } = useToast();

  const CustomerSearchPopover = ({
    customers,
    selectedCustomer,
    onCustomerSelect,
    onAddNew
  }: {
    customers: Customer[];
    selectedCustomer: Customer | null;
    onCustomerSelect: (customer: Customer | null) => void;
    onAddNew: (name: string) => void;
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
                      onAddNew(searchQuery);
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
    setCustomers(getCustomers());
  }, []);

  const handleAddItem = () => {
    if (!itemName || !quantity || quantity <= 0 || !rate || rate <= 0) {
      toast({
        title: "Invalid Item",
        description: "Please fill all item fields with valid values",
        variant: "destructive",
      });
      return;
    }

    // Check if item exists in item master, if not, add it
    const existingItems = getItems();
    const normalizedItemName = itemName.trim().toLowerCase();
    const itemExists = existingItems.some(item => item.name.trim().toLowerCase() === normalizedItemName);

    if (!itemExists) {
      try {
        saveItem({
          name: itemName.trim(),
          type: 'fixed',
          rate: rate,
          description: "",
        });
      } catch (error: any) {
        // If duplicate item name error, continue (item already exists)
        if (error.message !== 'DUPLICATE_ITEM_NAME') {
          console.error('Error saving item to master:', error);
        }
      }
    }

    const newItem: BillItem = {
      id: Date.now().toString(),
      itemName,
      quantity,
      rate,
      total: quantity * rate,
    };

    setItems([...items, newItem]);
    setItemName("");
    setQuantity(undefined);
    setRate(undefined);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleEditItem = (id: string) => {
    const item = items.find(i => i.id === id);
    if (item) {
      setEditingItem(id);
      setEditingValues(item);
    }
  };

  const handleSaveEdit = (id: string) => {
    if (editingValues.itemName && editingValues.quantity && editingValues.rate) {
      const updatedItems = items.map(item => 
        item.id === id 
          ? {
              ...item,
              itemName: editingValues.itemName!,
              quantity: editingValues.quantity!,
              rate: editingValues.rate!,
              total: editingValues.quantity! * editingValues.rate!,
            }
          : item
      );
      setItems(updatedItems);
      setEditingItem(null);
      setEditingValues({});
    }
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditingValues({});
  };

  const grandTotal = items.reduce((sum, item) => sum + item.total, 0);
  
  // Calculate current item total (real-time as user types)
  const currentItemTotal = (itemName && quantity && quantity > 0 && rate && rate > 0) ? quantity * rate : 0;
  
  // Total including both table items and current item being typed
  const totalWithCurrentItem = grandTotal + currentItemTotal;

  const handleCreateCustomer = () => {
    const validation = validateCustomerName(newCustomerName);
    if (!validation.isValid) {
      toast({
        title: "Invalid Customer Name",
        description: validation.errors[0],
        variant: "destructive",
      });
      return;
    }

    try {
      const customer = saveCustomer({ name: newCustomerName.trim() });
      setCustomers([...customers, customer]);
      setSelectedCustomer(customer);
      setNewCustomerName("");
      toast({
        title: "Customer Created",
        description: `${customer.name} has been added successfully`,
      });
    } catch (error: any) {
      if (error && error.message === 'DUPLICATE_CUSTOMER_NAME') {
        toast({
          title: "A customer with this name already exists",
          description: "Please use a different name",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to add customer",
          variant: "destructive",
        });
      }
    }
  };

  const handleSave = async () => {
    // Validate form data
    const validations: ValidationResult[] = [
      selectedCustomer ? { isValid: true, errors: [] } : { isValid: false, errors: ['Customer is required'] },
      validateBillDate(date)
    ];

    // Check if we have items to save
    const hasCurrentItem = itemName && quantity && rate;
    const hasTableItems = items.length > 0;

    // If we have a current item being typed, validate it
    if (hasCurrentItem) {
      validations.push(
        validateItemName(itemName),
        validateItemQuantity(quantity),
        validateItemRate(rate)
      );
    }

    // If we have table items, validate them
    if (hasTableItems) {
      items.forEach((item) => {
        validations.push(
          validateItemName(item.itemName),
          validateItemQuantity(item.quantity),
          validateItemRate(item.rate)
        );
      });
    } else if (!hasCurrentItem) {
      toast({
        title: "No Items to Save",
        description: "Please add at least one item",
        variant: "destructive",
      });
      return;
    }

    const formValidation = validateForm(validations);
    if (!formValidation.isValid) {
      toast({
        title: "Validation Error",
        description: formValidation.errors[0],
        variant: "destructive",
      });
      return;
    }

    if (!selectedCustomer) return;

    setIsSaving(true);

    try {
      // Prepare items for saving (include current item if exists and not in table)
      let itemsToSave = [...items];
      if (hasCurrentItem && !hasTableItems) {
        // If no table items but has current item, save the current item
        const currentItem: BillItem = {
          id: Date.now().toString(),
          itemName,
          quantity,
          rate,
          total: currentItemTotal,
        };
        itemsToSave = [currentItem];
      }

      // Save bill to storage
      saveBill({
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        date: date.toISOString().split('T')[0],
        particulars,
        items: itemsToSave,
        grandTotal: itemsToSave.reduce((sum, item) => sum + item.total, 0),
      });

      toast({
        title: "✅ Bill Saved Successfully!",
        description: "Bill has been saved to the system",
      });

      // Clear form after successful save
      handleClear();

    } catch (error) {
      toast({
        title: "Error Saving Bill",
        description: "Please try again or contact support",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePDF = async () => {
    if (!selectedCustomer) {
      toast({
        title: "No Customer Selected",
        description: "Please select a customer first",
        variant: "destructive",
      });
      return;
    }

    // Check if we have items in table OR a current item being typed
    const hasTableItems = items.length > 0;
    const hasCurrentItem = itemName && quantity && quantity > 0 && rate && rate > 0;
    
    if (!hasTableItems && !hasCurrentItem) {
      toast({
        title: "No Items to Save",
        description: "Please add at least one item or fill the current item fields",
        variant: "destructive",
      });
      return;
    }

    if (!selectedCustomer) return;

    setIsGeneratingPDF(true);
    setPdfProgress(0);

    try {
      // Simulate progress for better UX
      const progressSteps = [20, 40, 60, 80, 100];
      for (let i = 0; i < progressSteps.length; i++) {
        setPdfProgress(progressSteps[i]);
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Prepare items for saving (include current item if exists and not in table)
      let itemsToSave = [...items];
      if (hasCurrentItem && !hasTableItems) {
        // If no table items but has current item, save the current item
        const currentItem: BillItem = {
          id: Date.now().toString(),
          itemName,
          quantity,
          rate,
          total: currentItemTotal,
        };
        itemsToSave = [currentItem];
      }

      // Save bill to storage
      const bill = saveBill({
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        date: date.toISOString().split('T')[0],
        particulars,
        items: itemsToSave,
        grandTotal: itemsToSave.reduce((sum, item) => sum + item.total, 0),
      });

      // Generate PDF
      const pdfResult = await generateBillPDF(bill, Capacitor.isNativePlatform());

      if (pdfResult.success) {
        toast({
          title: "✅ Bill Saved Successfully!",
          description: pdfResult.message,
          className: "animate-pulse-success",
        });

        // Clear form after successful save
        handleClear();
      } else {
        toast({
          title: "Error Saving PDF",
          description: pdfResult.message,
          variant: "destructive",
        });
      }

    } catch (error) {
      toast({
        title: "Error Generating PDF",
        description: "Please try again or contact support",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
      setPdfProgress(0);
    }
  };



  const handleClear = () => {
    setSelectedCustomer(null);
    setDate(new Date());
    setParticulars("");
    setItems([]);
    setItemName("");
    setQuantity(undefined);
    setRate(undefined);

    setNewCustomerName("");
    setEditingItem(null);
    setEditingValues({});

    toast({
      title: "Form Cleared",
      description: "All fields have been reset",
    });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto animate-fade-in">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={() => onNavigate('dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Create New Bill</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bill Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Customer Selection */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer">Customer</Label>
                <CustomerSearchPopover
                  customers={customers}
                  selectedCustomer={selectedCustomer}
                  onCustomerSelect={setSelectedCustomer}
                  onAddNew={(name) => { setNewCustomerName(name); handleCreateCustomer(); }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <DatePicker
                  date={date}
                  onDateChange={(newDate) => newDate && setDate(newDate)}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="particulars">Particulars</Label>
                <Input
                  placeholder="Bill description"
                  value={particulars}
                  onChange={(e) => setParticulars(e.target.value)}
                  className="min-h-[44px] touch-manipulation"
                />
              </div>
            </div>

            {/* Items Table */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Items</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Sr No</TableHead>
                      <TableHead className="min-w-40">Item Name</TableHead>
                      <TableHead className="w-24">Quantity</TableHead>
                      <TableHead className="w-24">Rate</TableHead>
                      <TableHead className="w-24">Total</TableHead>
                      <TableHead className="w-32">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          {editingItem === item.id ? (
                            <Input
                              value={editingValues.itemName || item.itemName}
                              onChange={(e) => setEditingValues({...editingValues, itemName: e.target.value})}
                              className="min-h-[36px]"
                            />
                          ) : (
                            item.itemName
                          )}
                        </TableCell>
                        <TableCell>
                          {editingItem === item.id ? (
                            <Input
                              type="number"
                              value={editingValues.quantity || item.quantity}
                              onChange={(e) => setEditingValues({...editingValues, quantity: Number(e.target.value)})}
                              className="min-h-[36px]"
                            />
                          ) : (
                            item.quantity
                          )}
                        </TableCell>
                        <TableCell>
                          {editingItem === item.id ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={editingValues.rate || item.rate}
                              onChange={(e) => setEditingValues({...editingValues, rate: Number(e.target.value)})}
                              className="min-h-[36px]"
                            />
                          ) : (
                            `₹${item.rate.toFixed(2)}`
                          )}
                        </TableCell>
                        <TableCell>₹{item.total.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {editingItem === item.id ? (
                              <>
                                 <Button
                                   variant="outline"
                                   size="sm"
                                   onClick={() => handleSaveEdit(item.id)}
                                   className="min-h-[36px] touch-manipulation"
                                 >
                                   ✓
                                 </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleCancelEdit}
                                  className="min-h-[36px] touch-manipulation"
                                >
                                  ×
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditItem(item.id)}
                                  className="min-h-[36px] touch-manipulation"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleRemoveItem(item.id)}
                                  className="min-h-[36px] touch-manipulation"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Add Item Form */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Item Name</Label>
                    <Input
                      placeholder="Item name"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      className="min-h-[44px] touch-manipulation"
                    />
                  </div>
                   <div className="space-y-2">
                     <Label>Quantity</Label>
                     <Input
                       type="number"
                       min="1"
                       placeholder="Enter quantity"
                       value={quantity || ''}
                       onChange={(e) => setQuantity(e.target.value ? Number(e.target.value) : undefined)}
                       className="min-h-[44px] touch-manipulation"
                     />
                   </div>
                   <div className="space-y-2">
                     <Label>Rate (₹)</Label>
                     <Input
                       type="number"
                       min="0"
                       step="0.01"
                       placeholder="Enter rate"
                       value={rate || ''}
                       onChange={(e) => setRate(e.target.value ? Number(e.target.value) : undefined)}
                       className="min-h-[44px] touch-manipulation"
                     />
                   </div>
                  <div className="space-y-2">
                    <Label>Current Total</Label>
                    <div className="min-h-[44px] flex items-center px-3 bg-muted rounded-md font-semibold text-accent">
                      ₹{currentItemTotal.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button 
                    onClick={handleAddItem} 
                    className="flex-1 min-h-[44px] touch-manipulation"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add to Table
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* PDF Generation Progress */}
            {isGeneratingPDF && (
              <Card className="animate-fade-in">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <LoadingSpinner />
                      <span className="font-medium">Generating PDF...</span>
                    </div>
                    <ProgressBar 
                      progress={pdfProgress} 
                      showLabel 
                      label="PDF Generation Progress"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Grand Total and Actions */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-6 border-t">
              <div className="text-2xl font-bold animate-pulse-success">
                Grand Total: ₹{totalWithCurrentItem.toFixed(2)}
                {currentItemTotal > 0 && items.length > 0 && (
                  <div className="text-sm font-normal text-muted-foreground">
                    (Table: ₹{grandTotal.toFixed(2)} + Current: ₹{currentItemTotal.toFixed(2)})
                  </div>
                )}
              </div>
               <div className="flex flex-wrap gap-2">
                 <Button 
                   onClick={handleSave}
                   disabled={(!items.length && !currentItemTotal) || !selectedCustomer || isSaving}
                   className="min-h-[44px] touch-manipulation"
                 >
                   {isSaving ? (
                     <LoadingSpinner size="sm" className="mr-2" />
                   ) : (
                     <Save className="w-4 h-4 mr-2" />
                   )}
                   {isSaving ? 'Saving...' : 'Save Bill'}
                 </Button>
                 <Button 
                   variant="outline" 
                   onClick={handleClear}
                   className="min-h-[44px] touch-manipulation"
                 >
                   Clear
                 </Button>
                 <Button 
                   onClick={handleSavePDF} 
                   disabled={(!items.length && !currentItemTotal) || !selectedCustomer || isGeneratingPDF}
                   className="min-h-[44px] touch-manipulation"
                 >
                   {isGeneratingPDF ? (
                     <LoadingSpinner size="sm" className="mr-2" />
                   ) : (
                     <FileDown className="w-4 h-4 mr-2" />
                   )}
                   {isGeneratingPDF ? 'Generating...' : 'Save as PDF'}
                 </Button>
               </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};