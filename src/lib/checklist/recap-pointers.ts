export interface Pointer {
  /** true = nothing to do here; false = needs attention */
  clear: boolean;
  text: string;
  href?: string;
}

export interface RecapCounts {
  openActions: number;
  halfRegistered: number;
  savedUndecided: number;
  followUps: number;
  happened: number;
  briefingSentAt: string | null; // already formatted, IST
  newSinceMonday: number;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Short, plain pointers about last week, built only from real counts. */
export function recapPointers(c: RecapCounts): Pointer[] {
  return [
    c.openActions
      ? { clear: false, text: `${plural(c.openActions, "action", "actions")} from last week still open`, href: "/checklist" }
      : { clear: true, text: "No unfinished actions from last week" },
    c.halfRegistered
      ? { clear: false, text: `${plural(c.halfRegistered, "registration", "registrations")} started but not finished`, href: "/pipeline" }
      : { clear: true, text: "No registrations left half done" },
    c.savedUndecided
      ? { clear: false, text: `${plural(c.savedUndecided, "saved event", "saved events")} still waiting for a decision`, href: "/pipeline" }
      : { clear: true, text: "No saved events waiting on a decision" },
    c.followUps
      ? { clear: false, text: `${plural(c.followUps, "follow up", "follow ups")} to send after events you attended`, href: "/pipeline" }
      : { clear: true, text: "No follow ups waiting" },
    c.happened
      ? { clear: false, text: `${plural(c.happened, "event", "events")} on your list took place last week: mark how they went`, href: "/pipeline" }
      : { clear: true, text: "Nothing on your list took place last week" },
    c.briefingSentAt
      ? { clear: true, text: `Last Monday's briefing went out ${c.briefingSentAt}` }
      : { clear: true, text: "No Monday briefing was sent last week" },
    { clear: true, text: `${plural(c.newSinceMonday, "new event", "new events")} found since Monday`, href: "/events" },
  ];
}
