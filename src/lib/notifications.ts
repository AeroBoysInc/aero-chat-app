/** Request browser/OS notification permission on first use */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

/** Show a system notification — only when the window is not focused */
export function showMessageNotification(senderName: string, preview: string) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (document.hasFocus()) return; // already looking at the app

  new Notification(`AeroChat — ${senderName}`, {
    body: preview,
    icon: '/icons/icon.png',
    silent: false,
  });
}

/** Show a system notification for an incoming call — fires even when gaming */
export function showCallNotification(callerName: string, callType: 'audio' | 'video') {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (document.hasFocus()) return;

  new Notification(`Incoming ${callType} call — AeroChat`, {
    body: `${callerName} is calling you`,
    icon: '/icons/icon.png',
    silent: false,
  });
}

/** Show a system notification for a group message */
export function showGroupMessageNotification(groupName: string, senderName: string, preview: string) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (document.hasFocus()) return;

  new Notification(`${groupName} — ${senderName}`, {
    body: preview,
    icon: '/icons/icon.png',
    silent: false,
  });
}

/** Show a system notification for a group invite */
export function showGroupInviteNotification(groupName: string, inviterName: string) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (document.hasFocus()) return;

  new Notification('Group Invite — AeroChat', {
    body: `${inviterName} invited you to ${groupName}`,
    icon: '/icons/icon.png',
    silent: false,
  });
}
