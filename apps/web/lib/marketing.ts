// Marketing: tipos y textos visibles.

export type Segment = { stages: string[]; sources: string[]; tags: string[] };
export type CampaignStats = { sent: number; failed: number; pending: number; skipped: number; unsubscribed: number };
export type CampaignStatus = 'draft' | 'sending' | 'sent';
export type Campaign = {
  id: string;
  name: string;
  subject: string;
  body: string;
  segment: Segment;
  status: CampaignStatus;
  recipientCount: number;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type CampaignDetail = Campaign & { audience: number; stats: CampaignStats; canSend: boolean; remainingToday: number };
export type MarketingOverview = {
  canSend: boolean;
  newsletterToken: string | null;
  audience: { eligible: number; withEmail: number; unsubscribed: number };
  dailyCap: number;
  remainingToday: number;
  tags: string[];
  campaigns: (Omit<Campaign, 'body'> & { excerpt: string; stats: CampaignStats })[];
};

export const STATUS_LABEL: Record<CampaignStatus, string> = { draft: 'Borrador', sending: 'Enviando', sent: 'Enviada' };
export const STATUS_CLASS: Record<CampaignStatus, string> = {
  draft: 'bg-white/[0.06] text-muted-foreground',
  sending: 'bg-[#ffd27a]/15 text-[#ffe2a6]',
  sent: 'bg-[#5ee0a0]/15 text-[#9df0c6]',
};

export const people = (n: number) => `${n} ${n === 1 ? 'persona' : 'personas'}`;
