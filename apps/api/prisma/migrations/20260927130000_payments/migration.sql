-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "provider" VARCHAR(20) NOT NULL DEFAULT 'wompi',
    "reference" VARCHAR(100) NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" VARCHAR(10) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "provider_transaction_id" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_reference_key" ON "payments"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_transaction_id_key" ON "payments"("provider_transaction_id");

-- CreateIndex
CREATE INDEX "idx_payments_order_id" ON "payments"("order_id");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
