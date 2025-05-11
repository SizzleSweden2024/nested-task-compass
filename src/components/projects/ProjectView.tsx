import React from 'react';
import { useTaskContext } from '@/context/TaskContext';
import ProjectItem from './ProjectItem';
import { GroupBy, useFilterContext } from '@/context/FilterContext';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ProjectViewOptions from './ProjectViewOptions';
import FilterButton from '@/components/filters/FilterButton';
import FilterPills from '@/components/filters/FilterPills';
import { ChevronDown } from 'lucide-react';
import { filterTasks, sortTasks, groupTasks } from '@/utils/filters';
import { useIsMobile } from '@/hooks/use-mobile';
import AddTaskDialog from './AddTaskDialog';

const ProjectView: React.FC = () => {
  const {
    projects,
    tasks
  } = useTaskContext();
  const {
    activeFilters,
    groupBy,
    sortBy,
    sortDirection,
    excludeCompleted
  } = useFilterContext();
  const [isAddTaskOpen, setIsAddTaskOpen] = React.useState(false);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(null);
  const isMobile = useIsMobile();

  const filteredTasks = filterTasks(tasks, activeFilters, excludeCompleted);
  const sortedTasks = sortTasks(filteredTasks, sortBy, sortDirection);

  const taskGroups = groupTasks(sortedTasks, groupBy, projects);
  const handleAddTask = (projectId: string) => {
    setSelectedProjectId(projectId);
    setIsAddTaskOpen(true);
  };

  const renderFilterButton = () => {
    if (isMobile) {
      return <FilterButton forMobile />;
    }
    return <FilterButton />;
  };

  return <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Everything</h2>
        <div className="flex gap-2">
          <ProjectViewOptions />
          {renderFilterButton()}
        </div>
      </div>

      <FilterPills />

      {groupBy !== GroupBy.NONE ? <div className="space-y-6">
          {taskGroups.map(group => <Collapsible key={group.id} defaultOpen={true} className="border rounded-md">
              <CollapsibleTrigger className="flex justify-between items-center p-4 w-full hover:bg-muted px-0 py-0">
                <h3 className="text-sm text-orange-600 font-bold">{group.title} ({group.tasks.length})</h3>
                <ChevronDown size={20} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pb-4 px-0">
                {group.tasks.length > 0 ? <div className="space-y-1">
                    {group.tasks.map(task => <div key={task.id} className={`pl-${isMobile ? '0' : '4'}`}>
                        {React.createElement(ProjectItem, {
                          project: projects.find(p => p.id === task.projectId) || {
                            id: '',
                            name: 'Unknown'
                          },
                          hideChildrenInitially: true,
                          showOnlyTasks: [task.id],
                          onAddTask: handleAddTask,
                          listMode: true
                        })}
                      </div>)}
                  </div> : <p className="text-muted-foreground p-4">No tasks in this group</p>}
              </CollapsibleContent>
            </Collapsible>)}
        </div> : <div className="space-y-2">
          {projects.map(project => <ProjectItem key={project.id} project={project} onAddTask={() => handleAddTask(project.id)} />)}
        </div>}

      {projects.length === 0 && <div className="text-center py-10">
          <p className="text-muted-foreground mb-4">No projects yet. Create your first project to get started!</p>
        </div>}

      <AddTaskDialog 
        open={isAddTaskOpen} 
        onOpenChange={setIsAddTaskOpen} 
        projectId={selectedProjectId || ''} 
      />
    </div>;
};

export default ProjectView;