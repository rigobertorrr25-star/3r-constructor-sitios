-- AlterTable
ALTER TABLE "company_documents" ADD COLUMN     "ai_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ai_status" VARCHAR(10) NOT NULL DEFAULT 'none';

-- CreateTable
CREATE TABLE "document_chunks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "search_text" TEXT NOT NULL,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "member_id" UUID,
    "question" VARCHAR(1000) NOT NULL,
    "answer" TEXT NOT NULL,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "answered" BOOLEAN NOT NULL DEFAULT true,
    "helpful" BOOLEAN,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_document_chunks_company" ON "document_chunks"("company_id");

-- CreateIndex
CREATE INDEX "idx_assistant_questions_company" ON "assistant_questions"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_assistant_questions_member" ON "assistant_questions"("member_id", "created_at");

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "company_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_questions" ADD CONSTRAINT "assistant_questions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

