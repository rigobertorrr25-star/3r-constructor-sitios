-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "newsletter_token" VARCHAR(64);

-- AlterTable
ALTER TABLE "crm_contacts" ADD COLUMN     "marketing_opt_in" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "marketing_opt_in_at" TIMESTAMPTZ(6),
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "unsubscribed_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "subject" VARCHAR(150) NOT NULL,
    "body" TEXT NOT NULL,
    "segment" JSONB NOT NULL DEFAULT '{}',
    "status" VARCHAR(10) NOT NULL DEFAULT 'draft',
    "recipient_count" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMPTZ(6),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_recipients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaign_id" UUID NOT NULL,
    "contact_id" UUID,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'pending',
    "token" VARCHAR(40) NOT NULL,
    "sent_at" TIMESTAMPTZ(6),
    "unsubscribed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_campaigns_company" ON "campaigns"("company_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_recipients_token_key" ON "campaign_recipients"("token");

-- CreateIndex
CREATE INDEX "idx_campaign_recipients_status" ON "campaign_recipients"("campaign_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "companies_newsletter_token_key" ON "companies"("newsletter_token");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

