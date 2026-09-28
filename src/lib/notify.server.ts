import { sendPushToUser, type PushMessage } from "./push.server";

/**
 * One place to deliver user notifications. Push is live; SMS is a stub so a provider
 * (Semaphore, Twilio…) can be plugged in later by implementing `smsChannel`.
 */
export type NotifyChannel = {
  name: string;
  send: (userId: string, msg: PushMessage) => Promise<boolean>;
};

const pushChannel: NotifyChannel = {
  name: "push",
  send: async (userId, msg) => (await sendPushToUser(userId, msg)) > 0,
};

const smsChannel: NotifyChannel = {
  name: "sms",
  // Not configured yet. Implement using SMS_PROVIDER / SMS_API_KEY and the profile phone.
  send: async () => false,
};

export async function notify(userId: string, msg: PushMessage, channels: NotifyChannel[] = [pushChannel, smsChannel]) {
  const results: Record<string, boolean> = {};
  for (const c of channels) {
    try {
      results[c.name] = await c.send(userId, msg);
    } catch {
      results[c.name] = false;
    }
  }
  return results;
}
