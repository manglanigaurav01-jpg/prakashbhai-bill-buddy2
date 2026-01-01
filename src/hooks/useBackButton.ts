import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

interface UseBackButtonOptions {
  onBackButton: () => boolean;
  enabled?: boolean;
}

export const useBackButton = ({ onBackButton, enabled = true }: UseBackButtonOptions) => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !enabled) {
      return;
    }

    const handler = CapacitorApp.addListener('backButton', (event) => {
      const shouldPreventDefault = onBackButton();
      
      if (!shouldPreventDefault && event.canGoBack === false) {
        CapacitorApp.exitApp();
      }
    });

    return () => {
      handler.then(h => h.remove());
    };
  }, [onBackButton, enabled]);
};
