-- CreateTable
CREATE TABLE "loyalty_programs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(60) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "goal" INTEGER NOT NULL DEFAULT 10,
    "cooldown_minutes" INTEGER NOT NULL DEFAULT 180,
    "rewards" JSONB NOT NULL,
    "owner_key_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_staff" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "program_id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "pin_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "program_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "consent_at" TIMESTAMPTZ(6) NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "card_number" INTEGER NOT NULL DEFAULT 1,
    "failed_pins" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "last_visit_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "program_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "staff_id" UUID,
    "kind" VARCHAR(20) NOT NULL,
    "card_number" INTEGER NOT NULL,
    "reward_at" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_programs_slug_key" ON "loyalty_programs"("slug");

-- CreateIndex
CREATE INDEX "loyalty_staff_program_id_idx" ON "loyalty_staff"("program_id");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_customers_token_hash_key" ON "loyalty_customers"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_customers_program_id_phone_key" ON "loyalty_customers"("program_id", "phone");

-- CreateIndex
CREATE INDEX "loyalty_events_program_id_created_at_idx" ON "loyalty_events"("program_id", "created_at");

-- CreateIndex
CREATE INDEX "loyalty_events_customer_id_card_number_idx" ON "loyalty_events"("customer_id", "card_number");

-- AddForeignKey
ALTER TABLE "loyalty_staff" ADD CONSTRAINT "loyalty_staff_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "loyalty_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_customers" ADD CONSTRAINT "loyalty_customers_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "loyalty_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_events" ADD CONSTRAINT "loyalty_events_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "loyalty_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_events" ADD CONSTRAINT "loyalty_events_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "loyalty_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_events" ADD CONSTRAINT "loyalty_events_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "loyalty_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
