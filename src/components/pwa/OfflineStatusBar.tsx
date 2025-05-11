import React from 'react';
import { usePWAContext } from '@/context/PWAContext';
import { WifiOff, CloudSun, Cloud, RefreshCcw, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

export const OfflineStatusBar = () => {
  const { 
    isOnline, 
    networkStatus, 
    pendingChangesCount, 
    syncPendingChanges,
    newVersionAvailable,
    updateServiceWorker
  } = usePWAContext();
  
  const [syncing, setSyncing] = React.useState(false);

  // Hide the bar if we're online and have no pending changes or updates
  if (isOnline && pendingChangesCount === 0 && !newVersionAvailable) {
    return null;
  }

  const handleSync = async () => {
    if (!isOnline) {
      toast.error("Can't sync while offline. Please check your connection.");
      return;
    }

    setSyncing(true);
    toast.promise(
      syncPendingChanges()
        .finally(() => setSyncing(false)),
      {
        loading: 'Syncing your changes...',
        success: 'All changes synced successfully!',
        error: 'There was a problem syncing your changes.',
      }
    );
  };

  const handleUpdate = () => {
    toast.promise(
      new Promise<void>(async (resolve, reject) => {
        try {
          await updateServiceWorker();
          // The page will reload automatically after the service worker is updated
          resolve();
        } catch (error) {
          reject(error);
        }
      }),
      {
        loading: 'Updating application...',
        success: 'Update applied! The app will reload shortly.',
        error: 'Failed to update. Please refresh the page.',
      }
    );
  };
  
  // Convert connection quality to human-readable text and color
  const getConnectionInfo = () => {
    const { connectionQuality, latency } = networkStatus;
    
    let qualityText = '';
    let qualityColor = '';
    
    switch (connectionQuality) {
      case 'poor':
        qualityText = 'Poor connection';
        qualityColor = 'text-red-600';
        break;
      case 'moderate':
        qualityText = 'Moderate connection';
        qualityColor = 'text-amber-600';
        break;
      case 'good':
        qualityText = 'Good connection';
        qualityColor = 'text-green-600';
        break;
      case 'excellent':
        qualityText = 'Excellent connection';
        qualityColor = 'text-green-700';
        break;
      default:
        qualityText = 'Unknown connection';
        qualityColor = 'text-gray-600';
    }
    
    if (latency !== null) {
      qualityText += ` (${latency}ms)`;
    }
    
    return { qualityText, qualityColor };
  };

  // Determine the background color based on status
  const getBgColor = () => {
    if (!isOnline) return 'bg-red-50 text-red-800';
    if (newVersionAvailable) return 'bg-blue-50 text-blue-800';
    if (pendingChangesCount > 0) return 'bg-amber-50 text-amber-800';
    return 'bg-gray-50 text-gray-800';
  };
  
  // Determine the icon to display
  const getStatusIcon = () => {
    if (!isOnline) return <WifiOff size={18} className="text-red-600" />;
    if (newVersionAvailable) return <RefreshCcw size={18} className="text-blue-600" />;
    if (pendingChangesCount > 0) return <CloudSun size={18} className="text-amber-600" />;
    
    // Show connection quality icon when online
    const { connectionQuality } = networkStatus;
    
    switch (connectionQuality) {
      case 'poor':
      case 'moderate':
        return <Wifi size={18} className="text-amber-600" />;
      case 'good':
      case 'excellent':
        return <Wifi size={18} className="text-green-600" />;
      default:
        return <Wifi size={18} className="text-gray-600" />;
    }
  };

  return (
    <div className={`py-2 px-4 flex flex-col ${getBgColor()}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className="text-sm font-medium">
            {!isOnline 
              ? "You're offline. Changes will sync when you're back online." 
              : newVersionAvailable
                ? "A new version is available."
                : `${pendingChangesCount} change${pendingChangesCount !== 1 ? 's' : ''} pending to sync.`
            }
          </span>
        </div>
        
        {isOnline && (
          <div className="flex gap-2">
            {newVersionAvailable && (
              <Button 
                size="sm" 
                variant="outline" 
                className="text-xs bg-blue-100 border-blue-200 hover:bg-blue-200"
                onClick={handleUpdate}
              >
                <RefreshCcw className="h-3.5 w-3.5 mr-1" />
                Update
              </Button>
            )}
            
            {pendingChangesCount > 0 && (
              <Button 
                size="sm" 
                variant="outline" 
                className="text-xs bg-amber-100 border-amber-200 hover:bg-amber-200"
                onClick={handleSync}
                disabled={syncing}
              >
                <Cloud className="h-3.5 w-3.5 mr-1" />
                {syncing ? 'Syncing...' : 'Sync Now'}
              </Button>
            )}
          </div>
        )}
      </div>
      
      {isOnline && !newVersionAvailable && (
        <div className="mt-1 flex items-center gap-2 text-xs">
          <div className={`${getConnectionInfo().qualityColor}`}>
            {getConnectionInfo().qualityText}
          </div>
          
          {networkStatus.connectionQuality !== 'unknown' && (
            <Progress 
              value={
                networkStatus.connectionQuality === 'poor' ? 25 :
                networkStatus.connectionQuality === 'moderate' ? 50 :
                networkStatus.connectionQuality === 'good' ? 75 :
                networkStatus.connectionQuality === 'excellent' ? 100 : 0
              } 
              className="h-1.5 w-24" 
            />
          )}
          
          {networkStatus.effectiveType && (
            <span className="ml-auto text-xs opacity-75">
              {networkStatus.effectiveType.toUpperCase()}
            </span>
          )}
        </div>
      )}
      
      {syncing && pendingChangesCount > 0 && (
        <div className="mt-1">
          <Progress className="h-1" />
        </div>
      )}
    </div>
  );
};