-- Precios por módulo aprobados por Rigoberto (6 oct 2026), en pesos al mes.
-- Básico $15.000, intermedio $29.000, premium $49.000. No pisa un precio que ya se haya puesto a mano en /admin/modulos.
INSERT INTO "module_prices" ("key", "monthly_price") VALUES
  ('employees', 15000), ('requests', 15000), ('announcements', 15000), ('documents', 15000),
  ('calendar', 15000), ('surveys', 15000), ('knowledge', 15000), ('alerts', 15000),
  ('crm', 29000), ('tickets', 29000), ('quotes', 29000), ('inventory', 29000), ('doc_generator', 29000),
  ('training', 29000), ('store', 29000), ('analytics', 29000), ('seo', 29000), ('automations', 29000),
  ('web', 49000), ('marketing', 49000), ('whatsapp', 49000), ('ai_assistant', 49000), ('ai_content', 49000)
ON CONFLICT ("key") DO NOTHING;
