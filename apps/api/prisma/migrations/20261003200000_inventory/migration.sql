-- CreateTable
CREATE TABLE "inventory_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "sku" VARCHAR(60),
    "category" VARCHAR(60),
    "unit" VARCHAR(20) NOT NULL DEFAULT 'unidad',
    "stock" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "min_stock" DECIMAL(14,3),
    "cost_cents" BIGINT,
    "location" VARCHAR(100),
    "notes" VARCHAR(2000),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "item_id" UUID NOT NULL,
    "type" VARCHAR(10) NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "stock_after" DECIMAL(14,3) NOT NULL,
    "note" VARCHAR(300),
    "user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(60),
    "category" VARCHAR(60),
    "serial" VARCHAR(100),
    "status" VARCHAR(12) NOT NULL DEFAULT 'available',
    "assigned_member_id" UUID,
    "assigned_at" TIMESTAMPTZ(6),
    "value_cents" BIGINT,
    "purchased_at" DATE,
    "notes" VARCHAR(2000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_asset_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asset_id" UUID NOT NULL,
    "kind" VARCHAR(12) NOT NULL,
    "member_id" UUID,
    "person" VARCHAR(150),
    "note" VARCHAR(300),
    "user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_asset_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_inventory_items_company" ON "inventory_items"("company_id", "active");

-- CreateIndex
CREATE INDEX "idx_inventory_movements_item" ON "inventory_movements"("item_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_company_assets_status" ON "company_assets"("company_id", "status");

-- CreateIndex
CREATE INDEX "idx_company_assets_member" ON "company_assets"("assigned_member_id");

-- CreateIndex
CREATE INDEX "idx_company_asset_events" ON "company_asset_events"("asset_id", "created_at");

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_assets" ADD CONSTRAINT "company_assets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_assets" ADD CONSTRAINT "company_assets_assigned_member_id_fkey" FOREIGN KEY ("assigned_member_id") REFERENCES "company_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_asset_events" ADD CONSTRAINT "company_asset_events_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "company_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

