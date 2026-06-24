import React, { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Customer } from '@/types';
import { getCustomers, saveCustomer } from '@/lib/storage';
import { validateCustomerName } from '@/lib/validation';
import { toast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

interface CustomerSelectorProps {
  selectedCustomer: Customer | null;
  onCustomerSelect: (customer: Customer | null) => void;
}

export const CustomerSelector: React.FC<CustomerSelectorProps> = ({
  selectedCustomer,
  onCustomerSelect
}): JSX.Element => {
  const [customers, setCustomers] = useState<Customer[]>(() => getCustomers());
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const blurCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
  const normalizedSearchQuery = normalizeText(debouncedQuery);

  const refreshCustomers = useCallback(() => setCustomers(getCustomers()), []);

  useEffect(() => {
    return () => {
      if (blurCloseTimer.current) clearTimeout(blurCloseTimer.current);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 120);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const displayValue =
    searchQuery !== '' || !selectedCustomer ? searchQuery : (selectedCustomer?.name ?? '');

  const filteredCustomers = normalizedSearchQuery
    ? customers.filter((customer) =>
        normalizeText(customer.name).includes(normalizedSearchQuery)
      )
    : [];

  const showAdd =
    !!normalizedSearchQuery &&
    !customers.some((c) => normalizeText(c.name) === normalizedSearchQuery);

  const handleCustomerSelect = (customer: Customer) => {
    if (blurCloseTimer.current) {
      clearTimeout(blurCloseTimer.current);
      blurCloseTimer.current = null;
    }
    onCustomerSelect(customer);
    setOpen(false);
    setSearchQuery('');
  };

  const handleAddNewCustomer = async () => {
    if (blurCloseTimer.current) {
      clearTimeout(blurCloseTimer.current);
      blurCloseTimer.current = null;
    }
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
      refreshCustomers();
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

  const listOpen = open && (!!normalizedSearchQuery || filteredCustomers.length > 0 || showAdd);

  return (
    <div className="relative z-10">
      <Input
        value={displayValue}
        onChange={(e) => {
          const value = e.target.value;
          setSearchQuery(value);
          if (value) {
            setOpen(true);
            refreshCustomers();
          } else {
            setOpen(false);
          }
          if (selectedCustomer && value !== selectedCustomer.name) {
            startTransition(() => onCustomerSelect(null));
          }
        }}
        onFocus={() => {
          refreshCustomers();
          setSearchQuery(selectedCustomer?.name ?? '');
          if (selectedCustomer) setOpen(true);
        }}
        onBlur={() => {
          blurCloseTimer.current = setTimeout(() => setOpen(false), 180);
        }}
        placeholder="Search or type customer name..."
        className="pr-10"
        required
        aria-label="Customer selection"
        aria-expanded={listOpen}
        aria-haspopup="listbox"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
        <Search className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
      </div>

      {listOpen && (
        <div
          className={cn(
            "absolute left-0 top-full z-[100] mt-1 w-80 max-w-[min(100%,20rem)]",
            "rounded-md border bg-popover p-0 text-popover-foreground shadow-md outline-none",
            "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200"
          )}
          role="listbox"
        >
          <Command shouldFilter={false} className="rounded-md border-0 bg-transparent shadow-none">
            <CommandList className="max-h-[min(18rem,50vh)]">
              {filteredCustomers.length > 0 && (
                <CommandGroup heading="Customers">
                  {filteredCustomers.map((customer) => (
                    <CommandItem
                      key={customer.id}
                      value={customer.id + customer.name}
                      onSelect={() => handleCustomerSelect(customer)}
                      onPointerDown={(e) => e.preventDefault()}
                      className="cursor-pointer py-2"
                    >
                      <span className="truncate">{customer.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {showAdd && (
                <>
                  {filteredCustomers.length > 0 ? <CommandSeparator /> : null}
                  <CommandGroup heading="Actions">
                    <CommandItem
                      value="__add_new_customer__"
                      onSelect={() => void handleAddNewCustomer()}
                      onPointerDown={(e) => e.preventDefault()}
                      className="cursor-pointer py-2"
                    >
                      <Plus className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Add &quot;{searchQuery}&quot; as new customer</span>
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
              {filteredCustomers.length === 0 && !normalizedSearchQuery && (
                <CommandEmpty className="py-6 text-muted-foreground">
                  Start typing to search customers...
                </CommandEmpty>
              )}
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
};
