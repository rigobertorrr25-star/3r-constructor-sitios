-- CreateTable
CREATE TABLE "module_prices" (
    "key" VARCHAR(40) NOT NULL,
    "monthly_price" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_prices_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "company_subscriptions" (
    "company_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'trial',
    "trial_ends_at" DATE,
    "billing_day" INTEGER NOT NULL DEFAULT 1,
    "notes" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_subscriptions_pkey" PRIMARY KEY ("company_id")
);

-- CreateTable
CREATE TABLE "company_invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "number" SERIAL NOT NULL,
    "company_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "items" JSONB NOT NULL,
    "total" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'pending',
    "paid_at" TIMESTAMPTZ(6),
    "method" VARCHAR(20),
    "payment_note" VARCHAR(300),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoice_id" UUID NOT NULL,
    "reference" VARCHAR(100) NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'COP',
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "provider_transaction_id" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_invoices_number_key" ON "company_invoices"("number");

-- CreateIndex
CREATE INDEX "idx_company_invoices_company_status" ON "company_invoices"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "company_invoices_company_id_period_start_key" ON "company_invoices"("company_id", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_payments_reference_key" ON "invoice_payments"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_payments_provider_transaction_id_key" ON "invoice_payments"("provider_transaction_id");

-- CreateIndex
CREATE INDEX "idx_invoice_payments_invoice" ON "invoice_payments"("invoice_id");

-- AddForeignKey
ALTER TABLE "company_subscriptions" ADD CONSTRAINT "company_subscriptions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_invoices" ADD CONSTRAINT "company_invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "company_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
