-- CreateTable
CREATE TABLE "portfolio_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(120) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "category" VARCHAR(80),
    "description" VARCHAR(300),
    "thumbnail_url" VARCHAR(500),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_items_pkey" PRIMARY KEY ("id")
);
