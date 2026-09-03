export const queryKeys = {
  health: ["health"] as const,
  me: ["admin", "me"] as const,
  kitchen: ["kitchen"] as const,
  floor: ["floor"] as const,
  bill: (sessionId: string) => ["bill", sessionId] as const,
};
