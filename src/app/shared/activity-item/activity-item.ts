import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { ActivityEntry } from '../../core/models/activity';
import { describeActivity } from '../../core/utils/activity-text';
import { ExactDatePipe } from '../pipes/friendly-date';

/** One activity entry as a sentence with an icon, its time and where it came from. */
@Component({
  selector: 'app-activity-item',
  imports: [DatePipe, ExactDatePipe],
  templateUrl: './activity-item.html',
  styleUrl: './activity-item.css',
})
export class ActivityItem {
  entry = input.required<ActivityEntry>();
  /** Write it from this person's point of view ("You signed in"). */
  meId = input<string | null>(null);
  /** Show the date with the time (lists not grouped by day). */
  withDate = input(false);

  text = computed(() => describeActivity(this.entry(), this.meId()));
}
