-- AlterTable
ALTER TABLE "crm_contacts" ALTER COLUMN "value_cents" SET DATA TYPE BIGINT;

-- CreateTable
CREATE TABLE "employee_profiles" (
    "member_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "document_type" VARCHAR(5),
    "document_number" VARCHAR(30),
    "phone" VARCHAR(50),
    "show_phone" BOOLEAN NOT NULL DEFAULT false,
    "birth_date" DATE,
    "address" VARCHAR(200),
    "city" VARCHAR(100),
    "emergency_name" VARCHAR(150),
    "emergency_phone" VARCHAR(50),
    "emergency_relation" VARCHAR(60),
    "eps" VARCHAR(100),
    "pension_fund" VARCHAR(100),
    "contract_type" VARCHAR(20),
    "contract_end" DATE,
    "salary" INTEGER,
    "schedule" VARCHAR(150),
    "hr_notes" VARCHAR(4000),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_profiles_pkey" PRIMARY KEY ("member_id")
);

-- CreateIndex
CREATE INDEX "idx_employee_profiles_company" ON "employee_profiles"("company_id");

-- AddForeignKey
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "company_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
