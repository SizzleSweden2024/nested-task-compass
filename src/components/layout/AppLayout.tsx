import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProjectView from '@/components/projects/ProjectView';
import CalendarView from '@/components/calendar/CalendarView';
import { useTaskContext, useViewModeContext } from '@/context/TaskContext';
import { Plus, Calendar, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import AddTaskFormDialog from '@/components/tasks/AddTaskFormDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineStatusBar } from '@/components/pwa/OfflineStatusBar';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { NotificationSettings } from '@/components/pwa/NotificationSettings';
import { usePWAContext } from '@/context/PWAContext';

const AppLayout = () => {
  const { isPWA } = usePWAContext();
  
  // Use the unified task context which automatically picks the correct provider
  const context = useTaskContext();
  const { addProject } = context;
  
  const { selectedView, setSelectedView } = useViewModeContext();
  
  const [isAddingProject, setIsAddingProject] = React.useState(false);
  const [isAddingTask, setIsAddingTask] = React.useState(false);
  const [newProject, setNewProject] = React.useState({
    name: '',
    description: ''
  });
  
  const isMobile = useIsMobile();
  
  const handleAddProject = () => {
    if (newProject.name.trim()) {
      addProject(newProject);
      setNewProject({
        name: '',
        description: ''
      });
      setIsAddingProject(false);
    }
  };
  
  const handleTabChange = (value: string) => {
    if (value === 'projects' || value === 'calendar') {
      setSelectedView(value);
    }
  };
  
  return (
    <ErrorBoundary>
      <div className="flex flex-col min-h-screen">
        <OfflineStatusBar />
        
        <div className="container mx-auto md:py-6 space-y-4 md:space-y-8 md:px-6 px-0 py-[20px] flex-1">
          {/* PWA Prompts and Settings */}
          <div className="space-y-4">
            {!isPWA && <InstallPrompt />}
            <NotificationSettings />
          </div>
          
          <Tabs defaultValue="projects" value={selectedView} onValueChange={handleTabChange}>
            <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center w-full gap-2 md:gap-4">
                <h1 className="text-xl md:text-3xl font-bold mr-2 md:mr-4 text-orange-600">Khonja</h1>
                <TabsList className="grid grid-cols-2 w-40 md:w-48 shrink-0">
                  <TabsTrigger value="projects" className="flex items-center">
                    <CheckSquare className="h-4 w-4 mr-1 md:mr-2" />
                    <span className={isMobile ? "text-xs" : ""}>All tasks</span>
                  </TabsTrigger>
                  <TabsTrigger value="calendar" className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1 md:mr-2" />
                    <span className={isMobile ? "text-xs" : ""}>Calendar</span>
                  </TabsTrigger>
                </TabsList>
                <span className="flex-1" />
                <div className="flex gap-1 md:gap-2">
                  <AddTaskFormDialog 
                    open={isAddingTask} 
                    onOpenChange={setIsAddingTask} 
                    triggerElement={
                      <Button size={isMobile ? "sm" : "default"}>
                        <Plus className="h-4 w-4" />
                        {!isMobile && <span className="ml-2 text-slate-50">New Task</span>}
                      </Button>
                    } 
                  />
                  <Dialog open={isAddingProject} onOpenChange={setIsAddingProject}>
                    <DialogTrigger asChild>
                      <Button size={isMobile ? "sm" : "default"}>
                        <Plus className="h-4 w-4" />
                        {!isMobile && <span className="ml-2">New Project</span>}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[90vw] md:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Create New Project</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Project Name</Label>
                          <Input id="name" value={newProject.name} onChange={e => setNewProject({
                            ...newProject,
                            name: e.target.value
                          })} placeholder="Enter project name" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="description">Description (Optional)</Label>
                          <Textarea id="description" value={newProject.description} onChange={e => setNewProject({
                            ...newProject,
                            description: e.target.value
                          })} placeholder="Enter project description" />
                        </div>
                        <Button onClick={handleAddProject} className="w-full">
                          Create Project
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </header>

            <TabsContent value="projects" className="mt-4 md:mt-6">
              <ProjectView />
            </TabsContent>
            <TabsContent value="calendar" className="mt-4 md:mt-6">
              <CalendarView />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default AppLayout;