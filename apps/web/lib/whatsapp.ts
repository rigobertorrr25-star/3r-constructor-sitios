// WhatsApp empresarial: tipos y textos visibles.

export type WaMessage = {
  id: string;
  direction: 'in' | 'out';
  type: string;
  body: string;
  status: 'received' | 'sent' | 'delivered' | 'read' | 'failed';
  error: string | null;
  sentById: string | null;
  createdAt: string;
};
export type WaConversation = {
  id: string;
  waId: string;
  name: string;
  contactId: string | null;
  lastMessageAt: string;
  lastInboundAt: string | null;
  unread: number;
  assignedMemberId: string | null;
  status: 'open' | 'closed';
  canReply: boolean;
};
export type WaTemplate = { id: string; name: string; language: string; body: string; params: number };
export type WaOverview = {
  connected: boolean;
  account: { displayPhone: string; status: string } | null;
  canManage: boolean;
  meId: string;
  conversations: (WaConversation & { last: { body: string; direction: 'in' | 'out' } | null })[];
  templates: WaTemplate[];
  members: { id: string; name: string }[];
};
export type WaConversationDetail = WaConversation & { messages: WaMessage[] };
export type WaAdmin = {
  account: { phoneNumberId: string; wabaId: string; displayPhone: string; status: string; updatedAt: string } | null;
  webhookPath: string;
};

export const STATUS_MARK: Record<WaMessage['status'], string> = { received: '', sent: '✓', delivered: '✓✓', read: '✓✓ leído', failed: 'No se envió' };
/** "573001234567" → "+57 300 123 4567". */
export const prettyPhone = (waId: string) =>
  waId.startsWith('57') && waId.length === 12 ? `+57 ${waId.slice(2, 5)} ${waId.slice(5, 8)} ${waId.slice(8)}` : `+${waId}`;
export const fillTemplate = (body: string, params: string[]) => body.replace(/\{\{(\d+)\}\}/g, (_, n) => params[Number(n) - 1] || `{{${n}}}`);
