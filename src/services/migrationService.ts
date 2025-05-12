
import { supabase } from '@/integrations/supabase/client';
import { Project, Task, TimeTracking, TimeBlock } from '@/context/TaskTypes';
import { toast } from '@/components/ui/use-toast';
import { createProject } from './projectService';
import { createTask } from './taskService';
import { addManualTimeTracking } from './timeTrackingService';
import { createTimeBlock } from './timeBlockService';

// Progress callback type definition
type ProgressCallback = (status: string, progress: number) => void;

/**
 * Migrate all data from localStorage to Supabase
 */
export async function migrateDataToSupabase(
  progressCallback?: ProgressCallback
): Promise<boolean> {
  try {
    // Check if user is authenticated
    const userId = await getCurrentUserId();
    
    // Check if the user has a profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();
    
    if (profileError) {
      // Create a profile if it doesn't exist
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          name: 'Anonymous User'
        });
      
      if (error) {
        console.error('Error creating profile:', error);
      }
    }

    // Update progress
    progressCallback?.("Loading local data...", 5);

    // Load data from localStorage
    const projectsData = localStorage.getItem('quire-projects');
    const tasksData = localStorage.getItem('quire-tasks');
    const timeTrackingsData = localStorage.getItem('quire-timetrackings');
    const timeBlocksData = localStorage.getItem('quire-timeblocks');

    // Parse data
    const projects: Project[] = projectsData ? JSON.parse(projectsData) : [];
    const tasks: Task[] = tasksData ? JSON.parse(tasksData) : [];
    const timeTrackings: TimeTracking[] = timeTrackingsData ? JSON.parse(timeTrackingsData) : [];
    const timeBlocks: TimeBlock[] = timeBlocksData ? JSON.parse(timeBlocksData) : [];

    // Update progress
    progressCallback?.("Processing data...", 10);

    // Fix dates in tasks
    tasks.forEach((task: Task) => {
      if (task.dueDate) task.dueDate = new Date(task.dueDate);
      if (task.recurrencePattern?.endDate) {
        task.recurrencePattern.endDate = new Date(task.recurrencePattern.endDate);
      }
      if (task.recurrenceExceptions) {
        task.recurrenceExceptions = task.recurrenceExceptions.map(
          date => new Date(date)
        );
      }
    });

    // Fix dates in time trackings
    timeTrackings.forEach((tracking: TimeTracking) => {
      tracking.startTime = new Date(tracking.startTime);
      if (tracking.endTime) tracking.endTime = new Date(tracking.endTime);
    });

    // Fix dates in time blocks
    timeBlocks.forEach((block: TimeBlock) => {
      block.date = new Date(block.date);
    });

    // Check for existing projects to avoid duplicates
    progressCallback?.("Checking for existing data...", 15);
    const { data: existingProjects } = await supabase.from('projects').select('*');
    
    // If there are already projects in the database, check with the user
    if (existingProjects && existingProjects.length > 0) {
      // We'll continue anyway but log the information
      console.log('Warning: User already has projects in the database. Migration may create duplicates.');
    }

    // Create a map to store old IDs to new IDs mapping
    const projectIdMap = new Map<string, string>();
    const taskIdMap = new Map<string, string>();

    // Calculate total items for progress tracking
    const totalItems = projects.length + tasks.length + timeTrackings.length + timeBlocks.length;
    let completedItems = 0;

    // Migrate projects
    progressCallback?.("Migrating projects...", 20);
    for (const project of projects) {
      try {
        const newProject = await createProject({
          name: project.name,
          description: project.description,
          isExpanded: project.isExpanded
        });
        projectIdMap.set(project.id, newProject.id);
        completedItems++;
        progressCallback?.(`Migrated project: ${project.name}`, 20 + (completedItems / totalItems) * 30);
      } catch (error) {
        console.error('Error migrating project:', project, error);
      }
    }

    // Helper function to restructure tasks into a flat array with correct parent-child relationships
    const getFlattenedTasks = (tasks: Task[]): Task[] => {
      const flatTasks: Task[] = [];
      
      const processTasks = (taskList: Task[], parentId: string | undefined = undefined) => {
        for (const task of taskList) {
          const flatTask = { ...task, parentId };
          flatTasks.push(flatTask);
          if (task.children && task.children.length > 0) {
            processTasks(task.children, task.id);
          }
        }
      };
      
      processTasks(tasks);
      return flatTasks;
    };

    // Get flattened tasks
    const flattenedTasks = getFlattenedTasks(tasks);
    
    // First pass: migrate top-level tasks
    progressCallback?.("Migrating main tasks...", 50);
    for (const task of flattenedTasks.filter(t => !t.parentId)) {
      try {
        // Map to new project ID
        const newProjectId = projectIdMap.get(task.projectId) || task.projectId;
        
        const newTask = await createTask({
          title: task.title,
          description: task.description,
          dueDate: task.dueDate,
          priority: task.priority,
          projectId: newProjectId,
          notes: task.notes,
          estimatedTime: task.estimatedTime,
          completed: task.completed,
          timeSlot: task.timeSlot,
          isRecurring: task.isRecurring,
          recurrencePattern: task.recurrencePattern,
          recurrenceExceptions: task.recurrenceExceptions
        });
        
        taskIdMap.set(task.id, newTask.id);
        completedItems++;
        progressCallback?.(`Migrated task: ${task.title}`, 50 + (completedItems / totalItems) * 15);
      } catch (error) {
        console.error('Error migrating top-level task:', task, error);
      }
    }
    
    // Second pass: migrate child tasks with updated parent IDs
    progressCallback?.("Migrating subtasks...", 65);
    for (const task of flattenedTasks.filter(t => t.parentId)) {
      try {
        // Map to new project ID and parent ID
        const newProjectId = projectIdMap.get(task.projectId) || task.projectId;
        const newParentId = taskIdMap.get(task.parentId!) || task.parentId;
        
        const newTask = await createTask({
          title: task.title,
          description: task.description,
          dueDate: task.dueDate,
          priority: task.priority,
          projectId: newProjectId,
          parentId: newParentId,
          notes: task.notes,
          estimatedTime: task.estimatedTime,
          completed: task.completed,
          timeSlot: task.timeSlot,
          isRecurring: task.isRecurring,
          recurrencePattern: task.recurrencePattern,
          recurrenceExceptions: task.recurrenceExceptions
        });
        
        taskIdMap.set(task.id, newTask.id);
        completedItems++;
        progressCallback?.(`Migrated subtask: ${task.title}`, 65 + (completedItems / totalItems) * 15);
      } catch (error) {
        console.error('Error migrating child task:', task, error);
      }
    }

    // Migrate time tracking entries
    progressCallback?.("Migrating time tracking entries...", 80);
    for (const tracking of timeTrackings) {
      try {
        // Map to new task ID
        const newTaskId = taskIdMap.get(tracking.taskId) || tracking.taskId;
        
        await addManualTimeTracking({
          taskId: newTaskId,
          startTime: tracking.startTime,
          endTime: tracking.endTime,
          duration: tracking.duration,
          notes: tracking.notes
        });
        
        completedItems++;
        progressCallback?.("Migrated time tracking entries", 80 + (completedItems / totalItems) * 10);
      } catch (error) {
        console.error('Error migrating time tracking:', tracking, error);
      }
    }

    // Migrate time blocks
    progressCallback?.("Migrating time blocks...", 90);
    for (const block of timeBlocks) {
      try {
        // Map to new task ID
        const newTaskId = taskIdMap.get(block.taskId) || block.taskId;
        
        await createTimeBlock({
          taskId: newTaskId,
          date: block.date,
          startTime: block.startTime,
          endTime: block.endTime
        });
        
        completedItems++;
        progressCallback?.("Migrated time blocks", 90 + (completedItems / totalItems) * 10);
      } catch (error) {
        console.error('Error migrating time block:', block, error);
      }
    }

    progressCallback?.("Migration completed!", 100);
    
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    toast({
      title: "Migration failed",
      description: "There was an error migrating your data. Please try again.",
      variant: "destructive",
    });
    return false;
  }
}

/**
 * Check if a migration is needed
 */
export function isMigrationNeeded(): boolean {
  // Check if we have any local data that needs migration
  const projectsData = localStorage.getItem('quire-projects');
  const tasksData = localStorage.getItem('quire-tasks');
  const timeTrackingsData = localStorage.getItem('quire-timetrackings');
  const timeBlocksData = localStorage.getItem('quire-timeblocks');
  
  // Check if we have any data that needs migration
  return !!(projectsData || tasksData || timeTrackingsData || timeBlocksData);
}

/**
 * Mark migration as completed by removing local data
 */
export function markMigrationCompleted(): void {
  // We don't delete the data immediately for safety, just rename it
  const keys = ['quire-projects', 'quire-tasks', 'quire-timetrackings', 'quire-timeblocks', 'quire-active-timetracking'];
  
  keys.forEach(key => {
    const data = localStorage.getItem(key);
    if (data) {
      localStorage.setItem(`${key}-backup`, data);
      localStorage.removeItem(key);
    }
  });
}

/**
 * Restore backed up data (useful if migration failed)
 */
export function restoreBackupData(): boolean {
  let restored = false;
  const keys = ['quire-projects', 'quire-tasks', 'quire-timetrackings', 'quire-timeblocks', 'quire-active-timetracking'];
  
  keys.forEach(key => {
    const backup = localStorage.getItem(`${key}-backup`);
    if (backup) {
      localStorage.setItem(key, backup);
      localStorage.removeItem(`${key}-backup`);
      restored = true;
    }
  });
  
  return restored;
}
