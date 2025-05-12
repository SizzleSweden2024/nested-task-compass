import React, { createContext, useContext, useState, useEffect } from 'react';
import { ReactNode, TimeTracking, TimeBlock } from '../TaskTypes';
import { useTimeTrackingActions } from '../hooks/useTimeTrackingActions';
import { useTimeBlockActions } from '../hooks/useTimeBlockActions';
import { supabase } from '@/integrations/supabase/client';
import { withTaskContext } from '../hocs/withTaskContext';
import { toast } from "@/hooks/use-toast";
import { findTaskById, updateTaskInHierarchy, getRootTasks, isValidUUID } from '../TaskHelpers';
import type { TaskContextType, TimeTrackingContextType } from '../types/TaskContextTypes';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentUserId } from '@/services/serviceUtils';

const TimeTrackingContext = createContext<TimeTrackingContextType | undefined>(undefined);

interface TimeTrackingProviderProps {
  children: ReactNode;
  taskContext: TaskContextType;
}

const TimeTrackingProviderBase: React.FC<TimeTrackingProviderProps> = ({ 
  children, 
  taskContext 
}) => {
  const { tasks, updateTask } = taskContext;
  
  // Get or generate a persistent UUID for the user
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [timeTrackings, setTimeTrackings] = useState<TimeTracking[]>([]);
  const [activeTimeTracking, setActiveTimeTracking] = useState<TimeTracking | null>(null);
  
  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    const channels = [
      supabase.channel('public:time_trackings')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'time_trackings' }, 
          () => loadTimeTrackings()),

      supabase.channel('public:time_blocks')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'time_blocks' }, 
          () => loadTimeBlocks())
    ];

    Promise.all(channels.map(channel => channel.subscribe()));

    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  }, []);

  const loadInitialData = async () => {
    try {
      await Promise.all([
        loadTimeTrackings(),
        loadTimeBlocks()
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
      toast({
        title: "Error loading data",
        description: "Failed to load your data. Please try refreshing the page.",
        variant: "destructive",
      });
    }
  };

  const loadTimeTrackings = async () => {
    try {
      const userId = await getCurrentUserId();
      const { data, error } = await supabase
        .from('time_trackings')
        .select('*')
        .eq('user_id', userId);
      
      if (error) throw error;
      
      const timeTrackings = data.map(tracking => ({
        id: tracking.id,
        taskId: tracking.task_id,
        startTime: new Date(tracking.start_time),
        endTime: tracking.end_time ? new Date(tracking.end_time) : undefined,
        duration: tracking.duration,
        notes: tracking.notes || undefined
      }));
      
      const activeTracking = timeTrackings.find(tracking => !tracking.endTime);
      if (activeTracking) {
        setActiveTimeTracking(activeTracking);
        setTimeTrackings(timeTrackings.filter(tracking => tracking.endTime));
      } else {
        setActiveTimeTracking(null);
        setTimeTrackings(timeTrackings);
      }
    } catch (error) {
      console.error('Error loading time trackings:', error);
    }
  };

  const loadTimeBlocks = async () => {
    try {
      const userId = await getCurrentUserId();
      const { data, error } = await supabase
        .from('time_blocks')
        .select('*')
        .eq('user_id', userId);
      
      if (error) throw error;
      
      const timeBlocks = data.map(block => ({
        id: block.id,
        taskId: block.task_id,
        date: new Date(block.date),
        startTime: block.start_time,
        endTime: block.end_time
      }));
      
      setTimeBlocks(timeBlocks);
    } catch (error) {
      console.error('Error loading time blocks:', error);
    }
  };

  const updateTaskTimeTracked = (taskId: string, additionalMinutes: number) => {
    const task = findTaskById(taskId, getRootTasks(tasks));
    if (!task) return;
    
    if (task.parentId) {
      const updatedTasks = updateTaskInHierarchy(
        taskId,
        (taskToUpdate) => ({
          ...taskToUpdate,
          timeTracked: (taskToUpdate.timeTracked || 0) + additionalMinutes
        }),
        getRootTasks(tasks)
      );
      updateTask(updatedTasks[0]);
    } else {
      updateTask({
        ...task,
        timeTracked: (task.timeTracked || 0) + additionalMinutes
      });
    }
  };

  const timeBlockActions = useTimeBlockActions(timeBlocks, setTimeBlocks);
  const timeTrackingActions = useTimeTrackingActions(timeTrackings, setTimeTrackings);

  const startTimeTracking = async (taskId: string, notes?: string) => {
    try {
      const userId = await getCurrentUserId();
      console.log(`Starting time tracking for taskId: ${taskId}`);
      
      // First, check if the taskId is a valid UUID
      if (!isValidUUID(taskId)) {
        console.error(`Invalid taskId format: ${taskId}`);
        toast({
          title: "Error",
          description: "Invalid task ID format. Please try again with a valid task.",
          variant: "destructive",
        });
        return;
      }
      
      if (activeTimeTracking) {
        console.log(`Stopping active time tracking before starting new one`);
        await stopTimeTracking();
      }
      
      // Check if the task exists in Supabase before starting time tracking
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('id, title')
        .eq('id', taskId)
        .maybeSingle();
      
      if (taskError) {
        console.error(`Error checking task existence in Supabase:`, taskError);
        
        // Find the task locally to get its details
        const rootTasks = getRootTasks(tasks);
        const localTask = rootTasks && rootTasks.length > 0 ? findTaskById(taskId, rootTasks) : null;
        if (!localTask) {
          console.error(`Task with ID ${taskId} not found locally or in Supabase`);
          toast({
            title: "Error",
            description: "Task not found. Please try again with a different task.",
            variant: "destructive",
          });
          return;
        }
        
        // Try to create the task in Supabase first
        console.log(`Task not found in Supabase. Creating task: ${localTask.title} (${localTask.id})`);
        const userId = await getCurrentUserId();
        
        const { error: insertError } = await supabase
          .from('tasks') // This will now work since we removed the foreign key constraint
          .insert({
            id: localTask.id,
            title: localTask.title,
            description: localTask.description,
            due_date: localTask.dueDate?.toISOString(),
            priority: localTask.priority,
            project_id: localTask.projectId,
            parent_id: localTask.parentId,
            notes: localTask.notes,
            estimated_time: localTask.estimatedTime,
            time_tracked: localTask.timeTracked || 0,
            completed: localTask.completed || false,
            time_slot: localTask.timeSlot,
            is_recurring: localTask.isRecurring || false,
            is_expanded: localTask.isExpanded || true,
            user_id: userId // This will now work since we removed the foreign key constraint
          });
        
        if (insertError) {
          console.error(`Error creating task in Supabase:`, insertError);
          toast({
            title: "Error",
            description: "Failed to create task in database. Please try again.",
            variant: "destructive",
          });
          return;
        }
        
        console.log(`Task created successfully in Supabase: ${localTask.id}`);
      }
      
      console.log(`Starting time tracking for task: ${taskId}`);
      
      console.log(`Inserting time tracking record with task_id: ${taskId}`);
      const { data, error } = await supabase
        .from('time_trackings')
        .insert({
          task_id: taskId,
          start_time: new Date().toISOString(),
          duration: 0,
          notes,
          user_id: userId
        })
        .select()
        .single();
      
      if (error) {
        console.error('Supabase error:', error);
        console.error('Error details:', JSON.stringify(error));
        throw error;
      }
      
      const newTracking: TimeTracking = {
        id: data.id,
        taskId: data.task_id,
        startTime: new Date(data.start_time),
        duration: 0,
        notes: data.notes || undefined
      };
      
      setActiveTimeTracking(newTracking);
    } catch (error) {
      console.error('Error starting time tracking:', error);
      toast({
        title: "Error",
        description: "Failed to start time tracking. Please try again.",
        variant: "destructive",
      });
    }
  };

  const stopTimeTracking = async () => {
    try {
      if (activeTimeTracking) {
        console.log(`Stopping time tracking for taskId: ${activeTimeTracking.taskId}`);
        const endTime = new Date();
        const duration = Math.floor((endTime.getTime() - activeTimeTracking.startTime.getTime()) / 60000);
        
        console.log(`Updating time tracking record with id: ${activeTimeTracking.id}`);
        const { error } = await supabase
          .from('time_trackings')
          .update({
            end_time: endTime.toISOString(),
            duration
          })
          .eq('id', activeTimeTracking.id);
        
        if (error) throw error;
        
        // Update task's total tracked time
        const task = findTaskById(activeTimeTracking.taskId, getRootTasks(tasks));
        if (task) {
          console.log(`Updating task time tracked. Task ID: ${task.id}, Current tracked: ${task.timeTracked}, Adding: ${duration}`);
          updateTaskTimeTracked(activeTimeTracking.taskId, duration);
        }
        
        setActiveTimeTracking(null);
        await loadTimeTrackings();
      }
    } catch (error) {
      console.error('Error stopping time tracking:', error);
      throw error;
    }
  };

  const addTimeTracking = async (timeTracking: Omit<TimeTracking, 'id'>) => {
    try {
      const userId = await getCurrentUserId();
      // Find the task to ensure it exists and get its UUID
      const taskId = timeTracking.taskId;
      console.log(`Adding time tracking for taskId: ${taskId}`);
      const rootTasks = getRootTasks(tasks);
      const task = rootTasks && rootTasks.length > 0 ? findTaskById(taskId, rootTasks) : null;
      if (!task) {
        console.error(`Task with ID ${taskId} not found in tasks array of length ${tasks ? tasks.length : 0}`);
        toast({
          title: "Error",
          description: "Task not found. Please try again.",
          variant: "destructive",
        });
        return;
      }
      
      // Ensure the task ID is a valid UUID
      if (!isValidUUID(task.id)) {
        console.error(`Task ID ${task.id} is not a valid UUID. Original taskId: ${timeTracking.taskId}`);
        toast({
          title: "Error",
          description: "Invalid task ID format. Please refresh the page.",
          variant: "destructive",
        });
        return;
      }
      
      console.log(`Inserting time tracking with task_id: ${task.id}`);
      const { data, error } = await supabase
        .from('time_trackings')
        .insert({
          task_id: task.id,
          start_time: timeTracking.startTime.toISOString(),
          end_time: timeTracking.endTime?.toISOString(),
          duration: timeTracking.duration,
          notes: timeTracking.notes,
          user_id: userId
        })
        .select()
        .single();
      
      if (error) throw error;
      
      const newTracking: TimeTracking = {
        id: data.id,
        taskId: data.task_id,
        startTime: new Date(data.start_time),
        endTime: data.end_time ? new Date(data.end_time) : undefined,
        duration: data.duration,
        notes: data.notes || undefined
      };
      
      timeTrackingActions.addTimeTracking(newTracking);
      
      // Update task's total tracked time
      updateTaskTimeTracked(task.id, timeTracking.duration);
      console.log(`Time tracking added successfully with id: ${data.id}`);
    } catch (error) {
      console.error('Error adding time tracking:', error);
      if (error.message) console.error('Error message:', error.message);
      if (error.details) console.error('Error details:', error.details);
      toast({
        title: "Error",
        description: "Failed to add time tracking. Please try again.",
        variant: "destructive",
      });
    }
  };

  const updateTimeTracking = async (timeTracking: TimeTracking) => {
    try {
      console.log(`Updating time tracking with id: ${timeTracking.id}`);
      const { error } = await supabase
        .from('time_trackings')
        .update({
          start_time: timeTracking.startTime.toISOString(),
          end_time: timeTracking.endTime?.toISOString(),
          duration: timeTracking.duration,
          notes: timeTracking.notes
        })
        .eq('id', timeTracking.id);
      
      if (error) throw error;
      
      timeTrackingActions.updateTimeTracking(timeTracking);
    } catch (error) {
      console.error(`Error updating time tracking ${timeTracking.id}:`, error);
      if (error.message) console.error('Error message:', error.message);
      if (error.details) console.error('Error details:', error.details);
      toast({
        title: "Error",
        description: "Failed to update time tracking. Please try again.",
        variant: "destructive",
      });
    }
  };

  const deleteTimeTracking = async (timeTrackingId: string) => {
    try {
      console.log(`Deleting time tracking with id: ${timeTrackingId}`);
      const { error } = await supabase
        .from('time_trackings')
        .delete()
        .eq('id', timeTrackingId);
      
      if (error) throw error;
      
      timeTrackingActions.deleteTimeTracking(timeTrackingId);
    } catch (error) {
      console.error(`Error deleting time tracking ${timeTrackingId}:`, error);
      if (error.message) console.error('Error message:', error.message);
      if (error.details) console.error('Error details:', error.details);
      toast({
        title: "Error",
        description: "Failed to delete time tracking. Please try again.",
        variant: "destructive",
      });
    }
  };

  const addTimeBlock = async (timeBlock: Omit<TimeBlock, 'id'>) => {
    try {
      const userId = await getCurrentUserId();
      // Find the task to ensure it exists and get its UUID
      const taskId = timeBlock.taskId;
      console.log(`Adding time block for taskId: ${taskId}`);
      const rootTasks = getRootTasks(tasks);
      const task = rootTasks && rootTasks.length > 0 ? findTaskById(taskId, rootTasks) : null;
      if (!task) {
        console.error(`Task with ID ${taskId} not found in tasks array of length ${tasks ? tasks.length : 0}`);
        toast({
          title: "Error",
          description: "Task not found. Please try again.",
          variant: "destructive",
        });
        return;
      }
      
      // Ensure the task ID is a valid UUID
      if (!isValidUUID(task.id)) {
        console.error(`Task ID ${task.id} is not a valid UUID. Original taskId: ${timeBlock.taskId}`);
        toast({
          title: "Error",
          description: "Invalid task ID format. Please refresh the page.",
          variant: "destructive",
        });
        return;
      }
      
      console.log(`Inserting time block with task_id: ${task.id}`);
      const { data, error } = await supabase
        .from('time_blocks')
        .insert({
          task_id: task.id,
          date: timeBlock.date.toISOString(),
          start_time: timeBlock.startTime,
          end_time: timeBlock.endTime,
          user_id: userId
        })
        .select()
        .single();
      
      if (error) throw error;
      
      const newTimeBlock: TimeBlock = {
        id: data.id,
        taskId: data.task_id,
        date: new Date(data.date),
        startTime: data.start_time,
        endTime: data.end_time
      };
      
      timeBlockActions.addTimeBlock(newTimeBlock);
    } catch (error) {
      console.error(`Error adding time block:`, error);
      if (error.message) console.error('Error message:', error.message);
      if (error.details) console.error('Error details:', error.details);
      toast({
        title: "Error",
        description: "Failed to add time block. Please try again.",
        variant: "destructive",
      });
    }
  };

  const updateTimeBlock = async (timeBlock: TimeBlock) => {
    try {
      console.log(`Updating time block with id: ${timeBlock.id}`);
      const { error } = await supabase
        .from('time_blocks')
        .update({
          task_id: timeBlock.taskId,
          date: timeBlock.date.toISOString(),
          start_time: timeBlock.startTime,
          end_time: timeBlock.endTime
        })
        .eq('id', timeBlock.id);
      
      if (error) throw error;
      
      timeBlockActions.updateTimeBlock(timeBlock);
    } catch (error) {
      console.error(`Error updating time block ${timeBlock.id}:`, error);
      if (error.message) console.error('Error message:', error.message);
      if (error.details) console.error('Error details:', error.details);
      toast({
        title: "Error",
        description: "Failed to update time block. Please try again.",
        variant: "destructive",
      });
    }
  };

  const deleteTimeBlock = async (timeBlockId: string) => {
    try {
      console.log(`Deleting time block with id: ${timeBlockId}`);
      const { error } = await supabase
        .from('time_blocks')
        .delete()
        .eq('id', timeBlockId);
      
      if (error) throw error;
      
      timeBlockActions.deleteTimeBlock(timeBlockId);
    } catch (error) {
      console.error(`Error deleting time block ${timeBlockId}:`, error);
      if (error.message) console.error('Error message:', error.message);
      if (error.details) console.error('Error details:', error.details);
      toast({
        title: "Error",
        description: "Failed to delete time block. Please try again.",
        variant: "destructive",
      });
    }
  };

  const value: TimeTrackingContextType = {
    timeBlocks,
    timeTrackings,
    activeTimeTracking,
    startTimeTracking,
    stopTimeTracking,
    addTimeTracking,
    updateTimeTracking,
    deleteTimeTracking,
    addTimeBlock,
    updateTimeBlock,
    deleteTimeBlock,
  };

  return (
    <TimeTrackingContext.Provider value={value}>
      {children}
    </TimeTrackingContext.Provider>
  );
};

export const TimeTrackingProvider = withTaskContext(TimeTrackingProviderBase);

export const useTimeTrackingContext = () => {
  const context = useContext(TimeTrackingContext);
  if (context === undefined) {
    throw new Error('useTimeTrackingContext must be used within a TimeTrackingProvider');
  }
  return context;
};