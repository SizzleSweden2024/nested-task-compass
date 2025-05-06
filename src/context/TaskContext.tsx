
import { HybridTaskProvider } from './providers/HybridTaskProvider';
import { useTaskContext as useLocalTaskContext } from './providers/TaskContextProvider';
import { useTimeTrackingContext } from './providers/TimeTrackingProvider';
import { useViewModeContext } from './providers/ViewModeProvider';
import type { Task, Project, TimeBlock, TimeTracking, Priority } from './TaskTypes';
import type { TaskContextType, TimeTrackingContextType } from './types/TaskContextTypes';

// Always use local task context since we're removing authentication
export const useTaskContext = useLocalTaskContext;

export {
  HybridTaskProvider,
  useTimeTrackingContext,
  useViewModeContext,
  useLocalTaskContext,
  type Task,
  type Project,
  type TimeBlock,
  type TimeTracking,
  type Priority,
  type TaskContextType,
  type TimeTrackingContextType,
};
