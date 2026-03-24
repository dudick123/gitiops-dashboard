import type { ReactElement } from "react";
import * as Select from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "../../lib/utils";
import { PROJECTS } from "../../mocks/data/seed";
import { useProjectScope } from "../../hooks/use-project-scope";

export function ProjectSelector(): ReactElement {
  const { project, setProject } = useProjectScope();

  return (
    <Select.Root
      value={project ?? "__all__"}
      onValueChange={(value) => {
        setProject(value === "__all__" ? null : value);
      }}
    >
      <Select.Trigger
        className={cn(
          "inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5",
          "text-sm font-medium text-gray-700 shadow-sm",
          "hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
          "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700",
        )}
        aria-label="Select project"
      >
        <Select.Value placeholder="All Projects" />
        <Select.Icon>
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          className={cn(
            "z-50 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg",
            "dark:border-gray-700 dark:bg-gray-800",
          )}
          position="popper"
          sideOffset={4}
        >
          <Select.Viewport className="p-1">
            <Select.Item
              value="__all__"
              className={cn(
                "relative flex cursor-pointer select-none items-center rounded-sm px-8 py-1.5 text-sm",
                "text-gray-700 outline-none",
                "hover:bg-blue-50 focus:bg-blue-50",
                "dark:text-gray-200 dark:hover:bg-gray-700 dark:focus:bg-gray-700",
              )}
            >
              <Select.ItemIndicator className="absolute left-2 inline-flex items-center">
                <Check className="h-4 w-4" />
              </Select.ItemIndicator>
              <Select.ItemText>All Projects</Select.ItemText>
            </Select.Item>

            {PROJECTS.map((p) => (
              <Select.Item
                key={p.name}
                value={p.name}
                className={cn(
                  "relative flex cursor-pointer select-none items-center rounded-sm px-8 py-1.5 text-sm",
                  "text-gray-700 outline-none",
                  "hover:bg-blue-50 focus:bg-blue-50",
                  "dark:text-gray-200 dark:hover:bg-gray-700 dark:focus:bg-gray-700",
                )}
              >
                <Select.ItemIndicator className="absolute left-2 inline-flex items-center">
                  <Check className="h-4 w-4" />
                </Select.ItemIndicator>
                <Select.ItemText>{p.name}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
