-- Precios nuevos de los paquetes de página, aprobados por Rigoberto (20 oct 2026), en centavos de peso.
-- Página Esencial $550.000, Sitio para tu Negocio $950.000, Presencia Completa $1.800.000.
-- Los pedidos ya hechos guardan su propio precio y no cambian.
UPDATE "packages" SET "price_cents" = 55000000 WHERE "slug" = 'esencial';
UPDATE "packages" SET "price_cents" = 95000000 WHERE "slug" = 'negocio';
UPDATE "packages" SET "price_cents" = 180000000 WHERE "slug" = 'completa';
