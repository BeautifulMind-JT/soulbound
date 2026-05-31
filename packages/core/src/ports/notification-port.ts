/**
 * ⛔ CONTRACT-FROZEN — owned by Cowork. To change, say "unfreeze contract".
 * P0 implementation: NoopNotificationAdapter.
 */
export interface NotifyInput {
  readonly userId: string;
  readonly kind: string;
  readonly payload?: Record<string, unknown>;
}

export interface NotificationPort {
  notify(input: NotifyInput): Promise<void>;
}
