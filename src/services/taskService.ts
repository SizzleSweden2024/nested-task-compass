import { supabase } from '@/integrations/supabase/client';
import { handleSupabaseError, prepareDatesForSupabase, processSupabaseData, getCurrentUserId } from './serviceUtils';
import { Task, RecurrencePattern } from '@/context/TaskTypes';

/**
 * Fetch all tasks for the current user
 */
export async function getTasks(): Promise<Task[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*');
    
    if (error) throw error;
    
    // Convert the Supabase tasks to our Task type and organize them into a hierarchy
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
    })) as Task[];
    
    // Fetch recurrence patterns for recurring tasks
    const recurringTaskIds = tasks.filter(t => t.isRecurring).map(t => t.id);
    
    if (recurringTaskIds.length > 0) {
      const { data: recurrenceData, error: recurrenceError } = await supabase
        .from('recurrence_patterns')
        .select('*')
        .in('task_id', recurringTaskIds);
      
      if (!recurrenceError && recurrenceData) {
        for (const pattern of recurrenceData) {
          const task = tasks.find(t => t.id === pattern.task_id);
          if (task) {
            task.recurrencePattern = {
              frequency: pattern.frequency,
              interval: pattern.interval,
              daysOfWeek: pattern.days_of_week,
              dayOfMonth: pattern.day_of_month,
              monthOfYear: pattern.month_of_year,
              endDate: pattern.end_date ? new Date(pattern.end_date) : undefined,
              occurrences: pattern.occurrences,
            };
          }
        }
      }
      
      // Fetch exceptions for recurring tasks
      const { data: exceptionData, error: exceptionError } = await supabase
        .from('recurrence_exceptions')
        .select('*')
        .in('task_id', recurringTaskIds);
      
      if (!exceptionError && exceptionData) {
        for (const exception of exceptionData) {
          const task = tasks.find(t => t.id === exception.task_id);
          if (task) {
            if (!task.recurrenceExceptions) {
              task.recurrenceExceptions = [];
            }
            task.recurrenceExceptions.push(new Date(exception.exception_date));
          }
        }
      }
    }
    
    return tasks;
  } catch (error) {
    return handleSupabaseError(error, 'Failed to fetch tasks');
  }
}

/**
 * Create a new task
 */
export async function createTask(task: Omit<Task, 'id' | 'children' | 'isExpanded' | 'timeTracked'>): Promise<Task> {
  try {
    const userId = await getCurrentUserId();
    console.log(`Creating task in Supabase for user: ${userId}`);
    
    // Generate a new UUID for the task if not provided
    const taskId = task.id || uuidv4();
    console.log(`Using task ID: ${taskId}`);
    
    // First create the task
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        id: taskId,
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
    console.log(`Task created successfully in Supabase with ID: ${data.id}`);
    
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
      isRecurring: data.is_recurring || false,
    };
    
    // If it's a recurring task, add the recurrence pattern
    if (task.isRecurring && task.recurrencePattern) {
      const { error: recurrenceError } = await supabase
        .from('recurrence_patterns')
        .insert({
          task_id: newTask.id,
          frequency: task.recurrencePattern.frequency,
          interval: task.recurrencePattern.interval,
          days_of_week: task.recurrencePattern.daysOfWeek,
          day_of_month: task.recurrencePattern.dayOfMonth,
          month_of_year: task.recurrencePattern.monthOfYear,
          end_date: task.recurrencePattern.endDate?.toISOString(),
          occurrences: task.recurrencePattern.occurrences
        });
      
      if (recurrenceError) throw recurrenceError;
      
      newTask.recurrencePattern = task.recurrencePattern;
    }
    
    return newTask;
  } catch (error) {
    return handleSupabaseError(error, 'Failed to create task');
  }
}

/**
 * Update an existing task
 */
export async function updateTask(task: Task): Promise<void> {
  try {
    // Update the task
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
      .eq('id', task.id);
    
    if (error) throw error;
    
    // Handle recurrence pattern
    if (task.isRecurring && task.recurrencePattern) {
      // Check if recurrence pattern exists for this task
      const { data: existingPattern, error: checkError } = await supabase
        .from('recurrence_patterns')
        .select('id')
        .eq('task_id', task.id)
        .maybeSingle();
      
      if (checkError) throw checkError;
      
      if (existingPattern) {
        // Update existing pattern
        const { error: updateError } = await supabase
          .from('recurrence_patterns')
          .update({
            frequency: task.recurrencePattern.frequency,
            interval: task.recurrencePattern.interval,
            days_of_week: task.recurrencePattern.daysOfWeek,
            day_of_month: task.recurrencePattern.dayOfMonth,
            month_of_year: task.recurrencePattern.monthOfYear,
            end_date: task.recurrencePattern.endDate?.toISOString(),
            occurrences: task.recurrencePattern.occurrences
          })
          .eq('id', existingPattern.id);
        
        if (updateError) throw updateError;
      } else {
        // Insert new pattern
        const { error: insertError } = await supabase
          .from('recurrence_patterns')
          .insert({
            task_id: task.id,
            frequency: task.recurrencePattern.frequency,
            interval: task.recurrencePattern.interval,
            days_of_week: task.recurrencePattern.daysOfWeek,
            day_of_month: task.recurrencePattern.dayOfMonth,
            month_of_year: task.recurrencePattern.monthOfYear,
            end_date: task.recurrencePattern.endDate?.toISOString(),
            occurrences: task.recurrencePattern.occurrences
          });
        
        if (insertError) throw insertError;
      }
    } else {
      // Delete any existing recurrence pattern if task is not recurring anymore
      const { error: deleteError } = await supabase
        .from('recurrence_patterns')
        .delete()
        .eq('task_id', task.id);
      
      if (deleteError) throw deleteError;
    }
    
    // Handle recurrence exceptions
    if (task.recurrenceExceptions && task.recurrenceExceptions.length > 0) {
      // Delete existing exceptions first
      const { error: deleteError } = await supabase
        .from('recurrence_exceptions')
        .delete()
        .eq('task_id', task.id);
      
      if (deleteError) throw deleteError;
      
      // Add all current exceptions
      const exceptionsToInsert = task.recurrenceExceptions.map(date => ({
        task_id: task.id,
        exception_date: date.toISOString()
      }));
      
      const { error: insertError } = await supabase
        .from('recurrence_exceptions')
        .insert(exceptionsToInsert);
      
      if (insertError) throw insertError;
    }
    
  } catch (error) {
    handleSupabaseError(error, 'Failed to update task');
  }
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string): Promise<void> {
  try {
    // Deleting the task will cascade to delete recurrence patterns and exceptions
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);
    
    if (error) throw error;
  } catch (error) {
    handleSupabaseError(error, 'Failed to delete task');
  }
}

/**
 * Toggle task completion status
 */
export async function toggleTaskCompleted(taskId: string, completed: boolean): Promise<void> {
  try {
    const { error } = await supabase
      .from('tasks')
      .update({ completed })
      .eq('id', taskId);
    
    if (error) throw error;
  } catch (error) {
    handleSupabaseError(error, 'Failed to update task status');
  }
}

/**
 * Toggle task expanded state
 */
export async function toggleTaskExpanded(taskId: string, isExpanded: boolean): Promise<void> {
  try {
    const { error } = await supabase
      .from('tasks')
      .update({ is_expanded: isExpanded })
      .eq('id', taskId);
    
    if (error) throw error;
  } catch (error) {
    handleSupabaseError(error, 'Failed to update task state');
  }
}
