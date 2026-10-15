-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" VARCHAR(2000),
    "status" VARCHAR(10) NOT NULL DEFAULT 'draft',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "due_at" DATE,
    "pass_score" INTEGER NOT NULL DEFAULT 70,
    "created_by_id" UUID,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_lessons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "course_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "body" TEXT NOT NULL,
    "video_url" VARCHAR(500),

    CONSTRAINT "course_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "course_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "text" VARCHAR(300) NOT NULL,
    "options" JSONB NOT NULL,
    "correct" INTEGER NOT NULL,

    CONSTRAINT "course_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_progress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "course_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "lessons_done" JSONB NOT NULL DEFAULT '[]',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER,
    "completed_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_courses_company_status" ON "courses"("company_id", "status");

-- CreateIndex
CREATE INDEX "idx_course_lessons_course" ON "course_lessons"("course_id");

-- CreateIndex
CREATE INDEX "idx_course_questions_course" ON "course_questions"("course_id");

-- CreateIndex
CREATE INDEX "idx_course_progress_member" ON "course_progress"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_progress_course_id_member_id_key" ON "course_progress"("course_id", "member_id");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_questions" ADD CONSTRAINT "course_questions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "company_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
