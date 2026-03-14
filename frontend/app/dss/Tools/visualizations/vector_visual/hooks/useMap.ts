// Custom React hooks for map functionality
//file: frontend/app/dss/visualizations/vector/hooks/useMap.ts
import { useState, useRef, useCallback } from 'react';
import { ManagedLayer, NotificationType } from '../types/map.types';

/**
 * Hook for managing layers on the map
 */
export function useManagedLayers(mapInstanceRef: React.RefObject<any>) {
  const [managedLayers, setManagedLayers] = useState<ManagedLayer[]>([]);
  const layerIdCounterRef = useRef(0);

  const addManagedLayer = useCallback((
    name: string, 
    layer: any, 
    type: 'geojson' | 'uploaded' | 'drawn'
  ): string => {
    const id = `layer_${layerIdCounterRef.current++}`;
    setManagedLayers(prev => [...prev, { id, name, layer, visible: true, type }]);
    return id;
  }, []);

  const toggleLayerVisibility = useCallback((id: string) => {
    setManagedLayers(prev => prev.map(ml => {
      if (ml.id === id) {
        const newVisible = !ml.visible;
        if (mapInstanceRef.current && ml.layer) {
          if (newVisible) {
            if (!mapInstanceRef.current.hasLayer(ml.layer)) {
              mapInstanceRef.current.addLayer(ml.layer);
            }
          } else {
            if (mapInstanceRef.current.hasLayer(ml.layer)) {
              mapInstanceRef.current.removeLayer(ml.layer);
            }
          }
        }
        return { ...ml, visible: newVisible };
      }
      return ml;
    }));
  }, [mapInstanceRef]);

  const removeLayer = useCallback((id: string) => {
    setManagedLayers(prev => {
      const layerToRemove = prev.find(ml => ml.id === id);
      if (layerToRemove && layerToRemove.layer && mapInstanceRef.current) {
        if (mapInstanceRef.current.hasLayer(layerToRemove.layer)) {
          mapInstanceRef.current.removeLayer(layerToRemove.layer);
        }
      }
      return prev.filter(ml => ml.id !== id);
    });
  }, [mapInstanceRef]);

  return {
    managedLayers,
    addManagedLayer,
    toggleLayerVisibility,
    removeLayer,
  };
}

/**
 * Hook for shapefile upload progress tracking
 */
export function useUploadProgress() {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [progressText, setProgressText] = useState<string>('');
  const uploadTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startSimulatedProgress = useCallback(() => {
    setUploadProgress(0);
    setProgressText('Upload 0% complete');
    
    if (uploadTimerRef.current) clearInterval(uploadTimerRef.current);
    
    let p = 0;
    uploadTimerRef.current = setInterval(() => {
      p = Math.min(95, p + Math.max(1, Math.round((95 - p) * 0.08)));
      setUploadProgress(p);
      setProgressText(`Upload ${p}% complete`);
      
      if (p >= 95) {
        if (uploadTimerRef.current) {
          clearInterval(uploadTimerRef.current);
          uploadTimerRef.current = null;
        }
      }
    }, 200);
  }, []);

  const completeProgress = useCallback(() => {
    if (uploadTimerRef.current) {
      clearInterval(uploadTimerRef.current);
      uploadTimerRef.current = null;
    }
    setUploadProgress(100);
    setProgressText('Upload 100% complete');
    
    setTimeout(() => {
      setUploadProgress(0);
      setProgressText('');
    }, 1200);
  }, []);

  const failProgress = useCallback(() => {
    if (uploadTimerRef.current) {
      clearInterval(uploadTimerRef.current);
      uploadTimerRef.current = null;
    }
    setProgressText('Upload failed');
    
    setTimeout(() => {
      setUploadProgress(0);
      setProgressText('');
    }, 1500);
  }, []);

  return {
    uploading,
    setUploading,
    uploadProgress,
    progressText,
    startSimulatedProgress,
    completeProgress,
    failProgress,
  };
}

/**
 * Hook for notification management
 */
export function useNotification() {
  const [notification, setNotification] = useState({
    show: false,
    title: '',
    message: '',
    type: 'success'
  });

  const showNotification = useCallback((
    title: string, 
    message: string, 
    type: NotificationType = 'success'
  ) => {
    setNotification({
      show: true,
      title,
      message,
      type
    });

    // Auto hide after 4 seconds
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 4000);
  }, []);

  return {
    notification,
    showNotification,
  };
}