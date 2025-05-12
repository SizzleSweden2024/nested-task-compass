
import { useState } from 'react';
import { Task, RecurrencePattern } from '../TaskTypes';
import { generateId, findTaskById, updateTaskInHierarchy, getRootTasks, isValidUUID } from '../TaskHelpers';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUserId } from '@/services/serviceUtils';

export function useTaskActions(tasksInit: Task[], setTasks: (tasks: Task[]) => void, getCurrentTasks: () => Task[]) {
  const addTask = async (task: Omit<Task, 'id' | 'children' | 'isExpanded' | 'timeTracked'>) => {
    // Always generate a new UUID for the task
    const newId = uuidv4();
    console.log(`Generated new UUID for task: ${newId}`);
    
    const newTask: Task = {
      ...task,
      id: newId,
      children: [],
      isExpanded: true,
      timeTracked: 0
    };
    
    // Try to create the task in Supabase first
    try {
      const userId = await getCurrentUserId();
      console.log(`Creating task in Supabase with ID: ${newId}`);
      
      const { error } = await supabase
        .from('tasks')
        .insert({
          id: newId,
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
        });
      
      if (error) {
        console.error('Error creating task in Supabase:', error);
      } else {
        console.log(`Task created successfully in Supabase with ID: ${newId}`);
      }
    } catch (error) {
      console.error('Error creating task in Supabase:', error);
    }
    
    if (task.parentId) {
      // Add as a child task to parent
      const updatedTasks = updateTaskInHierarchy(
        task.parentId,
        (parent) => ({
          ...parent,
          children: [...parent.children, newTask]
        }),
        getRootTasks(getCurrentTasks())
      );
      setTasks(updatedTasks);
    } else {
      setTasks([...getRootTasks(getCurrentTasks()), newTask]);
    }
    
    return newTask;
  };

  const updateTask = (task: Task) => {
    // Ensure the task ID is a valid UUID
    if (!isValidUUID(task.id)) {
      console.error(`Task ID ${task.id} is not a valid UUID. Task will not be updated.`);
      return;
    }
    
    if (task.parentId) {
      const updatedTasks = updateTaskInHierarchy(
        task.id,
        () => task,
        getRootTasks(getCurrentTasks())
      );
      setTasks(updatedTasks);
    } else {
      setTasks(getCurrentTasks().map((t) => (t.id === task.id ? task : t)));
    }
    
    // Try to update the task in Supabase
    try {
      console.log(`Updating task in Supabase with ID: ${task.id}`);
      supabase
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
        .then(({ error }) => {
          if (error) {
            console.error('Error updating task in Supabase:', error);
          } else {
            console.log(`Task updated successfully in Supabase with ID: ${task.id}`);
          }
        });
    } catch (error) {
      console.error('Error updating task in Supabase:', error);
    }
  };

  const deleteTask = (taskId: string) => {
    // Ensure the task ID is a valid UUID
    if (!isValidUUID(taskId)) {
      console.error(`Task ID ${taskId} is not a valid UUID. Task will not be deleted.`);
      return;
    }
    
    const taskToDelete = findTaskById(taskId, getRootTasks(getCurrentTasks()));
    if (!taskToDelete) return;

    if (taskToDelete.parentId) {
      const updatedTasks = updateTaskInHierarchy(
        taskToDelete.parentId,
        (parent) => ({
          ...parent,
          children: parent.children.filter((child) => child.id !== taskId)
        }),
        getRootTasks(getCurrentTasks())
      );
      setTasks(updatedTasks);
    } else {
      setTasks(getCurrentTasks().filter((t) => t.id !== taskId));
    }
    
    // Try to delete the task in Supabase
    try {
      console.log(`Deleting task in Supabase with ID: ${taskId}`);
      supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .then(({ error }) => {
          if (error) {
            console.error('Error deleting task in Supabase:', error);
          } else {
            console.log(`Task deleted successfully in Supabase with ID: ${taskId}`);
          }
        });
    } catch (error) {
      console.error('Error deleting task in Supabase:', error);
    }
  };

  const toggleTaskExpanded = (taskId: string) => {
    const taskToToggle = findTaskById(taskId, getRootTasks(getCurrentTasks()));
    if (!taskToToggle) return;
    if (taskToToggle.parentId) {
      const updatedTasks = updateTaskInHierarchy(
        taskId,
        (task) => ({ ...task, isExpanded: !task.isExpanded }),
        getRootTasks(getCurrentTasks())
      );
      setTasks(updatedTasks);
    } else {
      setTasks(
        getCurrentTasks().map((t) =>
          t.id === taskId ? { ...t, isExpanded: !t.isExpanded } : t
        )
      );
    }
  };

  // New methods for recurring tasks
  const updateRecurringTask = (
    task: Task,
    updateMode: 'single' | 'future' | 'all' = 'single'
  ) => {
    if (updateMode === 'single' || !task.recurrenceParentId) {
      // Just update this instance
      updateTask(task);
      return;
    }
    
    const allTasks = getCurrentTasks();
    const parentTask = findTaskById(task.recurrenceParentId, allTasks);
    
    if (!parentTask) {
      console.error('Parent task not found:', task.recurrenceParentId);
      return;
    }
    
    if (updateMode === 'all') {
      // Update the parent task
      const updatedParent = {
        ...parentTask,
        title: task.title,
        description: task.description,
        priority: task.priority,
        notes: task.notes,
        estimatedTime: task.estimatedTime,
        // Update recurrence pattern if needed
        recurrencePattern: task.recurrencePattern || parentTask.recurrencePattern
      };
      updateTask(updatedParent);
      
      // Update all instances
      const instances = allTasks.filter(t => t.recurrenceParentId === parentTask.id);
      instances.forEach(instance => {
        const updatedInstance = {
          ...instance,
          title: task.title,
          description: task.description,
          priority: task.priority,
          notes: task.notes, 
          estimatedTime: task.estimatedTime
        };
        updateTask(updatedInstance);
      });
    } else if (updateMode === 'future') {
      // Update this instance and all future instances
      updateTask(task);
      
      const taskDate = task.dueDate;
      if (taskDate) {
        const instances = allTasks.filter(t => 
          t.recurrenceParentId === parentTask.id && 
          t.dueDate && 
          t.dueDate >= taskDate
        );
        instances.forEach(instance => {
          if (instance.id !== task.id) {
            const updatedInstance = {
              ...instance,
              title: task.title,
              description: task.description,
              priority: task.priority,
              notes: task.notes,
              estimatedTime: task.estimatedTime
            };
            updateTask(updatedInstance);
          }
        });
      }
    }
  };

  const deleteRecurringTask = (
    taskId: string,
    deleteMode: 'single' | 'future' | 'all' = 'single'
  ) => {
    const allTasks = getCurrentTasks();
    const taskToDelete = findTaskById(taskId, allTasks);
    
    if (!taskToDelete) return;
    
    if (deleteMode === 'single') {
      // Just delete this instance or add an exception
      if (taskToDelete.recurrenceParentId) {
        // This is an instance, just delete it
        deleteTask(taskId);
        
        // If it's a generated instance, add an exception to the parent
        if (taskToDelete.dueDate) {
          const parentTask = findTaskById(taskToDelete.recurrenceParentId, allTasks);
          if (parentTask && parentTask.isRecurring) {
            const updatedParent = {
              ...parentTask,
              recurrenceExceptions: [
                ...(parentTask.recurrenceExceptions || []),
                taskToDelete.dueDate
              ]
            };
            updateTask(updatedParent);
          }
        }
      } else if (taskToDelete.isRecurring) {
        // This is a recurring task template, just delete this instance
        deleteTask(taskId);
      }
    } else if (deleteMode === 'future') {
      if (taskToDelete.recurrenceParentId) {
        // This is an instance, delete it and all future instances
        const parentTask = findTaskById(taskToDelete.recurrenceParentId, allTasks);
        if (parentTask && taskToDelete.dueDate) {
          // Update the parent's end date
          if (parentTask.recurrencePattern) {
            const updatedParent = {
              ...parentTask,
              recurrencePattern: {
                ...parentTask.recurrencePattern,
                endDate: new Date(taskToDelete.dueDate.getTime() - 86400000) // Day before
              }
            };
            updateTask(updatedParent);
          }
          
          // Delete all future instances
          const instancesToDelete = allTasks.filter(t => 
            t.recurrenceParentId === parentTask.id && 
            t.dueDate && 
            t.dueDate >= taskToDelete.dueDate
          );
          instancesToDelete.forEach(instance => {
            deleteTask(instance.id);
          });
        }
      } else if (taskToDelete.isRecurring && taskToDelete.dueDate) {
        // This is a recurring task template, update its end date
        if (taskToDelete.recurrencePattern) {
          const updatedTask = {
            ...taskToDelete,
            recurrencePattern: {
              ...taskToDelete.recurrencePattern,
              endDate: new Date() // End now
            }
          };
          updateTask(updatedTask);
        }
        
        // Delete all future instances
        const instancesToDelete = allTasks.filter(t => 
          t.recurrenceParentId === taskToDelete.id && 
          t.dueDate && 
          t.dueDate >= new Date()
        );
        instancesToDelete.forEach(instance => {
          deleteTask(instance.id);
        });
      }
    } else if (deleteMode === 'all') {
      if (taskToDelete.recurrenceParentId) {
        // This is an instance, delete the parent and all instances
        const parentId = taskToDelete.recurrenceParentId;
        const allInstances = allTasks.filter(t => t.recurrenceParentId === parentId);
        
        // Delete the parent
        deleteTask(parentId);
        
        // Delete all instances
        allInstances.forEach(instance => {
          deleteTask(instance.id);
        });
      } else if (taskToDelete.isRecurring) {
        // This is a recurring task template, delete it and all instances
        const allInstances = allTasks.filter(t => t.recurrenceParentId === taskToDelete.id);
        
        // Delete the template
        deleteTask(taskToDelete.id);
        
        // Delete all instances
        allInstances.forEach(instance => {
          deleteTask(instance.id);
        });
      }
    }
  };

  return { 
    addTask, 
    updateTask, 
    deleteTask, 
    toggleTaskExpanded,
    updateRecurringTask,
    deleteRecurringTask
  }
  return { 
    addTask, 
    updateTask, 
    deleteTask, 
    toggleTaskExpanded 
  };
}
