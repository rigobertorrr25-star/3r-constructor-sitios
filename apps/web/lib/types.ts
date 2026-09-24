export type Site = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: 'draft' | 'published' | 'archived' | string;
  createdAt: string;
  updatedAt: string;
  _count: { pages: number };
};

export type Template = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  isPremium: boolean;
};

export type CurrentUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  roles: string[];
  emailVerifiedAt: string | null;
};

export type ApiError = { message?: string | string[]; code?: string };

/** La API devuelve `message` como texto o como lista (validación). */
export function errorText(data: ApiError | null | undefined, fallback: string) {
  const message = data?.message;
  if (Array.isArray(message)) return message.join('. ');
  return message || fallback;
}

export type PageSummary = {
  id: string;
  title: string;
  slug: string;
  isHomepage: boolean;
  isPublished: boolean;
  sortOrder: number;
  updatedAt: string;
};

export type SiteDetail = Site & { pages: PageSummary[] };

export type PageContent = {
  versionId: string;
  versionNumber: number;
  content: unknown;
  updatedAt: string;
};

export type VersionSummary = { id: string; versionNumber: number; createdBy: string | null; createdAt: string };

// ───────── tienda de páginas ─────────

export type Package = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  priceCents: number;
  monthlyPriceCents: number | null;
  currency: string;
  features: string[];
  pagesIncluded: number;
  deliveryDays: number | null;
  isFeatured: boolean;
  sortOrder: number;
  isActive?: boolean;
  _count?: { orders: number };
};

export type OrderStatus = 'new' | 'awaiting_payment' | 'in_progress' | 'in_review' | 'delivered' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';

export type Brief = {
  businessName: string;
  businessType: string;
  description: string;
  phone?: string;
  city?: string;
  hasDomain?: boolean;
  domainWanted?: string;
  styleNotes?: string;
  references?: string;
  pagesWanted?: string;
  extra?: string;
};

export type OrderEvent = {
  id: string;
  kind: 'status' | 'payment' | 'message' | 'note' | 'delivery';
  body: string | null;
  metadata: Record<string, unknown> | null;
  visibleToClient?: boolean;
  fromTeam: boolean;
  createdAt: string;
};

export type OrderSummary = {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  priceCents: number;
  monthlyPriceCents: number | null;
  currency: string;
  amountPaidCents: number;
  deliveryUrl: string | null;
  createdAt: string;
  updatedAt: string;
  package: { name: string; slug: string };
};

export type FormSubmission = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  createdAt: string;
};

export type OrderDetail = OrderSummary & {
  brief: Brief;
  deliveredAt: string | null;
  events: OrderEvent[];
  formSubmissions: FormSubmission[];
};

export type AdminOrderRow = OrderSummary & {
  siteId: string | null;
  brief: Brief;
  user: { email: string; firstName: string | null };
};

export type AdminOrderDetail = AdminOrderRow & {
  deliveredAt: string | null;
  site: { id: string; name: string } | null;
  events: OrderEvent[];
};

export type AdminStats = { counts: Record<OrderStatus, number>; collectedCents: number };

export type PortfolioItem = {
  id: string;
  title: string;
  url: string;
  category: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  sortOrder: number;
  isActive?: boolean;
};

export type PublicationStatus = {
  published: boolean;
  url: string | null;
  publishedAt: string | null;
  hasUnpublishedChanges: boolean;
};
