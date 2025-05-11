import React, { useState, useEffect } from 'react';
import { useTaskContext, useTimeTrackingContext, Task } from '@/context/TaskContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatMinutes } from '@/lib/time-utils';
import { Switch } from '@/components/ui/switch';

interface AddTimeBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
  date: Date;
}

const generateTimeSlots = () => {
  const slots = [];
  for (let hour = 8; hour < 21; hour++) {
    const hourStr = hour % 12 === 0 ? 12 : hour % 12;
    const meridiem = hour < 12 ? 'AM' : 'PM';
    
    slots.push(`${hourStr}:00 ${meridiem}`);
    slots.push(`${hourStr}:30 ${meridiem}`);
  }
  return slots;
};

const timeSlots = generateTimeSlots();

const AddTimeBlockDialog: React.FC<AddTimeBlockDialogProps> = ({ 
  open, 
  onOpenChange, 
  task,
  date
}) => {
  const { addTimeBlock, timeTrackings } = useTimeTrackingContext();
  
  const [startTime, setStartTime] = useState(timeSlots[0]);
  const [endTime, setEndTime] = useState(timeSlots[2]);
  const [useTrackedTime, setUseTrackedTime] = useState(false);
  
  const taskDayTrackings = timeTrackings.filter(tracking => 
    tracking.taskId === task.id && 
    format(new Date(tracking.startTime), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
  );
  
  const totalTrackedMinutes = taskDayTrackings.reduce((sum, tracking) => sum + tracking.duration, 0);
  const hasTrackedTime = totalTrackedMinutes > 0;
  
  useEffect(() => {
    if (!hasTrackedTime || !useTrackedTime) return;
    
    if (taskDayTrackings.length > 0) {
      const earliestTracking = taskDayTrackings.reduce((earliest, current) => {
        const currentStart = new Date(current.startTime);
        const earliestStart = new Date(earliest.startTime);
        return currentStart < earliestStart ? current : earliest;
      });
      
      const latestTracking = taskDayTrackings.reduce((latest, current) => {
        if (current.endTime) {
          const currentEnd = new Date(current.endTime);
          const latestEnd = latest.endTime ? new Date(latest.endTime) : new Date();
          return currentEnd > latestEnd ? current : latest;
        } else {
          const currentEnd = new Date();
          const latestEnd = latest.endTime ? new Date(latest.endTime) : new Date();
          return currentEnd > latestEnd ? current : latest;
        }
      });
      
      const startHour = new Date(earliestTracking.startTime).getHours();
      const startMinute = new Date(earliestTracking.startTime).getMinutes();
      const roundedStartMinute = startMinute < 30 ? 0 : 30;
      
      const endTime = latestTracking.endTime ? new Date(latestTracking.endTime) : new Date();
      const endHour = endTime.getHours();
      const endMinute = endTime.getMinutes();
      const roundedEndMinute = endMinute < 30 ? 0 : 30;
      const roundUpEndHour = endMinute > 30 ? endHour + 1 : endHour;
      
      const formattedStartHour = startHour % 12 === 0 ? 12 : startHour % 12;
      const startMeridiem = startHour < 12 ? 'AM' : 'PM';
      const suggestedStart = `${formattedStartHour}:${roundedStartMinute === 0 ? '00' : '30'} ${startMeridiem}`;
      
      const formattedEndHour = roundUpEndHour % 12 === 0 ? 12 : roundUpEndHour % 12;
      const endMeridiem = roundUpEndHour < 12 ? 'AM' : 'PM';
      const suggestedEnd = `${formattedEndHour}:${roundedEndMinute === 0 ? '00' : '30'} ${endMeridiem}`;
      
      const closestStartSlot = timeSlots.find(slot => slot === suggestedStart) || timeSlots[0];
      const closestEndSlot = timeSlots.find(slot => slot === suggestedEnd) || 
                            timeSlots[Math.min(timeSlots.indexOf(closestStartSlot) + 1, timeSlots.length - 1)];
      
      setStartTime(closestStartSlot);
      setEndTime(closestEndSlot);
    }
  }, [useTrackedTime, taskDayTrackings, hasTrackedTime]);

  const handleAddTimeBlock = () => {
    addTimeBlock({
      taskId: task.id,
      date,
      startTime,
      endTime
    });
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Time Block for Task</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div>
            <p className="font-medium">{task.title}</p>
            {task.description && (
              <p className="text-sm text-muted-foreground">{task.description}</p>
            )}
          </div>
          
          <div className="grid gap-2">
            <Label>Date</Label>
            <div className="p-2 border rounded-md">
              {format(date, 'PPPP')}
            </div>
          </div>
          
          {hasTrackedTime && (
            <div className="flex items-center space-x-2">
              <Switch
                id="use-tracked-time"
                checked={useTrackedTime}
                onCheckedChange={setUseTrackedTime}
              />
              <Label htmlFor="use-tracked-time">
                Use tracked time ({formatMinutes(totalTrackedMinutes)})
              </Label>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="start-time">Start Time</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger id="start-time">
                  <SelectValue placeholder="Select start time" />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="end-time">End Time</Label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger id="end-time">
                  <SelectValue placeholder="Select end time" />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map((time) => (
                    <SelectItem 
                      key={time} 
                      value={time}
                      disabled={timeSlots.indexOf(time) <= timeSlots.indexOf(startTime)}
                    >
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {hasTrackedTime && (
            <div className="text-sm text-muted-foreground">
              <Label className="text-sm">Tracked time sessions:</Label>
              <ul className="mt-1 space-y-1">
                {taskDayTrackings.map((tracking, idx) => (
                  <li key={tracking.id} className="flex justify-between">
                    <span>
                      {format(new Date(tracking.startTime), 'h:mm a')} - 
                      {tracking.endTime ? format(new Date(tracking.endTime), ' h:mm a') : ' ongoing'}
                    </span>
                    <span>{formatMinutes(tracking.duration)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddTimeBlock}>
            Add Time Block
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddTimeBlockDialog;