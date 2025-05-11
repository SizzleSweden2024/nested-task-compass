import { Task } from './TaskTypes';
import { v4 as uuidv4 } from 'uuid';

export const generateId = () => uuidv4();

export const findTaskById = (taskId: string, taskList: Task[]): Task | undefined => {
  for (const task of taskList) {
    if (task.id === taskId) return task;
    if (task.children.length > 0) {
      const foundTask = findTaskById(taskId, task.children);
      if (foundTask) return foundTask;
    }
  }
  return undefined;
};

export const updateTaskInHierarchy = (
  taskId: string,
  updateFn: (task: Task) => Task,
  taskList: Task[]
): Task[] =>
  taskList.map(task =>
    task.id === taskId
      ? updateFn(task)
      : {
          ...task,
          children: updateTaskInHierarchy(taskId, updateFn, task.children)
        }
  );

export const getRootTasks = (tasks: Task[]) => tasks.filter(task => !task.parentId);

export const deleteTaskFromHierarchy = (
  taskId: string,
  taskList: Task[]
): Task[] =>
  taskList.filter(task => {
    if (task.id === taskId) return false;
    if (task.children.length > 0) {
      task.children = deleteTaskFromHierarchy(taskId, task.children);
    }
    return true;
  });

// Ensure a string is a valid UUID
export const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

// Convert legacy task IDs to UUIDs if needed
export const ensureUUID = (id: string): string => {
  if (isValidUUID(id)) return id;
  
  // If it's a legacy ID like "task-1-2", generate a new UUID
  // and store the mapping in localStorage for consistency
  const mappingKey = 'khonja_id_mapping';
  let mapping = {};
  
  try {
    const storedMapping = localStorage.getItem(mappingKey);
    if (storedMapping) {
      mapping = JSON.parse(storedMapping);
    }
  } catch (e) {
    console.error('Error parsing ID mapping:', e);
  }
  
  if (mapping[id]) {
    return mapping[id];
  }
  
  const newId = uuidv4();
  mapping[id] = newId;
  
  try {
    localStorage.setItem(mappingKey, JSON.stringify(mapping));
  } catch (e) {
    console.error('Error storing ID mapping:', e);
  }
  
  return newId;
};