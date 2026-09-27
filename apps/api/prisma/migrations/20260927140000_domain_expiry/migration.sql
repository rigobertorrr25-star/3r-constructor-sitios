-- Vencimiento anual del dominio propio y aviso de renovación.
ALTER TABLE "domains" ADD COLUMN "expires_at" TIMESTAMPTZ(6);
ALTER TABLE "domains" ADD COLUMN "renewal_notice_sent_at" TIMESTAMPTZ(6);

-- Los dominios propios que ya existen: un año desde que se asignaron.
UPDATE "domains" SET "expires_at" = "created_at" + INTERVAL '1 year' WHERE "type" = 'custom';

CREATE INDEX "idx_domains_expires_at" ON "domains"("expires_at");
