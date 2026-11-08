import { formatDate } from '@angular/common';
import { inject, LOCALE_ID, Pipe, PipeTransform } from '@angular/core';

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Short, human date for tables: "Today, 9:41 PM", "Yesterday, 8:02 AM",
 * "Oct 26" (this year) or "Oct 26, 2025".
 */
export function friendlyDate(value: DateInput, locale = 'en-US', now = new Date()): string {
  const date = toDate(value);
  if (!date) return '—';
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days === 0) return `Today, ${formatDate(date, 'shortTime', locale)}`;
  if (days === 1) return `Yesterday, ${formatDate(date, 'shortTime', locale)}`;
  return formatDate(date, date.getFullYear() === now.getFullYear() ? 'MMM d' : 'MMM d, y', locale);
}

/** "Friendly" date for display; pair with `exactDate` in a tooltip. */
@Pipe({ name: 'friendlyDate' })
export class FriendlyDatePipe implements PipeTransform {
  private locale = inject(LOCALE_ID);

  transform(value: DateInput): string {
    return friendlyDate(value, this.locale);
  }
}

/** Full date and time, e.g. for a title tooltip. */
@Pipe({ name: 'exactDate' })
export class ExactDatePipe implements PipeTransform {
  private locale = inject(LOCALE_ID);

  transform(value: DateInput): string {
    const date = toDate(value);
    return date ? formatDate(date, 'medium', this.locale) : '';
  }
}
