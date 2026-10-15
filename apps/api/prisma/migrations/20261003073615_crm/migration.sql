-- CreateTable
CREATE TABLE "crm_contacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "organization" VARCHAR(150),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "stage" VARCHAR(20) NOT NULL DEFAULT 'lead',
    "value_cents" INTEGER,
    "source" VARCHAR(20) NOT NULL DEFAULT 'manual',
    "notes" VARCHAR(4000),
    "owner_member_id" UUID,
    "last_contact_at" TIMESTAMPTZ(6),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_activities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "user_id" UUID,
    "kind" VARCHAR(20) NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_crm_contacts_company_stage" ON "crm_contacts"("company_id", "stage");

-- CreateIndex
CREATE INDEX "idx_crm_activities_contact" ON "crm_activities"("contact_id", "created_at");

-- AddForeignKey
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
