/**
 * Notification Service — simplified for standalone deployment.
 * Logs notifications; can be extended to email/webhook later.
 */
export type NotificationPayload = {
  title: string;
  content: string;
};

export async function notifyOwner(
  payload: NotificationPayload
): Promise<boolean> {
  console.log(`[Notification] ${payload.title}: ${payload.content}`);
  return true;
}
