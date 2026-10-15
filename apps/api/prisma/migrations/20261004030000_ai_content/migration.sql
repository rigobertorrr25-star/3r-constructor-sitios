-- CreateTable
CREATE TABLE "ai_generations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "member_id" UUID,
    "kind" VARCHAR(20) NOT NULL,
    "tone" VARCHAR(20) NOT NULL,
    "topic" VARCHAR(1000) NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_ai_generations_company" ON "ai_generations"("company_id", "created_at");

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

