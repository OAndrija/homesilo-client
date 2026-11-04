import { Pipe, PipeTransform } from '@angular/core';

const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const dayMonth = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const full = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const exact = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** "Today, 14:05", "Yesterday", "Nov 4" (this year) or "Apr 18, 2025". */
export function friendlyDate(value: string | Date | null | undefined, now = new Date()): string {
  const date = toDate(value);
  if (!date) return '—';
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 86_400_000;
  if (date.getTime() >= startOfToday) return `Today, ${time.format(date)}`;
  if (date.getTime() >= startOfToday - dayMs) return 'Yesterday';
  if (date.getFullYear() === now.getFullYear()) return dayMonth.format(date);
  return full.format(date);
}

/** Full date and time, for tooltips. */
export function exactDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? exact.format(date) : '';
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

@Pipe({ name: 'friendlyDate' })
export class FriendlyDatePipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    return friendlyDate(value);
  }
}

@Pipe({ name: 'exactDate' })
export class ExactDatePipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    return exactDate(value);
  }
}
