-- CreateTable
CREATE TABLE "surveys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" VARCHAR(2000),
    "audience" VARCHAR(10) NOT NULL,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(10) NOT NULL DEFAULT 'draft',
    "closes_at" TIMESTAMPTZ(6),
    "public_token" VARCHAR(64),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "survey_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" VARCHAR(10) NOT NULL,
    "text" VARCHAR(300) NOT NULL,
    "options" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "survey_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_responses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "survey_id" UUID NOT NULL,
    "member_id" UUID,
    "respondent_key" VARCHAR(64),
    "name" VARCHAR(150),
    "answers" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "surveys_public_token_key" ON "surveys"("public_token");

-- CreateIndex
CREATE INDEX "idx_surveys_company_status" ON "surveys"("company_id", "status");

-- CreateIndex
CREATE INDEX "idx_survey_questions_survey" ON "survey_questions"("survey_id");

-- CreateIndex
CREATE INDEX "idx_survey_responses_survey" ON "survey_responses"("survey_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "survey_responses_survey_id_respondent_key_key" ON "survey_responses"("survey_id", "respondent_key");

-- AddForeignKey
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_questions" ADD CONSTRAINT "survey_questions_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
