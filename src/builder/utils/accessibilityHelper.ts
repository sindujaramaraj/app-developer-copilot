import { AccessibilityInfo, findNodeHandle } from 'react-native';

export async function announceForAccessibility(announcement: string): Promise<void> {
  try {
    await AccessibilityInfo.announceForAccessibility(announcement);
  } catch (error) {
    console.error('Error announcing for accessibility:', error);
  }
}

export function setAccessibilityFocus(ref: React.RefObject<any>): void {
  const node = findNodeHandle(ref.current);
  if (node) {
    AccessibilityInfo.setAccessibilityFocus(node);
  } else {
    console.error('Error setting accessibility focus: node not found');
  }
}

export function isScreenReaderEnabled(): Promise<boolean> {
  return AccessibilityInfo.isScreenReaderEnabled();
}

export function addScreenReaderListener(callback: (isEnabled: boolean) => void): void {
  AccessibilityInfo.addEventListener('screenReaderChanged', callback);
}

export function removeScreenReaderListener(callback: (isEnabled: boolean) => void): void {
  AccessibilityInfo.removeEventListener('screenReaderChanged', callback);
}
