// Haptic feedback utility using Capacitor Haptics
// Falls back gracefully if not available (web environment)

export type HapticImpactStyle = 'light' | 'medium' | 'heavy';
export type HapticNotificationType = 'success' | 'warning' | 'error';

let hapticsAvailable = false;
let Haptics: any = null;

// Try to load Capacitor Haptics plugin
const initHaptics = async () => {
  if (hapticsAvailable) return;
  
  try {
    // Dynamic import to avoid build errors if plugin not installed
    const { Haptics: CapacitorHaptics } = await import('@capacitor/haptics');
    Haptics = CapacitorHaptics;
    hapticsAvailable = true;
  } catch (error) {
    // Plugin not available (web environment or not installed)
    hapticsAvailable = false;
  }
};

// Initialize on first use
initHaptics().catch(() => {});

export const triggerHaptic = async (style: HapticImpactStyle = 'medium') => {
  try {
    if (!hapticsAvailable) {
      await initHaptics();
    }
    
    if (Haptics && hapticsAvailable) {
      await Haptics.impact({ style });
    }
  } catch (error) {
    // Silently fail - haptics not available
    console.debug('Haptics not available:', error);
  }
};

export const triggerHapticNotification = async (type: HapticNotificationType) => {
  try {
    if (!hapticsAvailable) {
      await initHaptics();
    }
    
    if (Haptics && hapticsAvailable) {
      await Haptics.notification({ type });
    }
  } catch (error) {
    // Silently fail - haptics not available
    console.debug('Haptics not available:', error);
  }
};

export const triggerHapticSelection = async () => {
  try {
    if (!hapticsAvailable) {
      await initHaptics();
    }
    
    if (Haptics && hapticsAvailable) {
      await Haptics.selectionStart();
      await new Promise(resolve => setTimeout(resolve, 10));
      await Haptics.selectionChanged();
    }
  } catch (error) {
    // Silently fail - haptics not available
    console.debug('Haptics not available:', error);
  }
};

// Convenience functions for common actions
export const hapticSuccess = () => triggerHapticNotification('success');
export const hapticWarning = () => triggerHapticNotification('warning');
export const hapticError = () => triggerHapticNotification('error');
export const hapticLight = () => triggerHaptic('light');
export const hapticMedium = () => triggerHaptic('medium');
export const hapticHeavy = () => triggerHaptic('heavy');

