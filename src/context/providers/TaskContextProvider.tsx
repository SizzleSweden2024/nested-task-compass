import React, { createContext, useContext, useState, useEffect } from 'react';
import { Project, Task } from '../TaskTypes';
import { sampleProjects, sampleTasks } from '../TaskMockData';
import { useProjectActions } from '../hooks/useProjectActions';
import { useTaskActions } from '../hooks/useTaskActions'; 
import type { TaskContextType } from '../types/TaskContextTypes';
import { v4 as uuidv4 } from 'uuid';
import { isValidUUID, ensureUUID } from '../TaskHelpers';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUserId } from '@/services/serviceUtils';

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const storedProjects = localStorage.getItem('quire-projects');
    const storedTasks = localStorage.getItem('quire-tasks');
    
    const loadData = async () => {
      try {
        if (!storedProjects) {
          setProjects(sampleProjects);
          localStorage.setItem('quire-projects', JSON.stringify(sampleProjects));
        } else {
          // Parse projects and ensure they have valid UUIDs
          const parsedProjects = JSON.parse(storedProjects);
          const validatedProjects = parsedProjects.map((project: any) => ({
            ...project,
            id: isValidUUID(project.id) ? project.id : uuidv4()
          }));
          setProjects(validatedProjects);
          
          // If we had to update any IDs, save the updated projects back to localStorage
          if (JSON.stringify(parsedProjects) !== JSON.stringify(validatedProjects)) {
            localStorage.setItem('quire-projects', JSON.stringify(validatedProjects));
          }
          
          // Sync projects to Supabase
          await syncProjectsToSupabase(validatedProjects);
        }

        if (!storedTasks) {
          setTasks(sampleTasks);
          localStorage.setItem('quire-tasks', JSON.stringify(sampleTasks));
        } else {
          const parsedTasks = JSON.parse(storedTasks);
          
          // Create a mapping of old task IDs to new UUIDs if needed
          const idMapping: Record<string, string> = {};
          
          // Process tasks to ensure they have valid UUIDs and fix dates
          const processTask = (task: any): Task => {
            // Generate a new UUID if the task ID is not valid
            const newId = isValidUUID(task.id) ? task.id : uuidv4();
            if (newId !== task.id) {
              console.log(`Replacing invalid task ID ${task.id} with UUID ${newId}`);
              idMapping[task.id] = newId;
            }
            
            // Process children recursively
            const children = Array.isArray(task.children) 
              ? task.children.map(processTask)
              : [];
            
            return {
              ...task,
              id: newId,
              dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
              children,
              timeTracked: task.timeTracked ?? 0,
              // Remove any legacy status field
              status: undefined
            };
          };
          
          // Process all tasks
          const validatedTasks = parsedTasks.map(processTask);
          
          // Update parent IDs if needed
          const updateParentIds = (task: Task): Task => {
            // Update children's parent IDs if they were remapped
            const updatedChildren = task.children.map(child => {
              const updatedChild = updateParentIds(child);
              if (updatedChild.parentId && idMapping[updatedChild.parentId]) {
                return {
                  ...updatedChild,
                  parentId: idMapping[updatedChild.parentId]
                };
              }
              return updatedChild;
            });
            
            return {
              ...task,
              children: updatedChildren
            };
          };
          
          const finalTasks = validatedTasks.map(updateParentIds);
          
          setTasks(finalTasks);
          
          // If we had to update any IDs, save the updated tasks back to localStorage
          if (Object.keys(idMapping).length > 0) {
            localStorage.setItem('quire-tasks', JSON.stringify(finalTasks));
          }
          
          // Sync tasks to Supabase
          await syncTasksToSupabase(finalTasks);
        }
        
        setInitialized(true);
      } catch (error) {
        console.error('Error loading data:', error);
        setInitialized(true);
      }
    };
    
    loadData();
  }, []);

  // Function to sync projects to Supabase
  const syncProjectsToSupabase = async (projects: Project[]) => {
    try {
      const userId = await getCurrentUserId();
      console.log(`Syncing ${projects.length} projects to Supabase for user ${userId}`);
      
      for (const project of projects) {
        if (!isValidUUID(project.id)) {
          console.log(`Skipping project with invalid UUID: ${project.id}`);
          continue;
        }
        
        // Check if project exists in Supabase
        const { data, error } = await supabase
          .from('projects')
          .select('id')
          .eq('id', project.id)
          .maybeSingle();
        
        if (error) {
          console.error(`Error checking project ${project.id}:`, error);
          continue;
        }
        
        if (!data) {
          // Project doesn't exist, create it
          console.log(`Creating project in Supabase: ${project.id}`);
          const { error: insertError } = await supabase
            .from('projects')
            .insert({
              id: project.id,
              name: project.name,
              description: project.description,
              is_expanded: project.isExpanded,
              user_id: userId
            });
          
          if (insertError) {
            console.error(`Error creating project ${project.id}:`, insertError);
          }
        }
      }
    } catch (error) {
      console.error('Error syncing projects to Supabase:', error);
    }
  };
  
  // Function to sync tasks to Supabase
  const syncTasksToSupabase = async (tasks: Task[]) => {
    try {
      const userId = await getCurrentUserId();
      console.log(`Syncing tasks to Supabase for user ${userId}`);
      
      // Flatten the task hierarchy
      const flattenTasks = (tasks: Task[], result: Task[] = []): Task[] => {
        for (const task of tasks) {
          result.push(task);
          if (task.children && task.children.length > 0) {
            flattenTasks(task.children, result);
          }
        }
        return result;
      };
      
      const allTasks = flattenTasks(tasks);
      console.log(`Found ${allTasks.length} tasks to sync`);
      
      for (const task of allTasks) {
        if (!isValidUUID(task.id)) {
          console.log(`Skipping task with invalid UUID: ${task.id}`);
          continue;
        }
        
        // Check if task exists in Supabase
        const { data, error } = await supabase
          .from('tasks')
          .select('id')
          .eq('id', task.id)
          .maybeSingle();
        
        if (error) {
          console.error(`Error checking task ${task.id}:`, error);
          continue;
        }
        
        if (!data) {
          // Task doesn't exist, create it
          console.log(`Creating task in Supabase: ${task.id}`);
          const { error: insertError } = await supabase
            .from('tasks')
            .insert({
              id: task.id,
              title: task.title,
              description: task.description,
              due_date: task.dueDate?.toISOString(),
              priority: task.priority,
              project_id: task.projectId,
              parent_id: task.parentId,
              notes: task.notes,
              estimated_time: task.estimatedTime,
              time_tracked: task.timeTracked || 0,
              completed: task.completed || false,
              time_slot: task.timeSlot,
              is_recurring: task.isRecurring || false,
              is_expanded: task.isExpanded || true,
              user_id: userId
            });
          
          if (insertError) {
            console.error(`Error creating task ${task.id}:`, insertError);
          }
        }
      }
    } catch (error) {
      console.error('Error syncing tasks to Supabase:', error);
    }
  };

  useEffect(() => {
    localStorage.setItem('quire-projects', JSON.stringify(projects));
    localStorage.setItem('quire-tasks', JSON.stringify(tasks));
  }, [projects, tasks, initialized]);

  const projectActions = useProjectActions(projects, setProjects);
  const taskActions = useTaskActions(tasks, setTasks, () => tasks);

  const value: TaskContextType = {
    projects,
    tasks,
    ...projectActions,
    ...taskActions,
  };

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
};

export const useTaskContext = () => {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error('useTaskContext must be used within a TaskContextProvider');
  }
  return context;
};