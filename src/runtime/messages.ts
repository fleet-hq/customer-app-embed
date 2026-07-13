export const EMBED_MESSAGE_NAMESPACE = "fleethq:embed";

export type EmbedInboundMessage =
  | { type: "ready"; height?: number; url?: string }
  | { type: "resize"; height: number }
  | { type: "close" }
  | { type: "navigate"; url: string }
  | { type: "booking-complete"; bookingId: number; referenceNumber?: string; url?: string }
  | { type: "booking-error"; message: string; code?: string }
  | { type: "handoff"; url: string }
  | { type: "scroll-into-view" };

export type EmbedOutboundMessage =
  | { type: "hello"; version: string; tenant: string }
  | { type: "close" }
  | { type: "focus" }
  | { type: "resize-hint"; maxHeight: number };

export interface EmbedEnvelope<T> {
  namespace: typeof EMBED_MESSAGE_NAMESPACE;
  payload: T;
}

const HEIGHT_MIN = 300;
const HEIGHT_MAX = 5000;

export const packMessage = <T>(payload: T): EmbedEnvelope<T> => ({
  namespace: EMBED_MESSAGE_NAMESPACE,
  payload,
});

export const unpackMessage = <T>(raw: unknown): T | null => {
  if (!raw || typeof raw !== "object") return null;
  const envelope = raw as Partial<EmbedEnvelope<T>>;
  if (envelope.namespace !== EMBED_MESSAGE_NAMESPACE) return null;
  if (!envelope.payload || typeof envelope.payload !== "object") return null;
  return envelope.payload as T;
};

export const clampHeight = (height: unknown): number => {
  const num = typeof height === "number" ? height : Number(height);
  if (!Number.isFinite(num)) return HEIGHT_MIN;
  return Math.min(Math.max(Math.round(num), HEIGHT_MIN), HEIGHT_MAX);
};

export const originMatches = (a: string, b: string): boolean => {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.protocol === ub.protocol && ua.host === ub.host;
  } catch {
    return false;
  }
};
