import React, { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BillItem } from '@/types';
import { getItems, saveItem } from '@/lib/storage';
import { validateItemName } from '@/lib/validation';
import { toast } from "@/hooks/use-toast";

interface ItemSelectorProps {
  index: number;
  item: BillItem;
  onItemSelect: (selectedItem: any) => void;
}

export const ItemSelector: React.FC<ItemSelectorProps> = ({
  index,
  item,
  onItemSelect
}): JSX.Element => {
  const [items] = useState(() => getItems());
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = searchQuery.trim()
    ? items.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleItemSelect = (selectedItem: any) => {
    onItemSelect(selectedItem);
    setOpen(false);
    setSearchQuery('');
  };

  const handleAddNewItem = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Error",
        description: "Please enter an item name",
        variant: "destructive"
      });
      return;
    }

    const validation = validateItemName(searchQuery.trim());
    if (!validation.isValid) {
      toast({
        title: "Error",
        description: validation.errors[0],
        variant: "destructive"
      });
      return;
    }

    try {
      const newItem = saveItem({
        name: validation.sanitizedValue,
        type: 'variable' as const
      });
      onItemSelect(newItem);
      setOpen(false);
      setSearchQuery('');
      toast({
        title: "Success",
        description: "Item added successfully"
      });
    } catch (error: any) {
      if (error.message === 'DUPLICATE_ITEM_NAME') {
        toast({
          title: "Item already exists",
          description: "Please select from the list or use a different name",
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Input
            value={item.itemName || searchQuery}
            onChange={(e) => {
              const value = e.target.value;
              setSearchQuery(value);
              if (value && !open) setOpen(true);
            }}
            placeholder="Search or type item name..."
            className="pr-10"
            required
            aria-label={`Item name for item ${index + 1}`}
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
            placeholder="Search items..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {filteredItems.length > 0 && (
              <CommandGroup heading="Items">
                {filteredItems.map((item) => (
                  <CommandItem
                    key={item.id}
                    onSelect={() => handleItemSelect(item)}
                    role="option"
                    aria-selected={false}
                  >
                    <span>{item.name}</span>
                    {item.type === 'fixed' && item.rate && (
                      <span className="ml-auto text-sm text-muted-foreground">
                        ₹{item.rate}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {searchQuery && !filteredItems.some(item =>
              item.name.toLowerCase() === searchQuery.toLowerCase()
            ) && (
              <CommandGroup heading="Actions">
                <CommandItem
                  onSelect={handleAddNewItem}
                  role="option"
                >
                  <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                  Add "{searchQuery}" as new item
                </CommandItem>
              </CommandGroup>
            )}

            {filteredItems.length === 0 && !searchQuery && (
              <CommandEmpty>Start typing to search items...</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

