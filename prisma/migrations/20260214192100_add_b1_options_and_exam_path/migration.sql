/*
  Warnings:

  - You are about to drop the `MockExamAnswer` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[section_b1_option1_id]` on the table `MockExam` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[section_b1_option2_id]` on the table `MockExam` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ExamPath" AS ENUM ('A1', 'B1');

-- DropForeignKey
ALTER TABLE "MockExamAnswer" DROP CONSTRAINT "MockExamAnswer_mock_exam_id_fkey";

-- AlterTable
ALTER TABLE "MockExam" ADD COLUMN     "section_b1_option1_id" TEXT,
ADD COLUMN     "section_b1_option2_id" TEXT,
ADD COLUMN     "selected_path" "ExamPath";

-- DropTable
DROP TABLE "MockExamAnswer";

-- CreateTable
CREATE TABLE "MockExamAnswerA1" (
    "id" TEXT NOT NULL,
    "mock_exam_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "question_id" TEXT NOT NULL,
    "answer_text" TEXT,
    "audio_url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockExamAnswerA1_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockExamAnswerA2" (
    "id" TEXT NOT NULL,
    "mock_exam_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "question_id" TEXT NOT NULL,
    "answer_text" TEXT,
    "audio_url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockExamAnswerA2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockExamAnswerB1" (
    "id" TEXT NOT NULL,
    "mock_exam_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "question_id" TEXT NOT NULL,
    "answer_text" TEXT,
    "audio_url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockExamAnswerB1_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MockExamAnswerA1_user_id_mock_exam_id_question_id_key" ON "MockExamAnswerA1"("user_id", "mock_exam_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "MockExamAnswerA2_user_id_mock_exam_id_question_id_key" ON "MockExamAnswerA2"("user_id", "mock_exam_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "MockExamAnswerB1_user_id_mock_exam_id_question_id_key" ON "MockExamAnswerB1"("user_id", "mock_exam_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "MockExam_section_b1_option1_id_key" ON "MockExam"("section_b1_option1_id");

-- CreateIndex
CREATE UNIQUE INDEX "MockExam_section_b1_option2_id_key" ON "MockExam"("section_b1_option2_id");

-- AddForeignKey
ALTER TABLE "MockExam" ADD CONSTRAINT "MockExam_section_b1_option1_id_fkey" FOREIGN KEY ("section_b1_option1_id") REFERENCES "MockExamSectionB1"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExam" ADD CONSTRAINT "MockExam_section_b1_option2_id_fkey" FOREIGN KEY ("section_b1_option2_id") REFERENCES "MockExamSectionB1"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExamAnswerA1" ADD CONSTRAINT "MockExamAnswerA1_mock_exam_id_fkey" FOREIGN KEY ("mock_exam_id") REFERENCES "MockExam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExamAnswerA2" ADD CONSTRAINT "MockExamAnswerA2_mock_exam_id_fkey" FOREIGN KEY ("mock_exam_id") REFERENCES "MockExam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExamAnswerB1" ADD CONSTRAINT "MockExamAnswerB1_mock_exam_id_fkey" FOREIGN KEY ("mock_exam_id") REFERENCES "MockExam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
