/**
 * Service Worker registration and update handling
 */
interface RegisterSWOptions {
  onOfflineReady?: () => void;
  onNeedRefresh?: () => void;
  onUpdate?: (update: () => Promise<boolean>) => void;
}

export function registerSW(options: RegisterSWOptions = {}): Promise<() => Promise<boolean>> {
  const { onOfflineReady, onNeedRefresh, onUpdate } = options;
  
  // Create a function to update the service worker
  const updateSW = async (): Promise<boolean> => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration.waiting) {
        // Send a message to the waiting service worker to skip waiting
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        return true;
      }
    }
    return false;
  };

  // Register the service worker
  if ('serviceWorker' in navigator) {
    // Wait for the page to load
    window.addEventListener('load', async () => {
      try {
        // Unregister any existing service workers first
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(registration => registration.unregister()));
        
        // Register the new service worker
        const registration = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/',
          type: 'module'
        });
        
        // Handle service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          
          newWorker.addEventListener('statechange', () => {
            // When the service worker is installed and waiting
            if (newWorker.state === 'installed') {
              // If there's an existing controller, it means this is an update
              if (navigator.serviceWorker.controller) {
                if (onNeedRefresh) onNeedRefresh();
                if (onUpdate) onUpdate(updateSW);
              } else {
                // First time installation
                if (onOfflineReady) onOfflineReady();
              }
            }
          });
        });
        
        // Check if there's already a waiting service worker
        if (registration.waiting && navigator.serviceWorker.controller) {
          if (onNeedRefresh) onNeedRefresh();
          if (onUpdate) onUpdate(updateSW);
        }
        
        // Handle controller change (after skipWaiting)
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!refreshing) {
            refreshing = true;
            window.location.reload();
          }
        });
        
        console.log('Service worker registered successfully');
      } catch (error) {
        console.error('Service worker registration failed:', error);
      }
    });
  }

  return Promise.resolve(updateSW);
}