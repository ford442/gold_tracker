import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getNotificationPermission,
  isNotificationSupported,
  permissionStatusLabel,
  requestNotificationPermission,
  showBrowserNotification,
} from './alertNotifications';

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('alertNotifications', () => {
  it('reports unsupported when Notification API is absent', () => {
    expect(isNotificationSupported()).toBe(false);
    expect(getNotificationPermission()).toBe('unsupported');
    expect(permissionStatusLabel('unsupported')).toContain('Not supported');
  });

  it('maps permission states to labels', () => {
    expect(permissionStatusLabel('granted')).toBe('Enabled');
    expect(permissionStatusLabel('denied')).toContain('Blocked');
  });

  it('requests permission when supported', async () => {
    const requestPermission = vi.fn(async () => 'granted' as NotificationPermission);
    class MockNotification {
      static permission: NotificationPermission = 'default';
      static requestPermission = requestPermission;
    }

    vi.stubGlobal('Notification', MockNotification);
    vi.stubGlobal('window', { Notification: MockNotification });

    await expect(requestNotificationPermission()).resolves.toBe('granted');

    MockNotification.permission = 'granted';
    expect(showBrowserNotification('Title', 'Body')).toBe(true);
  });
});
