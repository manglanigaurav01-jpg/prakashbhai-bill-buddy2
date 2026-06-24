import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { BillItem } from '@/types';
import { getItems, saveItem } from '@/lib/storage';
import { validateItemName } from '@/lib/validation';
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
  const [items, setItems] = useState(() => getItems());
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const blurCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
  const normalizedSearchQuery = normalizeText(debouncedQuery);

  const refreshItems = useCallback(() => setItems(getItems()), []);

  useEffect(() => {
    return () => {
      if (blurCloseTimer.current) clearTimeout(blurCloseTimer.current);
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 120);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // item.itemName must not beat searchQuery while typing
  const displayValue =
    searchQuery !== '' || !item.itemName?.trim() ? searchQuery : item.itemName;

  const filteredItems = normalizedSearchQuery
    ? items.filter((row) =>
        normalizeText(row.name).includes(normalizedSearchQuery)
      )
    : [];

  const showAdd =
    !!normalizedSearchQuery &&
    !items.some((row) => normalizeText(row.name) === normalizedSearchQuery);

  const pushLineToParent = useCallback(
    (name: string) => {
      if (name !== item.itemName) {
        onItemSelect({ name, type: 'variable' as const });
      }
    },
    [item.itemName, onItemSelect]
  );

  const scheduleSyncLine = useCallback(
    (name: string) => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => pushLineToParent(name), 320);
    },
    [pushLineToParent]
  );

  const handlePickCatalog = (selectedItem: any) => {
    if (blurCloseTimer.current) {
      clearTimeout(blurCloseTimer.current);
      blurCloseTimer.current = null;
    }
    onItemSelect(selectedItem);
    setOpen(false);
    setSearchQuery('');
  };

  const handleAddNewItem = async () => {
    if (blurCloseTimer.current) {
      clearTimeout(blurCloseTimer.current);
      blurCloseTimer.current = null;
    }
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
      refreshItems();
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

  const listOpen = open && (!!normalizedSearchQuery || filteredItems.length > 0 || showAdd);

  return (
    <div className="relative z-10">
      <Input
        value={displayValue}
        onChange={(e) => {
          const value = e.target.value;
          setSearchQuery(value);
          if (value) {
            setOpen(true);
            refreshItems();
          } else {
            setOpen(false);
            pushLineToParent('');
          }
          scheduleSyncLine(value);
        }}
        onFocus={() => {
          refreshItems();
          setSearchQuery(item.itemName ?? '');
          if (item.itemName?.trim()) setOpen(true);
        }}
        onBlur={() => {
          blurCloseTimer.current = setTimeout(() => {
            setOpen(false);
            if (syncTimer.current) {
              clearTimeout(syncTimer.current);
              syncTimer.current = null;
            }
            // If query is empty after a pick/add, keep current selected item name.
            // This prevents clearing the item when user moves to quantity/rate fields.
            const commitName = (searchQuery !== '' ? searchQuery : (item.itemName ?? '')).trim();
            pushLineToParent(commitName);
          }, 180);
        }}
        placeholder="Search or type item name..."
        className="pr-10"
        required
        aria-label={`Item name for item ${index + 1}`}
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
              {filteredItems.length > 0 && (
                <CommandGroup heading="Items">
                  {filteredItems.map((catalogItem) => (
                    <CommandItem
                      key={catalogItem.id}
                      value={catalogItem.id + catalogItem.name}
                      onSelect={() => handlePickCatalog(catalogItem)}
                      onPointerDown={(e) => e.preventDefault()}
                      className="cursor-pointer py-2"
                    >
                      <span className="flex-1 truncate">{catalogItem.name}</span>
                      {catalogItem.type === 'fixed' && catalogItem.rate != null && (
                        <span className="ml-auto text-sm text-muted-foreground">₹{catalogItem.rate}</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {showAdd && (
                <>
                  {filteredItems.length > 0 ? <CommandSeparator /> : null}
                  <CommandGroup heading="Actions">
                    <CommandItem
                      value="__add_new_item__"
                      onSelect={() => void handleAddNewItem()}
                      onPointerDown={(e) => e.preventDefault()}
                      className="cursor-pointer py-2"
                    >
                      <Plus className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Add &quot;{searchQuery}&quot; as new item</span>
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
              {filteredItems.length === 0 && !normalizedSearchQuery && (
                <CommandEmpty className="py-6 text-muted-foreground">
                  Start typing to search items...
                </CommandEmpty>
              )}
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
};
