import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SessionMode = 'normal' | 'plan';

interface PlanStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

interface ModeState {
  mode: SessionMode;
  planContent: string | null;
  planSteps: PlanStep[];
  planApproved: boolean;

  // Actions
  setMode: (mode: SessionMode) => void;
  toggleMode: () => void;
  setPlanContent: (content: string | null) => void;
  setPlanSteps: (steps: PlanStep[]) => void;
  updateStepStatus: (stepId: string, status: PlanStep['status']) => void;
  approvePlan: () => void;
  resetPlan: () => void;
}

export const useModeStore = create<ModeState>()(
  persist(
    (set) => ({
      mode: 'normal',
      planContent: null,
      planSteps: [],
      planApproved: false,

      setMode: (mode) => set({ mode }),

      toggleMode: () =>
        set((state) => ({
          mode: state.mode === 'normal' ? 'plan' : 'normal',
          // Reset plan when exiting plan mode
          ...(state.mode === 'plan'
            ? { planContent: null, planSteps: [], planApproved: false }
            : {}),
        })),

      setPlanContent: (content) => set({ planContent: content }),

      setPlanSteps: (steps) => set({ planSteps: steps }),

      updateStepStatus: (stepId, status) =>
        set((state) => ({
          planSteps: state.planSteps.map((step) =>
            step.id === stepId ? { ...step, status } : step
          ),
        })),

      approvePlan: () => set({ planApproved: true }),

      resetPlan: () =>
        set({
          planContent: null,
          planSteps: [],
          planApproved: false,
        }),
    }),
    {
      name: 'mode-storage',
      partialize: (state) => ({
        mode: state.mode,
      }),
    }
  )
);
