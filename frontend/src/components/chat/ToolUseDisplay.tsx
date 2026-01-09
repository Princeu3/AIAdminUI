'use client';

import { useState } from 'react';
import { type ToolUse, type ToolType } from '@/stores/permissions';
import {
  FileText,
  Edit,
  Terminal,
  Globe,
  Puzzle,
  Check,
  X,
  Loader2,
  Clock,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const toolIcons: Record<ToolType, typeof FileText> = {
  read: FileText,
  write: Edit,
  bash: Terminal,
  browser: Globe,
  mcp: Puzzle,
};

const toolLabels: Record<ToolType, string> = {
  read: 'Read',
  write: 'Write',
  bash: 'Bash',
  browser: 'Browser',
  mcp: 'MCP',
};

const statusColors = {
  pending: 'border-gray-300 bg-gray-50',
  running: 'border-blue-300 bg-blue-50',
  completed: 'border-green-300 bg-green-50',
  error: 'border-red-300 bg-red-50',
};

const statusIcons = {
  pending: Clock,
  running: Loader2,
  completed: Check,
  error: X,
};

interface ToolUseDisplayProps {
  toolUse: ToolUse;
  className?: string;
}

export function ToolUseDisplay({ toolUse, className }: ToolUseDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const Icon = toolIcons[toolUse.tool];
  const StatusIcon = statusIcons[toolUse.status];
  const label = toolLabels[toolUse.tool];

  return (
    <div
      className={cn(
        'border rounded-lg overflow-hidden transition-all',
        statusColors[toolUse.status],
        className
      )}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-black/5 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-500" />
        )}

        <Icon className="h-4 w-4 text-gray-600" />

        <span className="font-medium text-sm text-gray-700">{label}</span>

        {toolUse.path && (
          <code className="text-xs text-gray-500 truncate max-w-[200px]">
            {toolUse.path}
          </code>
        )}

        <div className="ml-auto flex items-center gap-1">
          <StatusIcon
            className={cn(
              'h-4 w-4',
              toolUse.status === 'running' && 'animate-spin text-blue-500',
              toolUse.status === 'completed' && 'text-green-500',
              toolUse.status === 'error' && 'text-red-500',
              toolUse.status === 'pending' && 'text-gray-400'
            )}
          />
          <span
            className={cn(
              'text-xs capitalize',
              toolUse.status === 'running' && 'text-blue-600',
              toolUse.status === 'completed' && 'text-green-600',
              toolUse.status === 'error' && 'text-red-600',
              toolUse.status === 'pending' && 'text-gray-500'
            )}
          >
            {toolUse.status}
          </span>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t p-3 space-y-3 bg-white/50">
          {/* Description */}
          {toolUse.description && (
            <div className="text-sm text-gray-600">{toolUse.description}</div>
          )}

          {/* Path */}
          {toolUse.path && (
            <div>
              <div className="text-xs text-gray-500 mb-1">Path</div>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono break-all">
                {toolUse.path}
              </code>
            </div>
          )}

          {/* Command */}
          {toolUse.command && (
            <div>
              <div className="text-xs text-gray-500 mb-1">Command</div>
              <div className="bg-gray-900 rounded p-2">
                <code className="text-xs text-green-400 font-mono break-all">
                  $ {toolUse.command}
                </code>
              </div>
            </div>
          )}

          {/* Result */}
          {toolUse.result && (
            <div>
              <div className="text-xs text-gray-500 mb-1">Result</div>
              <pre className="text-xs bg-gray-100 p-2 rounded font-mono overflow-x-auto max-h-40 whitespace-pre-wrap">
                {toolUse.result}
              </pre>
            </div>
          )}

          {/* Error */}
          {toolUse.error && (
            <div>
              <div className="text-xs text-red-500 mb-1">Error</div>
              <pre className="text-xs bg-red-50 text-red-700 p-2 rounded font-mono overflow-x-auto">
                {toolUse.error}
              </pre>
            </div>
          )}

          {/* Timestamp */}
          <div className="text-xs text-gray-400">
            {toolUse.timestamp.toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Component to display a list of tool uses
 */
interface ToolUseListProps {
  toolUses: ToolUse[];
  className?: string;
}

export function ToolUseList({ toolUses, className }: ToolUseListProps) {
  if (toolUses.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      {toolUses.map((toolUse) => (
        <ToolUseDisplay key={toolUse.id} toolUse={toolUse} />
      ))}
    </div>
  );
}

/**
 * Inline tool use indicator (for showing in message bubbles)
 */
interface ToolUseInlineProps {
  tool: ToolType;
  status: ToolUse['status'];
  path?: string;
}

export function ToolUseInline({ tool, status, path }: ToolUseInlineProps) {
  const Icon = toolIcons[tool];
  const StatusIcon = statusIcons[status];
  const label = toolLabels[tool];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs',
        status === 'running' && 'bg-blue-100 text-blue-700',
        status === 'completed' && 'bg-green-100 text-green-700',
        status === 'error' && 'bg-red-100 text-red-700',
        status === 'pending' && 'bg-gray-100 text-gray-600'
      )}
    >
      <Icon className="h-3 w-3" />
      <span>{label}</span>
      {path && (
        <code className="text-[10px] opacity-75 truncate max-w-[100px]">
          {path.split('/').pop()}
        </code>
      )}
      <StatusIcon
        className={cn('h-3 w-3', status === 'running' && 'animate-spin')}
      />
    </span>
  );
}
