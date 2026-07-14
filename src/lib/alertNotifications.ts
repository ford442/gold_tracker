/**
 * Browser Notification API helpers — permission UX and delivery.
 */

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermissionState {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission as NotificationPermissionState;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!isNotificationSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const result = await Notification.requestPermission();
    return result as NotificationPermissionState;
  } catch {
    return 'denied';
  }
}

export function showBrowserNotification(title: string, body: string, tag?: string): boolean {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return false;
  try {
    new Notification(title, {
      body,
      tag: tag ?? 'goldtrackr-alert',
      icon: './icon.svg',
    });
    return true;
  } catch {
    return false;
  }
}

export function permissionStatusLabel(state: NotificationPermissionState): string {
  switch (state) {
    case 'granted':
      return 'Enabled';
    case 'denied':
      return 'Blocked — enable in browser site settings';
    case 'default':
      return 'Not requested yet';
    case 'unsupported':
      return 'Not supported in this browser';
  }
}
