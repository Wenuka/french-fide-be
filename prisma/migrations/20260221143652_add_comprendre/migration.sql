/*
  Warnings:

  - The primary key for the `MockExam` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `scenario_a1_id` on the `MockExam` table. All the data in the column will be lost.
  - You are about to drop the column `scenario_a2_id` on the `MockExam` table. All the data in the column will be lost.
  - You are about to drop the column `scenario_b1_id` on the `MockExam` table. All the data in the column will be lost.
  - You are about to drop the column `scenario_b1_option1_id` on the `MockExam` table. All the data in the column will be lost.
  - You are about to drop the column `scenario_b1_option2_id` on the `MockExam` table. All the data in the column will be lost.
  - The `id` column on the `MockExam` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `MockExamAnswerA1` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MockExamAnswerA2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MockExamAnswerB1` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ScenarioA1` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ScenarioA2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ScenarioB1` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "MockExam" DROP CONSTRAINT "MockExam_scenario_a1_id_fkey";

-- DropForeignKey
ALTER TABLE "MockExam" DROP CONSTRAINT "MockExam_scenario_a2_id_fkey";

-- DropForeignKey
ALTER TABLE "MockExam" DROP CONSTRAINT "MockExam_scenario_b1_id_fkey";

-- DropForeignKey
ALTER TABLE "MockExam" DROP CONSTRAINT "MockExam_scenario_b1_option1_id_fkey";

-- DropForeignKey
ALTER TABLE "MockExam" DROP CONSTRAINT "MockExam_scenario_b1_option2_id_fkey";

-- DropForeignKey
ALTER TABLE "MockExamAnswerA1" DROP CONSTRAINT "MockExamAnswerA1_mock_exam_id_fkey";

-- DropForeignKey
ALTER TABLE "MockExamAnswerA2" DROP CONSTRAINT "MockExamAnswerA2_mock_exam_id_fkey";

-- DropForeignKey
ALTER TABLE "MockExamAnswerB1" DROP CONSTRAINT "MockExamAnswerB1_mock_exam_id_fkey";

-- AlterTable
ALTER TABLE "MockExam" DROP CONSTRAINT "MockExam_pkey",
DROP COLUMN "scenario_a1_id",
DROP COLUMN "scenario_a2_id",
DROP COLUMN "scenario_b1_id",
DROP COLUMN "scenario_b1_option1_id",
DROP COLUMN "scenario_b1_option2_id",
ADD COLUMN     "listening_a1_id" INTEGER,
ADD COLUMN     "listening_a2_id" INTEGER,
ADD COLUMN     "listening_b1_id" INTEGER,
ADD COLUMN     "speaking_a1_id" INTEGER,
ADD COLUMN     "speaking_a2_id" INTEGER,
ADD COLUMN     "speaking_b1_id" INTEGER,
ADD COLUMN     "speaking_b1_option1_id" INTEGER,
ADD COLUMN     "speaking_b1_option2_id" INTEGER,
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "MockExam_pkey" PRIMARY KEY ("id");

-- DropTable
DROP TABLE "MockExamAnswerA1";

-- DropTable
DROP TABLE "MockExamAnswerA2";

-- DropTable
DROP TABLE "MockExamAnswerB1";

-- DropTable
DROP TABLE "ScenarioA1";

-- DropTable
DROP TABLE "ScenarioA2";

-- DropTable
DROP TABLE "ScenarioB1";

-- CreateTable
CREATE TABLE "A1SectionSpeaking" (
    "id" SERIAL NOT NULL,
    "json_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" "Language" NOT NULL DEFAULT 'FR',

    CONSTRAINT "A1SectionSpeaking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "A1SectionListening" (
    "id" SERIAL NOT NULL,
    "json_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" "Language" NOT NULL DEFAULT 'FR',

    CONSTRAINT "A1SectionListening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "A2SectionSpeaking" (
    "id" SERIAL NOT NULL,
    "json_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" "Language" NOT NULL DEFAULT 'FR',

    CONSTRAINT "A2SectionSpeaking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "A2SectionListening" (
    "id" SERIAL NOT NULL,
    "json_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" "Language" NOT NULL DEFAULT 'FR',

    CONSTRAINT "A2SectionListening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "B1SectionSpeaking" (
    "id" SERIAL NOT NULL,
    "json_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" "Language" NOT NULL DEFAULT 'FR',

    CONSTRAINT "B1SectionSpeaking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "B1SectionListening" (
    "id" SERIAL NOT NULL,
    "json_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" "Language" NOT NULL DEFAULT 'FR',

    CONSTRAINT "B1SectionListening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "A1SectionSpeakingAnswer" (
    "user_id" INTEGER NOT NULL,
    "mock_exam_id" INTEGER NOT NULL DEFAULT -1,
    "section_id" INTEGER NOT NULL,
    "question_id" TEXT NOT NULL,
    "answer_text" TEXT,
    "audio_url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "A1SectionSpeakingAnswer_pkey" PRIMARY KEY ("user_id","mock_exam_id","section_id","question_id")
);

-- CreateTable
CREATE TABLE "A1SectionListeningAnswer" (
    "user_id" INTEGER NOT NULL,
    "mock_exam_id" INTEGER NOT NULL DEFAULT -1,
    "section_id" INTEGER NOT NULL,
    "question_id" TEXT NOT NULL,
    "answer_text" TEXT,
    "audio_url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "A1SectionListeningAnswer_pkey" PRIMARY KEY ("user_id","mock_exam_id","section_id","question_id")
);

-- CreateTable
CREATE TABLE "A2SectionSpeakingAnswer" (
    "user_id" INTEGER NOT NULL,
    "mock_exam_id" INTEGER NOT NULL DEFAULT -1,
    "section_id" INTEGER NOT NULL,
    "question_id" TEXT NOT NULL,
    "answer_text" TEXT,
    "audio_url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "A2SectionSpeakingAnswer_pkey" PRIMARY KEY ("user_id","mock_exam_id","section_id","question_id")
);

-- CreateTable
CREATE TABLE "A2SectionListeningAnswer" (
    "user_id" INTEGER NOT NULL,
    "mock_exam_id" INTEGER NOT NULL DEFAULT -1,
    "section_id" INTEGER NOT NULL,
    "question_id" TEXT NOT NULL,
    "answer_text" TEXT,
    "audio_url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "A2SectionListeningAnswer_pkey" PRIMARY KEY ("user_id","mock_exam_id","section_id","question_id")
);

-- CreateTable
CREATE TABLE "B1SectionSpeakingAnswer" (
    "user_id" INTEGER NOT NULL,
    "mock_exam_id" INTEGER NOT NULL DEFAULT -1,
    "section_id" INTEGER NOT NULL,
    "question_id" TEXT NOT NULL,
    "answer_text" TEXT,
    "audio_url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "B1SectionSpeakingAnswer_pkey" PRIMARY KEY ("user_id","mock_exam_id","section_id","question_id")
);

-- CreateTable
CREATE TABLE "B1SectionListeningAnswer" (
    "user_id" INTEGER NOT NULL,
    "mock_exam_id" INTEGER NOT NULL DEFAULT -1,
    "section_id" INTEGER NOT NULL,
    "question_id" TEXT NOT NULL,
    "answer_text" TEXT,
    "audio_url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "B1SectionListeningAnswer_pkey" PRIMARY KEY ("user_id","mock_exam_id","section_id","question_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "A1SectionSpeaking_json_id_key" ON "A1SectionSpeaking"("json_id");

-- CreateIndex
CREATE UNIQUE INDEX "A1SectionListening_json_id_key" ON "A1SectionListening"("json_id");

-- CreateIndex
CREATE UNIQUE INDEX "A2SectionSpeaking_json_id_key" ON "A2SectionSpeaking"("json_id");

-- CreateIndex
CREATE UNIQUE INDEX "A2SectionListening_json_id_key" ON "A2SectionListening"("json_id");

-- CreateIndex
CREATE UNIQUE INDEX "B1SectionSpeaking_json_id_key" ON "B1SectionSpeaking"("json_id");

-- CreateIndex
CREATE UNIQUE INDEX "B1SectionListening_json_id_key" ON "B1SectionListening"("json_id");

-- AddForeignKey
ALTER TABLE "MockExam" ADD CONSTRAINT "MockExam_speaking_a2_id_fkey" FOREIGN KEY ("speaking_a2_id") REFERENCES "A2SectionSpeaking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExam" ADD CONSTRAINT "MockExam_speaking_a1_id_fkey" FOREIGN KEY ("speaking_a1_id") REFERENCES "A1SectionSpeaking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExam" ADD CONSTRAINT "MockExam_speaking_b1_option1_id_fkey" FOREIGN KEY ("speaking_b1_option1_id") REFERENCES "B1SectionSpeaking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExam" ADD CONSTRAINT "MockExam_speaking_b1_option2_id_fkey" FOREIGN KEY ("speaking_b1_option2_id") REFERENCES "B1SectionSpeaking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExam" ADD CONSTRAINT "MockExam_speaking_b1_id_fkey" FOREIGN KEY ("speaking_b1_id") REFERENCES "B1SectionSpeaking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExam" ADD CONSTRAINT "MockExam_listening_a2_id_fkey" FOREIGN KEY ("listening_a2_id") REFERENCES "A2SectionListening"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExam" ADD CONSTRAINT "MockExam_listening_a1_id_fkey" FOREIGN KEY ("listening_a1_id") REFERENCES "A1SectionListening"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExam" ADD CONSTRAINT "MockExam_listening_b1_id_fkey" FOREIGN KEY ("listening_b1_id") REFERENCES "B1SectionListening"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "A1SectionSpeakingAnswer" ADD CONSTRAINT "A1SectionSpeakingAnswer_mock_exam_id_fkey" FOREIGN KEY ("mock_exam_id") REFERENCES "MockExam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "A1SectionSpeakingAnswer" ADD CONSTRAINT "A1SectionSpeakingAnswer_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "A1SectionSpeaking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "A1SectionListeningAnswer" ADD CONSTRAINT "A1SectionListeningAnswer_mock_exam_id_fkey" FOREIGN KEY ("mock_exam_id") REFERENCES "MockExam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "A1SectionListeningAnswer" ADD CONSTRAINT "A1SectionListeningAnswer_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "A1SectionListening"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "A2SectionSpeakingAnswer" ADD CONSTRAINT "A2SectionSpeakingAnswer_mock_exam_id_fkey" FOREIGN KEY ("mock_exam_id") REFERENCES "MockExam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "A2SectionSpeakingAnswer" ADD CONSTRAINT "A2SectionSpeakingAnswer_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "A2SectionSpeaking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "A2SectionListeningAnswer" ADD CONSTRAINT "A2SectionListeningAnswer_mock_exam_id_fkey" FOREIGN KEY ("mock_exam_id") REFERENCES "MockExam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "A2SectionListeningAnswer" ADD CONSTRAINT "A2SectionListeningAnswer_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "A2SectionListening"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "B1SectionSpeakingAnswer" ADD CONSTRAINT "B1SectionSpeakingAnswer_mock_exam_id_fkey" FOREIGN KEY ("mock_exam_id") REFERENCES "MockExam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "B1SectionSpeakingAnswer" ADD CONSTRAINT "B1SectionSpeakingAnswer_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "B1SectionSpeaking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "B1SectionListeningAnswer" ADD CONSTRAINT "B1SectionListeningAnswer_mock_exam_id_fkey" FOREIGN KEY ("mock_exam_id") REFERENCES "MockExam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "B1SectionListeningAnswer" ADD CONSTRAINT "B1SectionListeningAnswer_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "B1SectionListening"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
