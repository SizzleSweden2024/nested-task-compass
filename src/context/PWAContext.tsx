import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { registerSW } from '@/pwa/registerSW';

interface PWAContextType {
  offlineReady: boolean;
  needRefresh: boolean;
  updateServiceWorker: () => Promise<void>;
  isPWA: boolean;
  isInstallable: boolean;
  promptInstall: () => Promise<void>;
  isOnline: boolean;
  networkStatus: {
    connectionQuality: string;
    effectiveType: string | null;
    latency: number | null;
  };
  pendingChangesCount: number;
  syncPendingChanges: () => Promise<void>;
  newVersionAvailable: boolean;
  notificationPermission: string;
  notificationsEnabled: boolean;
  requestNotificationPermission: () => Promise<boolean>;
  setNotificationsEnabled: (enabled: boolean) => void;
  scheduleDailyNotification: (time: string) => void;
  scheduleTaskNotification: (task: any) => void;
}

const PWAContext = createContext<PWAContextType | undefined>(undefined);

export const PWAProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [offlineReady, setOfflineReady] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateSW, setUpdateSW] = useState<(() => Promise<boolean>) | null>(null);
  
  // PWA installation states
  const [isPWA, setIsPWA] = useState<boolean>(false);
  const [isInstallable, setIsInstallable] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  
  // Network status
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [networkStatus, setNetworkStatus] = useState({
    connectionQuality: 'unknown',
    effectiveType: null as string | null,
    latency: null as number | null
  });
  
  // Notification states
  const [notificationPermission, setNotificationPermission] = useState<string>(
    'Notification' in window ? Notification.permission : 'denied'
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(false);
  
  // Pending changes
  const [pendingChangesCount, setPendingChangesCount] = useState<number>(0);
  const [newVersionAvailable, setNewVersionAvailable] = useState<boolean>(false);

  useEffect(() => {
    // Register service worker
    registerSW({
      onOfflineReady() {
        setOfflineReady(true);
      },
      onNeedRefresh() {
        setNeedRefresh(true);
        setNewVersionAvailable(true);
      },
      onUpdate(updateFunction) {
        setUpdateSW(() => updateFunction);
      },
    }).then(updateFunction => {
      setUpdateSW(() => updateFunction);
    });
    
    // Check for PWA status
    if (window.matchMedia('(display-mode: standalone)').matches || 
        (window.navigator as any).standalone === true) {
      setIsPWA(true);
    }

    // Handle beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Handle app installed event
    const handleAppInstalled = () => {
      setIsInstallable(false);
      setIsPWA(true);
      setDeferredPrompt(null);
      console.log('PWA was installed');
    };
    window.addEventListener('appinstalled', handleAppInstalled);
    
    // Handle online/offline status
    const handleOnlineStatus = () => {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) {
        checkConnectionQuality();
      }
    };
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    // Check notification permission
    const checkNotificationPermission = () => {
      if ('Notification' in window) {
        setNotificationPermission(Notification.permission);
        setNotificationsEnabled(Notification.permission === 'granted');
      }
    };
    checkNotificationPermission();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);
  
  // Check connection quality
  const checkConnectionQuality = () => {
    if ('connection' in navigator && (navigator as any).connection) {
      const connection = (navigator as any).connection;
      let quality = 'unknown';
      
      if (connection.effectiveType === '4g') {
        quality = 'excellent';
      } else if (connection.effectiveType === '3g') {
        quality = 'good';
      } else if (connection.effectiveType === '2g') {
        quality = 'moderate';
      } else if (connection.effectiveType === 'slow-2g') {
        quality = 'poor';
      }
      
      setNetworkStatus({
        connectionQuality: quality,
        effectiveType: connection.effectiveType,
        latency: connection.rtt
      });
    }
  };

  const updateServiceWorker = async (): Promise<void> => {
    if (updateSW) {
      await updateSW();
    }
  };
  
  const promptInstall = async (): Promise<void> => {
    if (!deferredPrompt) {
      console.log('No installation prompt available');
      return;
    }

    deferredPrompt.prompt();

    const choiceResult = await deferredPrompt.userChoice;
    
    setDeferredPrompt(null);
    
    if (choiceResult.outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
  };
  
  const syncPendingChanges = async (): Promise<void> => {
    // Simplified version without authentication
    try {
      // Simulate sync
      await new Promise(resolve => setTimeout(resolve, 1000));
      setPendingChangesCount(0);
    } catch (error) {
      console.error('Error syncing changes:', error);
    }
  };
  
  const requestNotificationPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      const granted = permission === 'granted';
      setNotificationsEnabled(granted);
      return granted;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  };
  
  // Schedule a daily notification
  const scheduleDailyNotification = (time: string) => {
    if (notificationPermission !== 'granted' || !notificationsEnabled) return;
    
    // Simple implementation - store the time in local storage
    localStorage.setItem('dailyNotificationTime', time);
    console.log(`Daily notification set for ${time}`);
  };
  
  // Schedule a task notification
  const scheduleTaskNotification = (task: any) => {
    if (notificationPermission !== 'granted' || !notificationsEnabled) return;
    if (!task.dueDate || !task.timeSlot) return;
    
    // Simple implementation - we'd store this in a notification queue
    console.log(`Notification scheduled for task: ${task.title}`);
  };

  const contextValue: PWAContextType = {
    offlineReady,
    needRefresh,
    updateServiceWorker,
    isPWA,
    isInstallable,
    promptInstall,
    isOnline,
    networkStatus,
    pendingChangesCount,
    syncPendingChanges,
    newVersionAvailable,
    notificationPermission,
    notificationsEnabled,
    requestNotificationPermission,
    setNotificationsEnabled,
    scheduleDailyNotification,
    scheduleTaskNotification
  };

  return (
    <PWAContext.Provider value={contextValue}>
      {children}
    </PWAContext.Provider>
  );
};

// Export both usePWA and usePWAContext to fix the inconsistency
export const usePWAContext = () => {
  const context = useContext(PWAContext);
  if (!context) {
    throw new Error('usePWAContext must be used within a PWAProvider');
  }
  return context;
};

// Add this alias to fix the current usePWA imports
export const usePWA = usePWAContext;