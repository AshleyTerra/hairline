/**
 * Prototype time.
 *
 * Every figure on screen belongs to the demo trading day, so work rung up now
 * has to join that day rather than the real calendar. Stamp a sale with the
 * actual date and it drops out of Clients today, off the daybook and out of the
 * reports — parked by reception and then nowhere to be found.
 *
 * The time of day is real, so a docket still says when it was opened.
 */
import { meta } from "./data";

/** The demo day at the real time of day, as `YYYY-MM-DDTHH:MM:SS`. */
export function demoNow(real: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(real.getHours())}:${pad(real.getMinutes())}:${pad(real.getSeconds())}`;
  return `${meta.demoDate}T${time}`;
}

/** The day the prototype is trading. */
export const demoToday = (): string => meta.demoDate;
