-- CreateEnum
CREATE TYPE "SectionType" AS ENUM ('A1', 'A2', 'B1');

-- CreateTable
CREATE TABLE "ScenarioA1" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,

    CONSTRAINT "ScenarioA1_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioA2" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,

    CONSTRAINT "ScenarioA2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioB1" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,

    CONSTRAINT "ScenarioB1_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockExamSectionA1" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,

    CONSTRAINT "MockExamSectionA1_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockExamSectionA2" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,

    CONSTRAINT "MockExamSectionA2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockExamSectionB1" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,

    CONSTRAINT "MockExamSectionB1_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockExam" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "section_a2_id" TEXT,
    "section_a1_id" TEXT,
    "section_b1_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',

    CONSTRAINT "MockExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockExamAnswer" (
    "id" TEXT NOT NULL,
    "mock_exam_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "section_type" "SectionType" NOT NULL,
    "question_id" TEXT NOT NULL,
    "answer_text" TEXT,
    "audio_url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockExamAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MockExam_section_a2_id_key" ON "MockExam"("section_a2_id");

-- CreateIndex
CREATE UNIQUE INDEX "MockExam_section_a1_id_key" ON "MockExam"("section_a1_id");

-- CreateIndex
CREATE UNIQUE INDEX "MockExam_section_b1_id_key" ON "MockExam"("section_b1_id");

-- AddForeignKey
ALTER TABLE "MockExamSectionA1" ADD CONSTRAINT "MockExamSectionA1_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "ScenarioA1"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExamSectionA2" ADD CONSTRAINT "MockExamSectionA2_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "ScenarioA2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExamSectionB1" ADD CONSTRAINT "MockExamSectionB1_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "ScenarioB1"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExam" ADD CONSTRAINT "MockExam_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExam" ADD CONSTRAINT "MockExam_section_a2_id_fkey" FOREIGN KEY ("section_a2_id") REFERENCES "MockExamSectionA2"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExam" ADD CONSTRAINT "MockExam_section_a1_id_fkey" FOREIGN KEY ("section_a1_id") REFERENCES "MockExamSectionA1"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExam" ADD CONSTRAINT "MockExam_section_b1_id_fkey" FOREIGN KEY ("section_b1_id") REFERENCES "MockExamSectionB1"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExamAnswer" ADD CONSTRAINT "MockExamAnswer_mock_exam_id_fkey" FOREIGN KEY ("mock_exam_id") REFERENCES "MockExam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
