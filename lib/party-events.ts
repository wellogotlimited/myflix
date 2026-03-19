type PartyEvent =
  | { type: "state"; party: unknown }
  | { type: "ended"; code: string };

type PartyListener = (event: PartyEvent) => void;

const listeners = new Map<string, Set<PartyListener>>();

export function subscribeToParty(code: string, listener: PartyListener) {
  const existing = listeners.get(code) ?? new Set<PartyListener>();
  existing.add(listener);
  listeners.set(code, existing);

  return () => {
    const current = listeners.get(code);
    if (!current) return;

    current.delete(listener);
    if (current.size === 0) {
      listeners.delete(code);
    }
  };
}

export function publishPartyEvent(code: string, event: PartyEvent) {
  const current = listeners.get(code);
  if (!current) return;

  for (const listener of current) {
    listener(event);
  }
}
