import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { apiRequest } from "@/lib/queryClient";
import { User } from "@shared/schema";

interface ClientMultiSelectComboboxProps {
  selectedClientIds: number[];
  onClientIdsChange: (ids: number[]) => void;
  disabled?: boolean;
}

export function ClientMultiSelectCombobox({
  selectedClientIds,
  onClientIdsChange,
  disabled = false,
}: ClientMultiSelectComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Debounce search query
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState(searchQuery);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms debounce time

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);


  const { data: clients = [], isLoading: isLoadingClients } = useQuery<User[]>({
    queryKey: ["/api/admin/clients/search", debouncedSearchQuery],
    queryFn: async ({ queryKey }) => {
      const [, query] = queryKey;
      try {
        // Always fetch, with or without query
        const url = query
          ? `/api/admin/clients/search?q=${encodeURIComponent(query as string)}`
          : `/api/admin/clients/search`; // Fetch all clients when no query
        const res = await apiRequest("GET", url);
        return await res.json();
      } catch (error) {
        console.error("Failed to search clients:", error);
        return []; // Return empty on error
      }
    },
    enabled: open, // Fetch whenever dropdown is open
    staleTime: 60 * 1000, // Cache for 1 minute
    refetchOnWindowFocus: false,
  });

  const handleSelect = (clientId: number) => {
    const newIds = selectedClientIds.includes(clientId)
      ? selectedClientIds.filter((id) => id !== clientId)
      : [...selectedClientIds, clientId];
    onClientIdsChange(newIds);
  };

  const getButtonLabel = () => {
    if (selectedClientIds.length === 0) return "Select client(s)...";
    if (selectedClientIds.length === 1) return "1 client selected";
    return `${selectedClientIds.length} clients selected`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
              "w-full justify-between",
              selectedClientIds.length === 0 && "text-muted-foreground"
          )}
          disabled={disabled}
        >
          {getButtonLabel()}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[300px] overflow-y-auto p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search client name or email..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            disabled={disabled}
          />
          <CommandList>
            <CommandEmpty>
              {isLoadingClients
                ? "Searching..."
                : searchQuery && clients.length === 0
                ? "No clients found."
                : "Type to search for clients."}
            </CommandEmpty>
            <CommandGroup>
              {clients.map((client) => (
                <CommandItem
                  // Use a unique value for CMDK Item, including ID
                  value={`${client.firstName} ${client.lastName} (${client.email})-${client.id}`}
                  key={client.id}
                  onSelect={() => handleSelect(client.id)}
                  disabled={disabled}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedClientIds.includes(client.id)
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  {client.firstName} {client.lastName} ({client.email})
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}