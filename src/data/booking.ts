import { dateLocale, t } from '@/i18n';
import { supabase } from '../../lib/supabase';
import type { RestaurantSummary } from './restaurants';

const BOOKING_DAYS = 14;
const SLOT_MINUTES = 30;
/** Last booking is an hour before closing; same-day slots need 30 minutes' notice. */
const LAST_SLOT_BEFORE_CLOSE_MINUTES = 60;
const SAME_DAY_NOTICE_MINUTES = 30;

const pad = (value: number) => String(value).padStart(2, '0');
const toMinutes = (time: string) => { const [hours, minutes] = time.split(':').map(Number); return hours * 60 + minutes; };
const toTime = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
export const isoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Today plus the next 13 days, labelled "Today", "Tomorrow", then "Thu 21". */
export function bookingDates(now = new Date()) {
  return Array.from({ length: BOOKING_DAYS }, (_, offset) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const label = offset === 0 ? t('booking.today') : offset === 1 ? t('booking.tomorrow') : date.toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric' });
    return { iso: isoDate(date), label, month: date.toLocaleDateString(dateLocale(), { month: 'short' }) };
  });
}

/** Bookable times for one day, every 30 minutes within opening hours. */
export function bookingSlots(restaurant: Pick<RestaurantSummary, 'opensAt' | 'closesAt'>, dateIso: string, now = new Date()) {
  const open = toMinutes(restaurant.opensAt || '08:00');
  let close = toMinutes(restaurant.closesAt || '22:00');
  if (close <= open) close = 24 * 60; // Open past midnight: offer slots until the end of the day.
  const last = close - LAST_SLOT_BEFORE_CLOSE_MINUTES;
  const earliest = dateIso === isoDate(now) ? now.getHours() * 60 + now.getMinutes() + SAME_DAY_NOTICE_MINUTES : 0;
  const slots: string[] = [];
  for (let minutes = Math.ceil(open / SLOT_MINUTES) * SLOT_MINUTES; minutes <= last; minutes += SLOT_MINUTES) {
    if (minutes >= earliest) slots.push(toTime(minutes));
  }
  return slots;
}

/** Seats already booked per time ("19:00" -> 12) for one restaurant and day. Empty when offline. */
export async function fetchBookedSeats(restaurantId: number, dateIso: string): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc('slot_availability', { p_restaurant_id: restaurantId, p_date: dateIso });
  if (error || !Array.isArray(data)) return new Map();
  return new Map((data as { slot_time: string; booked: number }[]).map((row) => [String(row.slot_time).slice(0, 5), row.booked]));
}

/** "Thu 21 Nov at 19:00" */
export function formatBooking(dateIso: string, time: string) {
  const [year, month, day] = dateIso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return t('booking.at', { date: dateIso, time });
  return t('booking.at', { date: date.toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' }), time });
}
