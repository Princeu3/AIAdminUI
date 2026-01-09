'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { getMatchingCommands, type SlashCommand } from '@/lib/commands';
import { cn } from '@/lib/utils';

interface SlashCommandMenuProps {
  prefix: string;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  position?: { top: number; left: number };
  className?: string;
}

export function SlashCommandMenu({
  prefix,
  onSelect,
  onClose,
  position,
  className,
}: SlashCommandMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const matchingCommands = getMatchingCommands(prefix);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSelect = useCallback(
    (commandName: string) => {
      const command = matchingCommands.find((c) => c.name === commandName);
      if (command) {
        onSelect(command);
      }
    },
    [matchingCommands, onSelect]
  );

  if (matchingCommands.length === 0) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className={cn(
        'absolute z-50 w-64 rounded-md border bg-popover shadow-lg',
        className
      )}
      style={
        position
          ? { top: position.top, left: position.left }
          : { bottom: '100%', left: 0, marginBottom: '8px' }
      }
    >
      <Command className="rounded-md">
        <CommandList>
          <CommandEmpty>No commands found.</CommandEmpty>
          <CommandGroup heading="Commands">
            {matchingCommands.map((command) => (
              <CommandItem
                key={command.name}
                value={command.name}
                onSelect={handleSelect}
                className="flex items-center gap-2 cursor-pointer"
              >
                <command.icon className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <span className="font-medium">/{command.name}</span>
                  <span className="text-muted-foreground ml-2 text-xs">
                    {command.description}
                  </span>
                </div>
                {command.handler === 'backend' && (
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    server
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}
