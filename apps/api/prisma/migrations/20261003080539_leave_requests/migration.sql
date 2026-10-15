-- CreateTable
CREATE TABLE "leave_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "days" INTEGER NOT NULL DEFAULT 0,
    "reason" VARCHAR(2000) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "supervisor_by_id" UUID,
    "supervisor_at" TIMESTAMPTZ(6),
    "supervisor_note" VARCHAR(1000),
    "hr_by_id" UUID,
    "hr_at" TIMESTAMPTZ(6),
    "hr_note" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_leave_requests_company_status" ON "leave_requests"("company_id", "status");

-- CreateIndex
CREATE INDEX "idx_leave_requests_member" ON "leave_requests"("member_id");

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "company_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
