import { supabase } from '@/integrations/supabase/client';
import { handleSupabaseError, prepareDatesForSupabase, processSupabaseData, getCurrentUserId, projectsCache, getCacheKey } from './serviceUtils';
import { Project } from '@/context/TaskTypes';

/**
 * Fetch all projects for the current user
 */
export async function getProjects(): Promise<Project[]> {
  try {
    const cacheKey = getCacheKey('projects');
    // Get the user ID directly without authentication
    const userId = await getCurrentUserId();
    
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('name');
    
    if (error) throw error;
    
    const projects = data.map(project => ({
      id: project.id,
      name: project.name,
      description: project.description || undefined,
      isExpanded: project.is_expanded || false,
    }));

    return projects;
  } catch (error) {
    return handleSupabaseError(error, 'Failed to fetch projects');
  }
}

/**
 * Create a new project
 */
export async function createProject(project: Omit<Project, 'id'>): Promise<Project> {
  try {
    const result = await _createProject(project);
    projectsCache.clear(); // Clear cache on mutation
    return result;
  } catch (error) {
    return handleSupabaseError(error, 'Failed to create project');
  }
}

async function _createProject(project: Omit<Project, 'id'>): Promise<Project> {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('projects')
    .insert({
      name: project.name,
      description: project.description,
      is_expanded: project.isExpanded,
      user_id: userId
    })
    .select()
    .single();
  
  if (error) throw error;
  
  return {
    id: data.id,
    name: data.name,
    description: data.description || undefined,
    isExpanded: data.is_expanded || false,
  };
}

/**
 * Update an existing project
 */
export async function updateProject(project: Project): Promise<void> {
  try {
    await _updateProject(project);
    projectsCache.clear(); // Clear cache on mutation
  } catch (error) {
    handleSupabaseError(error, 'Failed to update project');
  }
}

async function _updateProject(project: Project): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({
      name: project.name,
      description: project.description,
      is_expanded: project.isExpanded
    })
    .eq('id', project.id);
  
  if (error) throw error;
}

/**
 * Delete a project
 */
export async function deleteProject(projectId: string): Promise<void> {
  try {
    await _deleteProject(projectId);
    projectsCache.clear(); // Clear cache on mutation
  } catch (error) {
    handleSupabaseError(error, 'Failed to delete project');
  }
}

async function _deleteProject(projectId: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);
  
  if (error) throw error;
}

/**
 * Toggle project expanded state
 */
export async function toggleProjectExpanded(projectId: string, isExpanded: boolean): Promise<void> {
  try {
    const { error } = await supabase
      .from('projects')
      .update({ is_expanded: isExpanded })
      .eq('id', projectId);
    
    if (error) throw error;
  } catch (error) {
    handleSupabaseError(error, 'Failed to update project state');
  }
}
