import React, { createContext, useContext, useState, useEffect } from 'react';
import { Project, Task, TimeBlock, TimeTracking, ReactNode } from '../TaskTypes';
import { useProjectActions } from '../hooks/useProjectActions';
import { useTaskActions } from '../hooks/useTaskActions';
import { useTimeTrackingActions } from '../hooks/useTimeTrackingActions';
import { useTimeBlockActions } from '../hooks/useTimeBlockActions';
import { supabase } from '@/integrations/supabase/client';
import * as projectService from '@/services/projectService';
import * as taskService from '@/services/taskService';
import * as timeTrackingService from '@/services/timeTrackingService';
import * as timeBlockService from '@/services/timeBlockService';
import { toast } from '@/components/ui/use-toast';
import { useOnlineStatus } from '@/hooks/use-online-status'; 

interface SupabaseTaskContextProviderType {
  projects: Project[];
  tasks: Task[];
  timeBlocks: TimeBlock[];
  timeTrackings: TimeTracking[];
  activeTimeTracking: TimeTracking | null;
  loading: boolean;
  // Project actions
  addProject: (project: Omit<Project, 'id' | 'isExpanded'>) => Promise<void>;
  updateProject: (project: Project) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  toggleProjectExpanded: (projectId: string) => Promise<void>;
  // Task actions
  addTask: (task: Omit<Task, 'id' | 'children' | 'isExpanded' | 'timeTracked'>) => Promise<void>;
  updateTask: (task: Task) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  toggleTaskExpanded: (taskId: string) => Promise<void>;
  updateRecurringTask: (task: Task, updateMode?: 'single' | 'future' | 'all') => Promise<void>;
  deleteRecurringTask: (taskId: string, deleteMode?: 'single' | 'future' | 'all') => Promise<void>;
  // Time tracking actions
  startTimeTracking: (taskId: string, notes?: string) => Promise<void>;
  stopTimeTracking: () => Promise<void>;
  addTimeTracking: (timeTracking: Omit<TimeTracking, 'id'>) => Promise<void>;
  updateTimeTracking: (timeTracking: TimeTracking) => Promise<void>;
  deleteTimeTracking: (timeTrackingId: string) => Promise<void>;
  // Time block actions
  addTimeBlock: (timeBlock: Omit<TimeBlock, 'id'>) => Promise<void>;
  updateTimeBlock: (timeBlock: TimeBlock) => Promise<void>;
  deleteTimeBlock: (timeBlockId: string) => Promise<void>;
  isOnline: boolean;
  pendingOperations: number;
}

const SupabaseTaskContext = createContext<SupabaseTaskContextProviderType | undefined>(undefined);

export const SupabaseTaskProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [timeTrackings, setTimeTrackings] = useState<TimeTracking[]>([]);
  const [activeTimeTracking, setActiveTimeTracking] = useState<TimeTracking | null>(null);
  const [loading, setLoading] = useState(true);

  const projectActions = useProjectActions(projects, setProjects);
  const taskActions = useTaskActions(tasks, setTasks, () => tasks);
  const timeTrackingActions = useTimeTrackingActions(timeTrackings, setTimeTrackings);
  const timeBlockActions = useTimeBlockActions(timeBlocks, setTimeBlocks);

  const networkStatus = useOnlineStatus();
  const isOnline = networkStatus.isOnline;
  const [pendingOperations, setPendingOperations] = useState<Array<{
    type: 'add' | 'update' | 'delete';
    entity: 'task' | 'project' | 'timeTracking' | 'timeBlock';
    data: any;
  }>>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    const channels = [
      supabase.channel('public:projects')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'projects' }, 
          (payload) => {
            console.log('Project change:', payload);
            loadProjects();
          }),

      supabase.channel('public:tasks')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'tasks' }, 
          (payload) => {
            console.log('Task change:', payload);
            loadTasks();
          }),

      supabase.channel('public:time_trackings')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'time_trackings' }, 
          (payload) => {
            console.log('Time tracking change:', payload);
            loadTimeTrackings();
          }),

      supabase.channel('public:time_blocks')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'time_blocks' }, 
          (payload) => {
            console.log('Time block change:', payload);
            loadTimeBlocks();
          })
    ];

    // Subscribe to all channels
    Promise.all(channels.map(channel => channel.subscribe()));

    // Cleanup: unsubscribe from all channels
    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  }, []);

  // Process pending operations when coming back online
  useEffect(() => {
    if (isOnline && pendingOperations.length > 0) {
      const processPendingOperations = async () => {
        const operations = [...pendingOperations];
        setPendingOperations([]);

        for (const operation of operations) {
          try {
            switch (operation.type) {
              case 'add':
                if (operation.entity === 'task') {
                  await taskService.createTask(operation.data);
                } else if (operation.entity === 'project') {
                  await projectService.createProject(operation.data);
                }
                // ... handle other entities
                break;
              case 'update':
                if (operation.entity === 'task') {
                  await taskService.updateTask(operation.data);
                }
                // ... handle other entities
                break;
              case 'delete':
                if (operation.entity === 'task') {
                  await taskService.deleteTask(operation.data);
                }
                // ... handle other entities
                break;
            }
          } catch (error) {
            console.error('Error processing pending operation:', error);
            setPendingOperations(prev => [...prev, operation]);
          }
        }
      };

      processPendingOperations();
    }
  }, [isOnline, pendingOperations]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadProjects(),
        loadTasks(),
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
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const userId = await getCurrentUserId();
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId);
      
      if (error) throw error;
      
      const projects = data.map(project => ({
        id: project.id,
        name: project.name,
        description: project.description || undefined,
        isExpanded: project.is_expanded || false,
      }));
      
      setProjects(projects);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const loadTasks = async () => {
    try {
      const userId = await getCurrentUserId();
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId);
      
      if (error) throw error;
      
      const tasks = data.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description || undefined,
        dueDate: task.due_date ? new Date(task.due_date) : undefined,
        priority: task.priority,
        projectId: task.project_id,
        parentId: task.parent_id || undefined,
        children: [],
        isExpanded: task.is_expanded || false,
        notes: task.notes || undefined,
        estimatedTime: task.estimated_time || undefined,
        timeTracked: task.time_tracked || 0,
        completed: task.completed || false,
        timeSlot: task.time_slot || undefined,
        isRecurring: task.is_recurring || false,
      }));
      
      setTasks(tasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
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

  const addProjectDb = async (project: Omit<Project, 'id' | 'isExpanded'>) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          name: project.name,
          description: project.description,
          is_expanded: true,
          user_id: userId
        })
        .select()
        .single();
      
      if (error) throw error;
      
      const newProject: Project = {
        id: data.id,
        name: data.name,
        description: data.description || undefined,
        isExpanded: data.is_expanded || true
      };
      
      setProjects([...projects, newProject]);
    } catch (error) {
      console.error('Error adding project:', error);
      throw error;
    }
  };

  const updateProjectDb = async (project: Project) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          name: project.name,
          description: project.description,
          is_expanded: project.isExpanded
        })
        .eq('id', project.id)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      setProjects(projects.map(p => p.id === project.id ? project : p));
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  };

  const deleteProjectDb = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      setProjects(projects.filter(p => p.id !== projectId));
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const toggleProjectExpandedDb = async (projectId: string) => {
    try {
      const project = projects.find(p => p.id === projectId);
      if (project) {
        const newExpandedState = !project.isExpanded;
        const { error } = await supabase
          .from('projects')
          .update({ is_expanded: newExpandedState })
          .eq('id', projectId)
          .eq('user_id', userId);
        
        if (error) throw error;
        
        setProjects(projects.map(p => 
          p.id === projectId ? { ...p, isExpanded: newExpandedState } : p
        ));
      }
    } catch (error) {
      console.error('Error toggling project expanded state:', error);
    }
  };

  const addTaskDb = async (task: Omit<Task, 'id' | 'children' | 'isExpanded' | 'timeTracked'>) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: task.title,
          description: task.description,
          due_date: task.dueDate?.toISOString(),
          priority: task.priority,
          project_id: task.projectId,
          parent_id: task.parentId,
          notes: task.notes,
          estimated_time: task.estimatedTime,
          time_tracked: 0,
          completed: task.completed || false,
          time_slot: task.timeSlot,
          is_recurring: task.isRecurring || false,
          is_expanded: true,
          user_id: userId
        })
        .select()
        .single();
      
      if (error) throw error;
      
      const newTask: Task = {
        id: data.id,
        title: data.title,
        description: data.description || undefined,
        dueDate: data.due_date ? new Date(data.due_date) : undefined,
        priority: data.priority,
        projectId: data.project_id,
        parentId: data.parent_id || undefined,
        children: [],
        isExpanded: data.is_expanded || true,
        notes: data.notes || undefined,
        estimatedTime: data.estimated_time || undefined,
        timeTracked: data.time_tracked || 0,
        completed: data.completed || false,
        timeSlot: data.time_slot || undefined,
        isRecurring: data.is_recurring || false
      };
      
      setTasks([...tasks, newTask]);
    } catch (error) {
      console.error('Error adding task:', error);
      throw error;
    }
  };

  const updateTaskDb = async (task: Task) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: task.title,
          description: task.description,
          due_date: task.dueDate?.toISOString(),
          priority: task.priority,
          project_id: task.projectId,
          parent_id: task.parentId,
          notes: task.notes,
          estimated_time: task.estimatedTime,
          time_tracked: task.timeTracked,
          completed: task.completed || false,
          time_slot: task.timeSlot,
          is_recurring: task.isRecurring || false,
          is_expanded: task.isExpanded
        })
        .eq('id', task.id)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      setTasks(tasks.map(t => t.id === task.id ? task : t));
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  };

  const deleteTaskDb = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      setTasks(tasks.filter(t => t.id !== taskId));
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const toggleTaskExpandedDb = async (taskId: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        const newExpandedState = !task.isExpanded;
        const { error } = await supabase
          .from('tasks')
          .update({ is_expanded: newExpandedState })
          .eq('id', taskId)
          .eq('user_id', userId);
        
        if (error) throw error;
        
        setTasks(tasks.map(t => 
          t.id === taskId ? { ...t, isExpanded: newExpandedState } : t
        ));
      }
    } catch (error) {
      console.error('Error toggling task expanded state:', error);
    }
  };

  const updateRecurringTaskDb = async (task: Task, updateMode: 'single' | 'future' | 'all' = 'single') => {
    try {
      if (updateMode === 'single') {
        await updateTaskDb(task);
      } else {
        // Handle future and all updates
        const { error } = await supabase.rpc('update_recurring_task', {
          p_task_id: task.id,
          p_update_mode: updateMode,
          p_task_data: task,
          p_user_id: userId
        });
        
        if (error) throw error;
        
        await loadTasks();
      }
    } catch (error) {
      console.error('Error updating recurring task:', error);
    }
  };

  const deleteRecurringTaskDb = async (taskId: string, deleteMode: 'single' | 'future' | 'all' = 'single') => {
    try {
      if (deleteMode === 'single') {
        await deleteTaskDb(taskId);
      } else {
        const { error } = await supabase.rpc('delete_recurring_task', {
          p_task_id: taskId,
          p_delete_mode: deleteMode,
          p_user_id: userId
        });
        
        if (error) throw error;
        
        await loadTasks();
      }
    } catch (error) {
      console.error('Error deleting recurring task:', error);
    }
  };

  const startTimeTrackingDb = async (taskId: string, notes?: string) => {
    try {
      if (activeTimeTracking) {
        await stopTimeTrackingDb();
      }
      
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
    }
  };

  const stopTimeTrackingDb = async () => {
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
          .eq('id', activeTimeTracking.id)
          .eq('user_id', userId);
        
        if (error) throw error;
        
        // Update task's total tracked time
        const task = tasks.find(t => t.id === activeTimeTracking.taskId);
        if (task) {
          const updatedTask = {
            ...task,
            timeTracked: (task.timeTracked || 0) + duration
          };
          await updateTaskDb(updatedTask);
        }
        
        setActiveTimeTracking(null);
        await loadTimeTrackings();
      }
    } catch (error) {
      console.error('Error stopping time tracking:', error);
    }
  };

  const addTimeTrackingDb = async (timeTracking: Omit<TimeTracking, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('time_trackings')
        .insert({
          task_id: timeTracking.taskId,
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
      
      setTimeTrackings([...timeTrackings, newTracking]);
      
      // Update task's total tracked time
      const task = tasks.find(t => t.id === timeTracking.taskId);
      if (task) {
        const updatedTask = {
          ...task,
          timeTracked: (task.timeTracked || 0) + timeTracking.duration
        };
        await updateTaskDb(updatedTask);
      }
    } catch (error) {
      console.error('Error adding time tracking:', error);
    }
  };

  const updateTimeTrackingDb = async (timeTracking: TimeTracking) => {
    try {
      const { error } = await supabase
        .from('time_trackings')
        .update({
          start_time: timeTracking.startTime.toISOString(),
          end_time: timeTracking.endTime?.toISOString(),
          duration: timeTracking.duration,
          notes: timeTracking.notes
        })
        .eq('id', timeTracking.id)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      setTimeTrackings(timeTrackings.map(t => 
        t.id === timeTracking.id ? timeTracking : t
      ));
    } catch (error) {
      console.error('Error updating time tracking:', error);
    }
  };

  const deleteTimeTrackingDb = async (timeTrackingId: string) => {
    try {
      const { error } = await supabase
        .from('time_trackings')
        .delete()
        .eq('id', timeTrackingId)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      setTimeTrackings(timeTrackings.filter(t => t.id !== timeTrackingId));
    } catch (error) {
      console.error('Error deleting time tracking:', error);
    }
  };

  const addTimeBlockDb = async (timeBlock: Omit<TimeBlock, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('time_blocks')
        .insert({
          task_id: timeBlock.taskId,
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
      
      setTimeBlocks([...timeBlocks, newTimeBlock]);
    } catch (error) {
      console.error('Error adding time block:', error);
    }
  };

  const updateTimeBlockDb = async (timeBlock: TimeBlock) => {
    try {
      const { error } = await supabase
        .from('time_blocks')
        .update({
          task_id: timeBlock.taskId,
          date: timeBlock.date.toISOString(),
          start_time: timeBlock.startTime,
          end_time: timeBlock.endTime
        })
        .eq('id', timeBlock.id)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      setTimeBlocks(timeBlocks.map(t => 
        t.id === timeBlock.id ? timeBlock : t
      ));
    } catch (error) {
      console.error('Error updating time block:', error);
    }
  };

  const deleteTimeBlockDb = async (timeBlockId: string) => {
    try {
      const { error } = await supabase
        .from('time_blocks')
        .delete()
        .eq('id', timeBlockId)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      setTimeBlocks(timeBlocks.filter(t => t.id !== timeBlockId));
    } catch (error) {
      console.error('Error deleting time block:', error);
    }
  };

  const value: SupabaseTaskContextProviderType = {
    projects,
    tasks,
    timeBlocks,
    timeTrackings,
    activeTimeTracking,
    loading,
    addProject: addProjectDb,
    updateProject: updateProjectDb,
    deleteProject: deleteProjectDb,
    toggleProjectExpanded: toggleProjectExpandedDb,
    addTask: addTaskDb,
    updateTask: updateTaskDb,
    deleteTask: deleteTaskDb,
    toggleTaskExpanded: toggleTaskExpandedDb,
    updateRecurringTask: updateRecurringTaskDb,
    deleteRecurringTask: deleteRecurringTaskDb,
    startTimeTracking: startTimeTrackingDb,
    stopTimeTracking: stopTimeTrackingDb,
    addTimeTracking: addTimeTrackingDb,
    updateTimeTracking: updateTimeTrackingDb,
    deleteTimeTracking: deleteTimeTrackingDb,
    addTimeBlock: addTimeBlockDb,
    updateTimeBlock: updateTimeBlockDb,
    deleteTimeBlock: deleteTimeBlockDb,
    isOnline,
    pendingOperations: pendingOperations.length,
  };

  return (
    <SupabaseTaskContext.Provider value={value}>
      {children}
      {!isOnline && (
        <div className="fixed bottom-4 right-4 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-md shadow-lg flex items-center gap-2">
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
          Offline Mode {pendingOperations.length > 0 && `(${pendingOperations.length} pending changes)`}
        </div>
      )}
    </SupabaseTaskContext.Provider>
  );
};

export const useSupabaseTaskContext = () => {
  const context = useContext(SupabaseTaskContext);
  if (context === undefined) {
    throw new Error('useSupabaseTaskContext must be used within a SupabaseTaskProvider');
  }
  return context;
};