-- Asistente con IA que responde solo en el WhatsApp de la empresa.
ALTER TABLE "whatsapp_accounts" ADD COLUMN "bot_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "whatsapp_accounts" ADD COLUMN "bot_info" TEXT NOT NULL DEFAULT '';
ALTER TABLE "whatsapp_conversations" ADD COLUMN "bot_paused" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "whatsapp_messages" ADD COLUMN "bot" BOOLEAN NOT NULL DEFAULT false;
