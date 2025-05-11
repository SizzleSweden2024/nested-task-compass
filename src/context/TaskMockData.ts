import { Project, Task, TimeBlock } from './TaskTypes';
import { v4 as uuidv4 } from 'uuid';

// Generate UUIDs for consistent IDs
const generateId = () => uuidv4();

export const sampleProjects: Project[] = [
  { id: generateId(), name: "Personal", description: "Personal and errands", isExpanded: true },
  { id: generateId(), name: "Work", description: "Tasks for work", isExpanded: true },
  { id: generateId(), name: "Fitness", description: "Workout routines", isExpanded: true },
  { id: generateId(), name: "Learning", description: "Courses and study", isExpanded: true },
];

// Store project IDs for reference
const projectIds = {
  personal: sampleProjects[0].id,
  work: sampleProjects[1].id,
  fitness: sampleProjects[2].id,
  learning: sampleProjects[3].id
};

// Create tasks with proper UUIDs
const createTask = (
  title: string, 
  projectId: string, 
  options: Partial<Task> = {}
): Task => ({
  id: generateId(),
  title,
  description: options.description || "",
  priority: options.priority || "medium",
  projectId,
  dueDate: options.dueDate,
  notes: options.notes || "",
  estimatedTime: options.estimatedTime,
  timeTracked: 0,
  children: [],
  isExpanded: true,
  ...options
});

// Create parent tasks first
const personalTask1 = createTask("Buy groceries", projectIds.personal, {
  description: "Get vegetables, fruits, snacks",
  priority: "medium",
  dueDate: new Date(Date.now() - 48 * 60 * 60 * 1000), // overdue
  estimatedTime: 45
});

const personalTask2 = createTask("Clean living room", projectIds.personal, {
  description: "Vacuum and dust all surfaces",
  priority: "high",
  dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
  estimatedTime: 30
});

const personalTask3 = createTask("Call plumber", projectIds.personal, {
  description: "Fix bathroom sink",
  priority: "low",
  estimatedTime: 15
});

const workTask1 = createTask("Prepare Q2 slides", projectIds.work, {
  description: "Q2 presentation deck",
  priority: "high",
  dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
  estimatedTime: 80
});

const workTask2 = createTask("Send invoices", projectIds.work, {
  description: "For Q1 clients",
  priority: "medium",
  estimatedTime: 20
});

const workTask3 = createTask("Review PRs", projectIds.work, {
  description: "Check merged pull requests",
  priority: "low",
  estimatedTime: 50
});

const fitnessTask1 = createTask("Morning run", projectIds.fitness, {
  description: "5km run in park",
  priority: "medium",
  dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
  estimatedTime: 40
});

const fitnessTask2 = createTask("Yoga session", projectIds.fitness, {
  description: "Evening yoga",
  priority: "low",
  estimatedTime: 60
});

const fitnessTask3 = createTask("Plan meals", projectIds.fitness, {
  description: "Healthy weekly meal plan",
  priority: "high",
  estimatedTime: 30
});

const learningTask1 = createTask("Study JavaScript", projectIds.learning, {
  description: "Complete function closures topic",
  priority: "high",
  dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
  estimatedTime: 100,
  timeTracked: 30
});

const learningTask2 = createTask("Solve math quiz", projectIds.learning, {
  description: "Algebra and calculus",
  priority: "medium",
  estimatedTime: 90
});

const learningTask3 = createTask("Read React docs", projectIds.learning, {
  description: "Hooks, effects",
  priority: "low",
  estimatedTime: 60
});

// Create child tasks
const personalTask1Child1 = createTask("Buy apples", projectIds.personal, {
  priority: "low",
  parentId: personalTask1.id
});

const personalTask1Child2 = createTask("Buy broccoli", projectIds.personal, {
  priority: "medium",
  parentId: personalTask1.id
});

// Add children to parent task
personalTask1.children = [personalTask1Child1, personalTask1Child2];

// Combine all tasks
export const sampleTasks: Task[] = [
  personalTask1,
  personalTask2,
  personalTask3,
  workTask1,
  workTask2,
  workTask3,
  fitnessTask1,
  fitnessTask2,
  fitnessTask3,
  learningTask1,
  learningTask2,
  learningTask3
];

export const sampleTimeBlocks: TimeBlock[] = [
  {
    id: generateId(),
    taskId: learningTask1.id,
    date: new Date(),
    startTime: "10:00",
    endTime: "11:00"
  },
  {
    id: generateId(),
    taskId: personalTask1.id,
    date: new Date(Date.now() - 24 * 60 * 60 * 1000),
    startTime: "08:00",
    endTime: "08:30"
  }
];