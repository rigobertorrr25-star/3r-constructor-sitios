-- CreateTable
CREATE TABLE "company_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "member_id" UUID,
    "category" VARCHAR(20) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "file_name" VARCHAR(200) NOT NULL,
    "content_type" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "storage_key" VARCHAR(120) NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'pending',
    "audience" VARCHAR(10) NOT NULL DEFAULT 'all',
    "expires_on" DATE,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_documents_storage_key_key" ON "company_documents"("storage_key");

-- CreateIndex
CREATE INDEX "idx_company_documents_company_member" ON "company_documents"("company_id", "member_id");

-- AddForeignKey
ALTER TABLE "company_documents" ADD CONSTRAINT "company_documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_documents" ADD CONSTRAINT "company_documents_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "company_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
