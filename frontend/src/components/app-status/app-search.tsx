import { useState, useEffect } from "react";
import type { ReactElement } from "react";
import { Search } from "lucide-react";
import { cn } from "../../lib/utils";

interface AppSearchProps {
  readonly onSearch: (query: string) => void;
}

export function AppSearch({ onSearch }: AppSearchProps): ReactElement {
  const [value, setValue] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(value);
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [value, onSearch]);

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
        }}
        placeholder="Search applications…"
        aria-label="Search applications"
        className={cn(
          "w-full rounded-md border border-gray-300 bg-white py-1.5 pl-9 pr-3 text-sm",
          "placeholder:text-gray-400",
          "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
          "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500",
        )}
      />
    </div>
  );
}
