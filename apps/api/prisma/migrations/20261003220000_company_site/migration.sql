-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "site_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "companies_site_id_key" ON "companies"("site_id");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

