-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "kind" VARCHAR(20) NOT NULL DEFAULT 'news',
    "title" VARCHAR(150) NOT NULL,
    "body" VARCHAR(10000) NOT NULL,
    "event_at" TIMESTAMPTZ(6),
    "event_place" VARCHAR(150),
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "author_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_reads" (
    "announcement_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_reads_pkey" PRIMARY KEY ("announcement_id","member_id")
);

-- CreateIndex
CREATE INDEX "idx_announcements_company" ON "announcements"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_announcement_reads_member" ON "announcement_reads"("member_id");

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "company_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
