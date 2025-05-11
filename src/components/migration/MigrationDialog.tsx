import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Progress } from '@/components/ui/progress';
import { 
  migrateDataToSupabase, 
  isMigrationNeeded, 
  markMigrationCompleted 
} from '@/services/migrationService';

interface MigrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMigrationComplete: () => void;
}

const MigrationDialog: React.FC<MigrationDialogProps> = ({
  open,
  onOpenChange,
  onMigrationComplete
}) => {
  // Since we're removing auth, assume a default user for simplicity
  const userId = 'default-user';
  
  const [isMigrating, setIsMigrating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [migrationStatus, setMigrationStatus] = useState('');
  
  // Check migration status when dialog opens
  useEffect(() => {
    if (open) {
      const migrationNeeded = isMigrationNeeded();
      if (!migrationNeeded) {
        onOpenChange(false);
      }
    }
  }, [open, onOpenChange]);
  
  const handleMigrateData = async () => {
    setIsMigrating(true);
    setProgress(0);
    setMigrationStatus('Starting migration...');
    
    try {
      const success = await migrateDataToSupabase((status, progressValue) => {
        setMigrationStatus(status);
        setProgress(progressValue);
      });
      
      if (success) {
        markMigrationCompleted();
        toast({
          title: "Migration successful",
          description: "Your data has been successfully migrated to the cloud.",
        });
        onMigrationComplete();
      } else {
        toast({
          title: "Migration failed",
          description: "There was an error migrating your data. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Migration error:", error);
      toast({
        title: "Migration failed",
        description: "There was an error migrating your data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsMigrating(false);
      onOpenChange(false);
    }
  };
  
  const handleSkip = () => {
    toast({
      title: "Migration skipped",
      description: "You can migrate your data later from the settings.",
    });
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Migrate Your Data</DialogTitle>
          <DialogDescription>
            We've detected data stored in your browser. Would you like to migrate it to your account?
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-2">
            Migrating will transfer your:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Projects</li>
            <li>Tasks and subtasks</li>
            <li>Time tracking entries</li>
            <li>Calendar time blocks</li>
          </ul>
          
          <p className="mt-4 text-sm">
            This ensures your data is securely stored in the cloud and available across devices.
          </p>
          
          {isMigrating && (
            <div className="mt-4 space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-xs text-muted-foreground">{migrationStatus}</p>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={isMigrating}
          >
            Skip for now
          </Button>
          <Button
            onClick={handleMigrateData}
            disabled={isMigrating}
          >
            {isMigrating ? "Migrating..." : "Migrate my data"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MigrationDialog;