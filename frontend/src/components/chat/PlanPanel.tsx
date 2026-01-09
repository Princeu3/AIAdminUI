'use client';

import { useState } from 'react';
import { useModeStore } from '@/stores/mode';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChevronRight,
  ChevronDown,
  Check,
  Circle,
  Loader2,
  SkipForward,
  FileText,
  X,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlanPanelProps {
  onApprove?: () => void;
  onReject?: () => void;
  className?: string;
}

export function PlanPanel({ onApprove, onReject, className }: PlanPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { mode, planContent, planSteps, planApproved, approvePlan, resetPlan } =
    useModeStore();

  // Don't show if not in plan mode or no plan content
  if (mode !== 'plan' || !planContent) {
    return null;
  }

  const completedSteps = planSteps.filter((s) => s.status === 'completed').length;
  const totalSteps = planSteps.length;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <div
      className={cn(
        'border-l bg-gray-50 flex flex-col transition-all duration-200',
        isExpanded ? 'w-80' : 'w-12',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-white">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          {isExpanded ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          {isExpanded && (
            <>
              <FileText className="h-4 w-4 text-purple-500" />
              <span>Plan</span>
            </>
          )}
        </button>

        {isExpanded && totalSteps > 0 && (
          <span className="text-xs text-gray-500">
            {completedSteps}/{totalSteps} steps
          </span>
        )}
      </div>

      {isExpanded && (
        <>
          {/* Progress Bar */}
          {totalSteps > 0 && (
            <div className="px-3 py-2 border-b">
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Plan Content */}
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              {/* Plan Description */}
              <div className="text-sm text-gray-600 whitespace-pre-wrap">
                {planContent}
              </div>

              {/* Steps */}
              {planSteps.length > 0 && (
                <div className="space-y-2 mt-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Steps
                  </h4>
                  {planSteps.map((step, index) => (
                    <PlanStep key={step.id} step={step} index={index + 1} />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Actions */}
          {!planApproved && (
            <div className="p-3 border-t bg-white space-y-2">
              <Button
                onClick={() => {
                  approvePlan();
                  onApprove?.();
                }}
                className="w-full bg-purple-600 hover:bg-purple-700"
                size="sm"
              >
                <Play className="h-4 w-4 mr-2" />
                Approve & Execute
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  resetPlan();
                  onReject?.();
                }}
                className="w-full"
                size="sm"
              >
                <X className="h-4 w-4 mr-2" />
                Reject Plan
              </Button>
            </div>
          )}

          {planApproved && (
            <div className="p-3 border-t bg-green-50 text-green-700 text-sm flex items-center gap-2">
              <Check className="h-4 w-4" />
              Plan approved - executing...
            </div>
          )}
        </>
      )}

      {/* Collapsed state */}
      {!isExpanded && (
        <div className="flex-1 flex items-center justify-center">
          <FileText className="h-5 w-5 text-purple-500" />
        </div>
      )}
    </div>
  );
}

interface PlanStepProps {
  step: {
    id: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  };
  index: number;
}

function PlanStep({ step, index }: PlanStepProps) {
  const statusIcon = {
    pending: <Circle className="h-4 w-4 text-gray-400" />,
    in_progress: <Loader2 className="h-4 w-4 text-purple-500 animate-spin" />,
    completed: <Check className="h-4 w-4 text-green-500" />,
    skipped: <SkipForward className="h-4 w-4 text-gray-400" />,
  };

  return (
    <div
      className={cn(
        'flex items-start gap-2 p-2 rounded text-sm',
        step.status === 'in_progress' && 'bg-purple-50',
        step.status === 'completed' && 'bg-green-50',
        step.status === 'skipped' && 'opacity-50'
      )}
    >
      {statusIcon[step.status]}
      <div className="flex-1 min-w-0">
        <span
          className={cn(
            'text-gray-700',
            step.status === 'completed' && 'line-through text-gray-500'
          )}
        >
          {index}. {step.description}
        </span>
      </div>
    </div>
  );
}
