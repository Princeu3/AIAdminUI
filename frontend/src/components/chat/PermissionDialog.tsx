'use client';

import { useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePermissionStore,
  type PermissionRequest,
  type PermissionScope,
  type ToolType,
} from '@/stores/permissions';
import {
  FileText,
  Edit,
  Terminal,
  Globe,
  Puzzle,
  AlertTriangle,
  Check,
  X,
  Shield,
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
  read: 'Read File',
  write: 'Write File',
  bash: 'Run Command',
  browser: 'Browse Web',
  mcp: 'MCP Tool',
};

const toolColors: Record<ToolType, string> = {
  read: 'bg-blue-100 text-blue-700 border-blue-300',
  write: 'bg-orange-100 text-orange-700 border-orange-300',
  bash: 'bg-red-100 text-red-700 border-red-300',
  browser: 'bg-purple-100 text-purple-700 border-purple-300',
  mcp: 'bg-green-100 text-green-700 border-green-300',
};

interface PermissionDialogProps {
  request: PermissionRequest | null;
  onRespond: (requestId: string, allowed: boolean, scope: PermissionScope) => void;
}

export function PermissionDialog({ request, onRespond }: PermissionDialogProps) {
  const isOpen = !!request;

  const handleResponse = useCallback(
    (allowed: boolean, scope: PermissionScope) => {
      if (request) {
        onRespond(request.id, allowed, scope);
      }
    },
    [request, onRespond]
  );

  if (!request) return null;

  const Icon = toolIcons[request.tool];
  const label = toolLabels[request.tool];
  const colorClass = toolColors[request.tool];
  const isDangerous = request.tool === 'bash' || request.tool === 'write';

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-orange-500" />
            Permission Required
          </DialogTitle>
          <DialogDescription>
            Claude wants to perform the following action:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Tool Badge */}
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={cn('flex items-center gap-1.5', colorClass)}>
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Badge>
            {isDangerous && (
              <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Modifies System
              </Badge>
            )}
          </div>

          {/* Description */}
          <div className="text-sm text-gray-700">
            {request.description}
          </div>

          {/* Path or Command */}
          {request.path && (
            <div className="bg-gray-50 rounded-md p-3 border">
              <div className="text-xs text-gray-500 mb-1">File Path</div>
              <code className="text-sm font-mono text-gray-800 break-all">
                {request.path}
              </code>
            </div>
          )}

          {request.command && (
            <div className="bg-gray-900 rounded-md p-3">
              <div className="text-xs text-gray-400 mb-1">Command</div>
              <code className="text-sm font-mono text-green-400 break-all">
                $ {request.command}
              </code>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          {/* Quick Actions */}
          <div className="flex gap-2 w-full">
            <Button
              onClick={() => handleResponse(true, 'once')}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <Check className="h-4 w-4 mr-2" />
              Allow Once
            </Button>
            <Button
              onClick={() => handleResponse(false, 'once')}
              variant="destructive"
              className="flex-1"
            >
              <X className="h-4 w-4 mr-2" />
              Deny
            </Button>
          </div>

          {/* Extended Options */}
          <div className="flex gap-2 w-full">
            <Button
              onClick={() => handleResponse(true, 'session')}
              variant="outline"
              className="flex-1 text-xs"
            >
              Allow for Session
            </Button>
            <Button
              onClick={() => handleResponse(true, 'always')}
              variant="outline"
              className="flex-1 text-xs"
            >
              Always Allow
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook to manage permission requests and responses
 */
export function usePermissionDialog() {
  const { pendingRequests, resolveRequest } = usePermissionStore();

  // Get the first pending request (process one at a time)
  const currentRequest = pendingRequests.length > 0 ? pendingRequests[0] : null;

  const handleRespond = useCallback(
    (requestId: string, allowed: boolean, scope: PermissionScope) => {
      resolveRequest(requestId, allowed, scope);
    },
    [resolveRequest]
  );

  return {
    currentRequest,
    handleRespond,
    hasPendingRequests: pendingRequests.length > 0,
    pendingCount: pendingRequests.length,
  };
}
