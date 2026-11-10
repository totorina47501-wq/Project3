export type FeedbackOrigin = 'landing' | 'guide';

export type MarketingFeedbackInput = {
  message: string;
  sourceUrl: string | null;
  consent: true;
  origin: FeedbackOrigin;
  utm: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
  } | null;
};

export type MarketingFeedbackReceipt = {
  feedbackId: string;
  deleteToken: string;
  receivedAt: string;
};

type StoredFeedback = MarketingFeedbackInput & {
  feedbackId: string;
  deleteToken: string;
  receivedAt: string;
};

const feedbackStore = new Map<string, StoredFeedback>();

export function storeMarketingFeedback(input: MarketingFeedbackInput): MarketingFeedbackReceipt {
  const feedbackId = crypto.randomUUID();
  const deleteToken = crypto.randomUUID();
  const receivedAt = new Date().toISOString();
  feedbackStore.set(feedbackId, { ...input, feedbackId, deleteToken, receivedAt });
  return { feedbackId, deleteToken, receivedAt };
}

export function deleteMarketingFeedback(feedbackId: string, deleteToken: string): boolean {
  const existing = feedbackStore.get(feedbackId);
  if (!existing || existing.deleteToken !== deleteToken) return false;
  return feedbackStore.delete(feedbackId);
}

export function __unsafeResetMarketingFeedbackStore() {
  feedbackStore.clear();
}
