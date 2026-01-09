'use client';

import { useModeStore, type SessionMode } from '@/stores/mode';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModeIndicatorProps {
  className?: string;
  showToggle?: boolean;
}

export function ModeIndicator({ className, showToggle = true }: ModeIndicatorProps) {
  const { mode, toggleMode } = useModeStore();

  const isPlanMode = mode === 'plan';

  if (!showToggle) {
    return (
      <Badge
        variant="outline"
        className={cn(
          isPlanMode
            ? 'bg-purple-100 text-purple-700 border-purple-300'
            : 'bg-gray-100 text-gray-700 border-gray-300',
          className
        )}
      >
        {isPlanMode ? (
          <>
            <FileText className="h-3 w-3 mr-1" />
            PLAN
          </>
        ) : (
          <>
            <Zap className="h-3 w-3 mr-1" />
            NORMAL
          </>
        )}
      </Badge>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleMode}
      title={
        isPlanMode
          ? 'Plan mode: Claude will create a plan before making changes. Click to toggle.'
          : 'Normal mode: Claude executes changes directly. Click to toggle.'
      }
      className={cn(
        'gap-1.5 transition-colors',
        isPlanMode
          ? 'bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200'
          : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200',
        className
      )}
    >
      {isPlanMode ? (
        <>
          <FileText className="h-3.5 w-3.5" />
          PLAN MODE
        </>
      ) : (
        <>
          <Zap className="h-3.5 w-3.5" />
          NORMAL
        </>
      )}
    </Button>
  );
}

export function ModeLabel({ mode }: { mode: SessionMode }) {
  const isPlanMode = mode === 'plan';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded',
        isPlanMode
          ? 'bg-purple-100 text-purple-700'
          : 'bg-gray-100 text-gray-600'
      )}
    >
      {isPlanMode ? (
        <>
          <FileText className="h-3 w-3" />
          Plan Mode
        </>
      ) : (
        <>
          <Zap className="h-3 w-3" />
          Normal
        </>
      )}
    </span>
  );
}
