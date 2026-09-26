export const RESERVATION_WINDOW_SECONDS = 5 * 60;

export function secondsUntil(expiresAt: Date | string, now = Date.now()) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
}

export function formatCountdown(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function countdownProgress(seconds: number, windowSeconds = RESERVATION_WINDOW_SECONDS) {
  return Math.max(0, Math.min(100, (seconds / windowSeconds) * 100));
}
