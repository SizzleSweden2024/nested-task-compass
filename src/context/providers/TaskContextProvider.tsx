import React, { createContext, useContext, useState, useEffect } from 'react';
import { Project, Task } from '../TaskTypes';
import { sampleProjects, sampleTasks } from '../TaskMockData';
import { useProjectActions } from '../hooks/useProjectActions';
import { useTaskActions } from '../hooks/useTaskActions';
import type { TaskContextType } from '../types/TaskContextTypes';
import { v4 as uuidv4 } from 'uuid';
import { isValidUUID } from '../TaskHelpers';

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    const storedProjects = localStorage.getItem('quire-projects');
    const storedTasks = localStorage.getItem('quire-tasks');
    
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
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('quire-projects', JSON.stringify(projects));
    localStorage.setItem('quire-tasks', JSON.stringify(tasks));
  }, [projects, tasks]);

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