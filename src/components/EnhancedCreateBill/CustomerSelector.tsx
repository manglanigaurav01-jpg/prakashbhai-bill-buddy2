import React, { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Customer } from '@/types';
import { getCustomers, saveCustomer } from '@/lib/storage';
import { validateCustomerName } from '@/lib/validation';
import { toast } from "@/hooks/use-toast";

interface CustomerSelectorProps {
  selectedCustomer: Customer | null;
  onCustomerSelect: (customer: Customer | null) => void;
}

export const CustomerSelector: React.FC<CustomerSelectorProps> = ({
  selectedCustomer,
  onCustomerSelect
}): JSX.Element => {
  const [customers] = useState<Customer[]>(() => getCustomers());
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCustomers = searchQuery
    ? customers.filter(customer =>
        customer.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : customers;

  const handleCustomerSelect = (customer: Customer) => {
    onCustomerSelect(customer);
    setOpen(false);
    setSearchQuery('');
  };

  const handleAddNewCustomer = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Error",
        description: "Please enter a customer name",
        variant: "destructive"
      });
      return;
    }

    const validation = validateCustomerName(searchQuery.trim());
    if (!validation.isValid) {
      toast({
        title: "Error",
        description: validation.errors[0],
        variant: "destructive"
      });
      return;
    }

    try {
      const newCustomer = saveCustomer({ name: validation.sanitizedValue });
      onCustomerSelect(newCustomer);
      setOpen(false);
      setSearchQuery('');
      toast({
        title: "Success",
        description: "Customer added successfully"
      });
    } catch (error: any) {
      if (error.message === 'DUPLICATE_CUSTOMER_NAME') {
        toast({
          title: "Customer already exists",
          description: "Please select from the list or use a different name",
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
  };

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
            aria-label="Customer selection"
            aria-expanded={open}
            aria-haspopup="listbox"
          />
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1">
            <Search className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
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
                    onSelect={() => handleCustomerSelect(customer)}
                    role="option"
                    aria-selected={selectedCustomer?.id === customer.id}
                  >
                    <span>{customer.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {searchQuery && !filteredCustomers.some(customer =>
              customer.name.toLowerCase() === searchQuery.toLowerCase()
            ) && (
              <CommandGroup heading="Actions">
                <CommandItem
                  onSelect={handleAddNewCustomer}
                  role="option"
                >
                  <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
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
