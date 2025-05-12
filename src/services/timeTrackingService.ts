import { supabase } from '@/integrations/supabase/client';
import { handleSupabaseError, prepareDatesForSupabase, processSupabaseData, getCurrentUserId } from './serviceUtils';
import { TimeTracking } from '@/context/TaskTypes';

/**
 * Fetch all time tracking entries for the current user
 */
export async function getTimeTrackings(): Promise<TimeTracking[]> {
  try {
    const userId = await getCurrentUserId();
    console.log(`Fetching time trackings for user: ${userId}`);
    
    const { data, error } = await supabase
      .from('time_trackings')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: false });
    
    if (error) throw error;
    
    return data.map(tracking => ({
      id: tracking.id,
      taskId: tracking.task_id,
      startTime: new Date(tracking.start_time),
      endTime: tracking.end_time ? new Date(tracking.end_time) : undefined,
      duration: tracking.duration,
      notes: tracking.notes || undefined
    }));
  } catch (error) {
    console.error('Error in getTimeTrackings:', error);
    if (error.message) console.error('Error message:', error.message);
    if (error.details) console.error('Error details:', error.details);
    return handleSupabaseError(error, 'Failed to fetch time tracking entries');
  }
}

/**
 * Start time tracking for a task
 */
export async function startTimeTracking(
  taskId: string, 
  notes?: string
): Promise<TimeTracking> {
  try {
    const userId = await getCurrentUserId();
    console.log(`Starting time tracking for task: ${taskId}, user: ${userId}`);
    const startTime = new Date();
    
    const { data, error } = await supabase
      .from('time_trackings')
      .insert({
        task_id: taskId,
        start_time: startTime.toISOString(),
        duration: 0,
        notes,
        user_id: userId
      })
      .select()
      .single();
    
    if (error) throw error;
    
    console.log(`Time tracking started successfully with id: ${data.id}`);
    return {
      id: data.id,
      taskId: data.task_id,
      startTime: new Date(data.start_time),
      duration: 0,
      notes: data.notes || undefined
    };
  } catch (error) {
    console.error(`Error starting time tracking for task ${taskId}:`, error);
    if (error.message) console.error('Error message:', error.message);
    if (error.details) console.error('Error details:', error.details);
    return handleSupabaseError(error, 'Failed to start time tracking');
  }
}

/**
 * Stop time tracking
 */
export async function stopTimeTracking(
  timeTrackingId: string,
  taskId: string
): Promise<void> {
  try {
    console.log(`Stopping time tracking: ${timeTrackingId} for task: ${taskId}`);
    // Get the time tracking entry
    const { data: trackingData, error: getError } = await supabase
      .from('time_trackings')
      .select('start_time')
      .eq('id', timeTrackingId)
      .single();
    
    if (getError) throw getError;
    
    const startTime = new Date(trackingData.start_time);
    const endTime = new Date();
    const durationInMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);
    console.log(`Calculated duration: ${durationInMinutes} minutes`);
    
    // Update the time tracking entry
    const { error: updateError } = await supabase
      .from('time_trackings')
      .update({
        end_time: endTime.toISOString(),
        duration: durationInMinutes
      })
      .eq('id', timeTrackingId);
    
    if (updateError) throw updateError;
    
    // Update the task's total tracked time
    console.log(`Updating task ${taskId} time tracked`);
    const { data: taskData, error: taskGetError } = await supabase
      .from('tasks')
      .select('time_tracked')
      .eq('id', taskId)
      .single();
    
    if (taskGetError) throw taskGetError;
    
    const newTimeTracked = (taskData.time_tracked || 0) + durationInMinutes;
    console.log(`New time tracked for task: ${newTimeTracked} minutes`);
    
    const { error: taskUpdateError } = await supabase
      .from('tasks')
      .update({
        time_tracked: newTimeTracked
      })
      .eq('id', taskId);
    
    if (taskUpdateError) throw taskUpdateError;
    
    console.log(`Time tracking stopped successfully`);
  } catch (error) {
    console.error(`Error stopping time tracking ${timeTrackingId}:`, error);
    if (error.message) console.error('Error message:', error.message);
    if (error.details) console.error('Error details:', error.details);
    handleSupabaseError(error, 'Failed to stop time tracking');
  }
}

/**
 * Add a manual time tracking entry
 */
export async function addManualTimeTracking(
  tracking: Omit<TimeTracking, 'id'>
): Promise<TimeTracking> {
  try {
    const userId = await getCurrentUserId();
    console.log(`Adding manual time tracking for task: ${tracking.taskId}, user: ${userId}`);
    
    const { data, error } = await supabase
      .from('time_trackings')
      .insert({
        task_id: tracking.taskId,
        start_time: tracking.startTime.toISOString(),
        end_time: tracking.endTime?.toISOString(),
        duration: tracking.duration,
        notes: tracking.notes,
        user_id: userId
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Update the task's total tracked time
    console.log(`Updating task ${tracking.taskId} time tracked`);
    const { data: taskData, error: taskGetError } = await supabase
      .from('tasks')
      .select('time_tracked')
      .eq('id', tracking.taskId)
      .single();
    
    if (taskGetError) throw taskGetError;
    
    const newTimeTracked = (taskData.time_tracked || 0) + tracking.duration;
    console.log(`New time tracked for task: ${newTimeTracked} minutes`);
    
    const { error: taskUpdateError } = await supabase
      .from('tasks')
      .update({
        time_tracked: newTimeTracked
      })
      .eq('id', tracking.taskId);
    
    if (taskUpdateError) throw taskUpdateError;
    console.log(`Manual time tracking added successfully with id: ${data.id}`);
    
    return {
      id: data.id,
      taskId: data.task_id,
      startTime: new Date(data.start_time),
      endTime: data.end_time ? new Date(data.end_time) : undefined,
      duration: data.duration,
      notes: data.notes || undefined
    };
  } catch (error) {
    console.error(`Error adding manual time tracking for task ${tracking.taskId}:`, error);
    if (error.message) console.error('Error message:', error.message);
    if (error.details) console.error('Error details:', error.details);
    return handleSupabaseError(error, 'Failed to add manual time tracking');
  }
}

/**
 * Update a time tracking entry
 */
export async function updateTimeTracking(tracking: TimeTracking): Promise<void> {
  try {
    // Get the original tracking to calculate duration difference
    console.log(`Updating time tracking: ${tracking.id}`);
    const { data: originalTracking, error: getError } = await supabase
      .from('time_trackings')
      .select('duration, task_id')
      .eq('id', tracking.id)
      .single();
    
    if (getError) throw getError;
    
    // Calculate duration difference for task total time update
    const durationDifference = tracking.duration - originalTracking.duration;
    console.log(`Duration difference: ${durationDifference} minutes`);
    
    // Update the time tracking entry
    const { error } = await supabase
      .from('time_trackings')
      .update({
        start_time: tracking.startTime.toISOString(),
        end_time: tracking.endTime?.toISOString(),
        duration: tracking.duration,
        notes: tracking.notes
      })
      .eq('id', tracking.id);
    
    if (error) throw error;
    
    // Update the task's total tracked time if duration changed
    if (durationDifference !== 0) {
      console.log(`Updating task ${originalTracking.task_id} time tracked`);
      const { data: taskData, error: taskGetError } = await supabase
        .from('tasks')
        .select('time_tracked')
        .eq('id', originalTracking.task_id)
        .single();
      
      if (taskGetError) throw taskGetError;
      
      const newTimeTracked = Math.max(0, (taskData.time_tracked || 0) + durationDifference);
      console.log(`New time tracked for task: ${newTimeTracked} minutes`);
      
      const { error: taskUpdateError } = await supabase
        .from('tasks')
        .update({
          time_tracked: newTimeTracked
        })
        .eq('id', originalTracking.task_id);
      
      if (taskUpdateError) throw taskUpdateError;
      console.log(`Task time tracked updated successfully`);
    }
    
    console.log(`Time tracking updated successfully`);
  } catch (error) {
    console.error(`Error updating time tracking ${tracking.id}:`, error);
    if (error.message) console.error('Error message:', error.message);
    if (error.details) console.error('Error details:', error.details);
    handleSupabaseError(error, 'Failed to update time tracking');
  }
}

/**
 * Delete a time tracking entry
 */
export async function deleteTimeTracking(trackingId: string): Promise<void> {
  try {
    // Get the tracking entry to adjust task total time
    console.log(`Deleting time tracking: ${trackingId}`);
    const { data: tracking, error: getError } = await supabase
      .from('time_trackings')
      .select('duration, task_id')
      .eq('id', trackingId)
      .single();
    
    if (getError) throw getError;
    
    // Delete the time tracking entry
    console.log(`Deleting time tracking record with id: ${trackingId}`);
    const { error } = await supabase
      .from('time_trackings')
      .delete()
      .eq('id', trackingId);
    
    if (error) throw error;
    
    // Update the task's total tracked time
    console.log(`Updating task ${tracking.task_id} time tracked`);
    const { data: taskData, error: taskGetError } = await supabase
      .from('tasks')
      .select('time_tracked')
      .eq('id', tracking.task_id)
      .single();
    
    if (taskGetError) throw taskGetError;
    
    const newTimeTracked = Math.max(0, (taskData.time_tracked || 0) - tracking.duration);
    console.log(`New time tracked for task: ${newTimeTracked} minutes`);
    
    const { error: taskUpdateError } = await supabase
      .from('tasks')
      .update({
        time_tracked: newTimeTracked
      })
      .eq('id', tracking.task_id);
    
    if (taskUpdateError) throw taskUpdateError;
    
    console.log(`Time tracking deleted successfully`);
  } catch (error) {
    console.error(`Error deleting time tracking ${trackingId}:`, error);
    if (error.message) console.error('Error message:', error.message);
    if (error.details) console.error('Error details:', error.details);
    handleSupabaseError(error, 'Failed to delete time tracking');
  }
}