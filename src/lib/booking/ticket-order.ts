// Order of the repair ticket list. Pure, so it can be unit tested.
//
// 1. Upcoming appointments (scheduled_at >= now), soonest first.
// 2. Everything else (no time, or a time in the past), newest first: by the
//    appointment time when there is one, otherwise by when the ticket was made.

export type TicketWhen = "upcoming" | "past";

export type OrderableTicket = { id: string; scheduled_at: string | null; created_at: string };

const ms = (iso: string) => new Date(iso).getTime();

export function isUpcoming(t: Pick<OrderableTicket, "scheduled_at">, now: Date) {
  return t.scheduled_at !== null && ms(t.scheduled_at) >= now.getTime();
}

/**
 * Merges ticket rows (possibly from several queries, possibly overlapping),
 * drops duplicates, orders them as above and keeps the first `limit`.
 */
export function orderTickets<T extends OrderableTicket>(rows: Iterable<T>, now: Date, limit = Infinity): T[] {
  const byId = new Map<string, T>();
  for (const r of rows) if (!byId.has(r.id)) byId.set(r.id, r);

  const upcoming: T[] = [];
  const rest: T[] = [];
  for (const t of byId.values()) (isUpcoming(t, now) ? upcoming : rest).push(t);

  upcoming.sort((a, b) => ms(a.scheduled_at!) - ms(b.scheduled_at!) || ms(a.created_at) - ms(b.created_at));
  const restKey = (t: T) => ms(t.scheduled_at ?? t.created_at);
  rest.sort((a, b) => restKey(b) - restKey(a) || ms(b.created_at) - ms(a.created_at));

  return [...upcoming, ...rest].slice(0, limit);
}
