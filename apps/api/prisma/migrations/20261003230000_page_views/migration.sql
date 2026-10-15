-- CreateTable
CREATE TABLE "page_views" (
    "id" BIGSERIAL NOT NULL,
    "site_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "path" VARCHAR(200) NOT NULL,
    "source" VARCHAR(60) NOT NULL,
    "device" VARCHAR(10) NOT NULL,
    "visitor" VARCHAR(16) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_page_views_site_day" ON "page_views"("site_id", "day");

-- AddForeignKey
ALTER TABLE "page_views" ADD CONSTRAINT "page_views_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

