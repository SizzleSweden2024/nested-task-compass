import React, { createContext, useContext, useState, useEffect } from 'react';
import { ReactNode, TimeTracking, TimeBlock } from '../TaskTypes';
import { useTimeTrackingActions } from '../hooks/useTimeTrackingActions';
import { useTimeBlockActions } from '../hooks/useTimeBlockActions';
import { supabase } from '@/integrations/supabase/client';
import * as timeTrackingService from '@/services/timeTrackingService';
import * as timeBlockService from '@/services/timeBlockService';
import { withTaskContext } from '../hocs/withTaskContext';
import { toast } from "@/hooks/use-toast";
import { findTaskById, updateTaskInHierarchy, getRootTasks } from '../TaskHelpers';
import type { TaskContextType, TimeTrackingContextType } from '../types/TaskContextTypes';

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
  const getUserId = () => {
    const USER_ID_KEY = 'khonja_user_id';
    let userId = localStorage.getItem(USER_ID_KEY);
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem(USER_ID_KEY, userId);
    }
    return userId;
  };
  
  const userId = getUserId();
  
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
      if (activeTimeTracking) {
        await stopTimeTracking();
      }
      
      // Find the task to ensure it exists and get its UUID
      const task = findTaskById(taskId, getRootTasks(tasks));
      if (!task) {
        throw new Error(`Task with ID ${taskId} not found`);
      }
      
      const { data, error } = await supabase
        .from('time_trackings')
        .insert({
          task_id: task.id,
          start_time: new Date().toISOString(),
          duration: 0,
          notes,
          user_id: userId
        })
        .select()
        .single();
      
      if (error) throw error;
      
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
      throw error;
    }
  };

  const stopTimeTracking = async () => {
    try {
      if (activeTimeTracking) {
        const endTime = new Date();
        const duration = Math.floor((endTime.getTime() - activeTimeTracking.startTime.getTime()) / 60000);
        
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
      // Find the task to ensure it exists and get its UUID
      const task = findTaskById(timeTracking.taskId, getRootTasks(tasks));
      if (!task) {
        throw new Error(`Task with ID ${timeTracking.taskId} not found`);
      }
      
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
    } catch (error) {
      console.error('Error adding time tracking:', error);
    }
  };

  const updateTimeTracking = async (timeTracking: TimeTracking) => {
    try {
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
      console.error('Error updating time tracking:', error);
    }
  };

  const deleteTimeTracking = async (timeTrackingId: string) => {
    try {
      const { error } = await supabase
        .from('time_trackings')
        .delete()
        .eq('id', timeTrackingId);
      
      if (error) throw error;
      
      timeTrackingActions.deleteTimeTracking(timeTrackingId);
    } catch (error) {
      console.error('Error deleting time tracking:', error);
    }
  };

  const addTimeBlock = async (timeBlock: Omit<TimeBlock, 'id'>) => {
    try {
      // Find the task to ensure it exists and get its UUID
      const task = findTaskById(timeBlock.taskId, getRootTasks(tasks));
      if (!task) {
        throw new Error(`Task with ID ${timeBlock.taskId} not found`);
      }
      
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
      console.error('Error adding time block:', error);
    }
  };

  const updateTimeBlock = async (timeBlock: TimeBlock) => {
    try {
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
      console.error('Error updating time block:', error);
    }
  };

  const deleteTimeBlock = async (timeBlockId: string) => {
    try {
      const { error } = await supabase
        .from('time_blocks')
        .delete()
        .eq('id', timeBlockId);
      
      if (error) throw error;
      
      timeBlockActions.deleteTimeBlock(timeBlockId);
    } catch (error) {
      console.error('Error deleting time block:', error);
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