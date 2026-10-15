-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "quote_seq" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "quotes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "contact_id" UUID,
    "client_name" VARCHAR(150) NOT NULL,
    "client_company" VARCHAR(150),
    "client_email" VARCHAR(255),
    "client_phone" VARCHAR(50),
    "title" VARCHAR(150) NOT NULL,
    "notes" VARCHAR(4000),
    "discount" BIGINT NOT NULL DEFAULT 0,
    "tax_rate" INTEGER NOT NULL DEFAULT 0,
    "subtotal" BIGINT NOT NULL DEFAULT 0,
    "tax" BIGINT NOT NULL DEFAULT 0,
    "total" BIGINT NOT NULL DEFAULT 0,
    "valid_until" DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "token_hash" VARCHAR(64),
    "sent_at" TIMESTAMPTZ(6),
    "viewed_at" TIMESTAMPTZ(6),
    "responded_at" TIMESTAMPTZ(6),
    "response_name" VARCHAR(150),
    "response_message" VARCHAR(2000),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quote_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" BIGINT NOT NULL,

    CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotes_token_hash_key" ON "quotes"("token_hash");

-- CreateIndex
CREATE INDEX "idx_quotes_company_status" ON "quotes"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_company_id_number_key" ON "quotes"("company_id", "number");

-- CreateIndex
CREATE INDEX "idx_quote_items_quote" ON "quote_items"("quote_id");

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
