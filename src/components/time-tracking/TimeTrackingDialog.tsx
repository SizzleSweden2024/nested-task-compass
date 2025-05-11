import React, { useState, useEffect } from 'react';
import { useTaskContext, useTimeTrackingContext, Task } from '@/context/TaskContext';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import ActiveTracking from './ActiveTracking';
import TimeTrackingControls from './TimeTrackingControls';
import TrackingHistory from './TrackingHistory';
import ManualTimeEntry from './ManualTimeEntry';

interface TimeTrackingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
}

const TimeTrackingDialog: React.FC<TimeTrackingDialogProps> = ({ 
  open, 
  onOpenChange, 
  task 
}) => {
  const { 
    timeTrackings, 
    activeTimeTracking, 
    startTimeTracking, 
    stopTimeTracking,
    updateTimeTracking,
    deleteTimeTracking
  } = useTimeTrackingContext();
  
  const [notes, setNotes] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const taskTrackings = timeTrackings.filter(tracking => tracking.taskId === task.id);
  const isCurrentlyTracking = activeTimeTracking && activeTimeTracking.taskId === task.id;
  
  useEffect(() => {
    if (!isCurrentlyTracking || !activeTimeTracking) return;
    
    const intervalId = setInterval(() => {
      const now = new Date();
      const startTime = new Date(activeTimeTracking.startTime);
      const elapsedSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      setElapsedTime(elapsedSeconds);
    }, 1000);
    
    return () => clearInterval(intervalId);
  }, [isCurrentlyTracking, activeTimeTracking]);
  
  useEffect(() => {
    if (open) {
      setNotes('');
    }
  }, [open]);
  
  const handleStartTracking = () => {
    startTimeTracking(task.id, notes);
    setNotes('');
  };
  
  const handleAddManualEntry = () => {
    // Implementation for adding manual time entry
    console.log('Add manual time entry');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Time Tracking - {task.title}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Active tracking section */}
          <div className="border rounded-md p-4">
            <h3 className="text-lg font-medium mb-3">Track Time</h3>
            
            {isCurrentlyTracking ? (
              <ActiveTracking 
                isCurrentlyTracking={isCurrentlyTracking}
                elapsedTime={elapsedTime}
                activeTimeTracking={activeTimeTracking}
                onStopTracking={stopTimeTracking}
              />
            ) : (
              <TimeTrackingControls
                notes={notes}
                onNotesChange={setNotes}
                onStartTracking={handleStartTracking}
              />
            )}
          </div>
          
          {/* Time tracking history */}
          <div className="border rounded-md">
            <div className="bg-muted/50 p-3 font-medium flex justify-between items-center">
              <h3>Time Tracking History</h3>
              <ManualTimeEntry onAddManualEntry={handleAddManualEntry} />
            </div>
            
            <TrackingHistory
              trackings={taskTrackings}
              onUpdateTracking={updateTimeTracking}
              onDeleteTracking={deleteTimeTracking}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TimeTrackingDialog;