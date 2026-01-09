'use client';

import { useEffect, useCallback } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { commands, type SlashCommand } from '@/lib/commands';
import { Keyboard } from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectCommand: (command: SlashCommand) => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  onSelectCommand,
}: CommandPaletteProps) {
  // Group commands by handler type
  const frontendCommands = commands.filter((c) => c.handler === 'frontend');
  const backendCommands = commands.filter((c) => c.handler === 'backend');

  const handleSelect = useCallback(
    (commandName: string) => {
      const command = commands.find((c) => c.name === commandName);
      if (command) {
        onSelectCommand(command);
        onOpenChange(false);
      }
    },
    [onSelectCommand, onOpenChange]
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command Palette"
      description="Search for a command to run..."
    >
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No commands found.</CommandEmpty>

        {/* Quick Actions */}
        <CommandGroup heading="Actions">
          {frontendCommands.map((command) => (
            <CommandItem
              key={command.name}
              value={command.name}
              onSelect={handleSelect}
              keywords={command.keywords}
              className="flex items-center gap-2"
            >
              <command.icon className="h-4 w-4" />
              <span>/{command.name}</span>
              <span className="text-muted-foreground text-sm">
                {command.description}
              </span>
              {command.shortcut && (
                <CommandShortcut>{command.shortcut}</CommandShortcut>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Server Commands */}
        <CommandGroup heading="Server">
          {backendCommands.map((command) => (
            <CommandItem
              key={command.name}
              value={command.name}
              onSelect={handleSelect}
              keywords={command.keywords}
              className="flex items-center gap-2"
            >
              <command.icon className="h-4 w-4" />
              <span>/{command.name}</span>
              <span className="text-muted-foreground text-sm">
                {command.description}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Help */}
        <CommandGroup heading="Help">
          <CommandItem
            value="keyboard-shortcuts"
            onSelect={() => {
              // TODO: Show keyboard shortcuts dialog
              onOpenChange(false);
            }}
            className="flex items-center gap-2"
          >
            <Keyboard className="h-4 w-4" />
            <span>Keyboard Shortcuts</span>
            <CommandShortcut>?</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

/**
 * Hook to handle Cmd/Ctrl+K shortcut
 */
export function useCommandPaletteShortcut(
  onOpen: () => void,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpen();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onOpen, enabled]);
}
