-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "help_token" VARCHAR(64);

-- CreateTable
CREATE TABLE "knowledge_articles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "body" TEXT NOT NULL,
    "category" VARCHAR(60),
    "audience" VARCHAR(10) NOT NULL DEFAULT 'team',
    "status" VARCHAR(10) NOT NULL DEFAULT 'draft',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "search_text" TEXT NOT NULL DEFAULT '',
    "author_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_votes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "article_id" UUID NOT NULL,
    "member_id" UUID,
    "helpful" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_knowledge_company_status" ON "knowledge_articles"("company_id", "status");

-- CreateIndex
CREATE INDEX "idx_knowledge_votes_article" ON "knowledge_votes"("article_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_votes_article_id_member_id_key" ON "knowledge_votes"("article_id", "member_id");

-- CreateIndex
CREATE UNIQUE INDEX "companies_help_token_key" ON "companies"("help_token");

-- AddForeignKey
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_votes" ADD CONSTRAINT "knowledge_votes_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "knowledge_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_votes" ADD CONSTRAINT "knowledge_votes_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "company_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

