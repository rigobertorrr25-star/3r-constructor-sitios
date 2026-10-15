-- CreateTable
CREATE TABLE "store_settings" (
    "company_id" UUID NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "tagline" VARCHAR(300),
    "whatsapp" VARCHAR(30),
    "open" BOOLEAN NOT NULL DEFAULT true,
    "pickup_enabled" BOOLEAN NOT NULL DEFAULT true,
    "pickup_note" VARCHAR(200),
    "delivery_enabled" BOOLEAN NOT NULL DEFAULT false,
    "delivery_fee_cents" BIGINT NOT NULL DEFAULT 0,
    "free_from_cents" BIGINT,
    "delivery_note" VARCHAR(200),
    "payment_note" VARCHAR(500),
    "order_seq" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_settings_pkey" PRIMARY KEY ("company_id")
);

-- CreateTable
CREATE TABLE "store_products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" VARCHAR(5000),
    "price_cents" BIGINT NOT NULL,
    "compare_at_cents" BIGINT,
    "image_url" VARCHAR(500),
    "category" VARCHAR(60),
    "track_stock" BOOLEAN NOT NULL DEFAULT false,
    "stock" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_variants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "price_cents" BIGINT,
    "stock" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "store_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_coupons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "percent" INTEGER,
    "amount_cents" BIGINT,
    "min_order_cents" BIGINT,
    "max_uses" INTEGER,
    "used" INTEGER NOT NULL DEFAULT 0,
    "expires_at" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "public_token" VARCHAR(40) NOT NULL,
    "customer_name" VARCHAR(150) NOT NULL,
    "customer_phone" VARCHAR(30) NOT NULL,
    "customer_email" VARCHAR(255),
    "delivery" VARCHAR(10) NOT NULL,
    "address" VARCHAR(300),
    "notes" VARCHAR(1000),
    "items" JSONB NOT NULL,
    "subtotal_cents" BIGINT NOT NULL,
    "discount_cents" BIGINT NOT NULL DEFAULT 0,
    "shipping_cents" BIGINT NOT NULL DEFAULT 0,
    "total_cents" BIGINT NOT NULL,
    "coupon_code" VARCHAR(30),
    "status" VARCHAR(12) NOT NULL DEFAULT 'new',
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "staff_note" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "store_settings_slug_key" ON "store_settings"("slug");

-- CreateIndex
CREATE INDEX "idx_store_products_company" ON "store_products"("company_id", "active");

-- CreateIndex
CREATE INDEX "idx_store_variants_product" ON "store_variants"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "store_coupons_company_id_code_key" ON "store_coupons"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "store_orders_public_token_key" ON "store_orders"("public_token");

-- CreateIndex
CREATE INDEX "idx_store_orders_company" ON "store_orders"("company_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "store_orders_company_id_number_key" ON "store_orders"("company_id", "number");

-- AddForeignKey
ALTER TABLE "store_settings" ADD CONSTRAINT "store_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_variants" ADD CONSTRAINT "store_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "store_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_coupons" ADD CONSTRAINT "store_coupons_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_orders" ADD CONSTRAINT "store_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

