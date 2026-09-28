-- Control de asistencia con QR: negocios, empleados (PIN y turno) y jornadas.
-- CreateTable
CREATE TABLE "attendance_businesses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "kiosk_secret" VARCHAR(64) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_employees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "pin_hash" VARCHAR(64) NOT NULL,
    "shift_start" VARCHAR(5),
    "shift_end" VARCHAR(5),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "clock_in" TIMESTAMPTZ(6) NOT NULL,
    "clock_out" TIMESTAMPTZ(6),
    "edited_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_businesses_slug_key" ON "attendance_businesses"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_employees_business_id_pin_hash_key" ON "attendance_employees"("business_id", "pin_hash");

-- CreateIndex
CREATE INDEX "attendance_records_business_id_clock_in_idx" ON "attendance_records"("business_id", "clock_in");

-- CreateIndex
CREATE INDEX "attendance_records_employee_id_clock_in_idx" ON "attendance_records"("employee_id", "clock_in");

-- AddForeignKey
ALTER TABLE "attendance_employees" ADD CONSTRAINT "attendance_employees_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "attendance_businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "attendance_businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "attendance_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

