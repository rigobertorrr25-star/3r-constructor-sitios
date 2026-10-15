-- CreateTable
CREATE TABLE "automations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "trigger" VARCHAR(30) NOT NULL,
    "min_amount_cents" BIGINT,
    "actions" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "last_run_at" TIMESTAMPTZ(6),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "automation_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "status" VARCHAR(10) NOT NULL,
    "summary" VARCHAR(300) NOT NULL,
    "results" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_automations_company_trigger" ON "automations"("company_id", "trigger", "active");

-- CreateIndex
CREATE INDEX "idx_automation_runs_automation" ON "automation_runs"("automation_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_automation_runs_company" ON "automation_runs"("company_id", "created_at");

-- AddForeignKey
ALTER TABLE "automations" ADD CONSTRAINT "automations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

