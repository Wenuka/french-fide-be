/*
  Warnings:

  - You are about to drop the column `section_a1_id` on the `MockExam` table. All the data in the column will be lost.
  - You are about to drop the column `section_a2_id` on the `MockExam` table. All the data in the column will be lost.
  - You are about to drop the column `section_b1_id` on the `MockExam` table. All the data in the column will be lost.
  - You are about to drop the column `section_b1_option1_id` on the `MockExam` table. All the data in the column will be lost.
  - You are about to drop the column `section_b1_option2_id` on the `MockExam` table. All the data in the column will be lost.
  - You are about to drop the `MockExamSectionA1` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MockExamSectionA2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MockExamSectionB1` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `scenario_a2_id` to the `MockExam` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "MockExam" DROP CONSTRAINT "MockExam_section_a1_id_fkey";

-- DropForeignKey
ALTER TABLE "MockExam" DROP CONSTRAINT "MockExam_section_a2_id_fkey";

-- DropForeignKey
ALTER TABLE "MockExam" DROP CONSTRAINT "MockExam_section_b1_id_fkey";

-- DropForeignKey
ALTER TABLE "MockExam" DROP CONSTRAINT "MockExam_section_b1_option1_id_fkey";

-- DropForeignKey
ALTER TABLE "MockExam" DROP CONSTRAINT "MockExam_section_b1_option2_id_fkey";

-- DropForeignKey
ALTER TABLE "MockExamSectionA1" DROP CONSTRAINT "MockExamSectionA1_scenarioId_fkey";

-- DropForeignKey
ALTER TABLE "MockExamSectionA2" DROP CONSTRAINT "MockExamSectionA2_scenarioId_fkey";

-- DropForeignKey
ALTER TABLE "MockExamSectionB1" DROP CONSTRAINT "MockExamSectionB1_scenarioId_fkey";

-- DropIndex
DROP INDEX "MockExam_section_a1_id_key";

-- DropIndex
DROP INDEX "MockExam_section_a2_id_key";

-- DropIndex
DROP INDEX "MockExam_section_b1_id_key";

-- DropIndex
DROP INDEX "MockExam_section_b1_option1_id_key";

-- DropIndex
DROP INDEX "MockExam_section_b1_option2_id_key";

-- AlterTable
ALTER TABLE "MockExam" DROP COLUMN "section_a1_id",
DROP COLUMN "section_a2_id",
DROP COLUMN "section_b1_id",
DROP COLUMN "section_b1_option1_id",
DROP COLUMN "section_b1_option2_id",
ADD COLUMN     "scenario_a1_id" TEXT,
ADD COLUMN     "scenario_a2_id" TEXT NOT NULL,
ADD COLUMN     "scenario_b1_id" TEXT,
ADD COLUMN     "scenario_b1_option1_id" TEXT,
ADD COLUMN     "scenario_b1_option2_id" TEXT;

-- DropTable
DROP TABLE "MockExamSectionA1";

-- DropTable
DROP TABLE "MockExamSectionA2";

-- DropTable
DROP TABLE "MockExamSectionB1";

-- AddForeignKey
ALTER TABLE "MockExam" ADD CONSTRAINT "MockExam_scenario_a2_id_fkey" FOREIGN KEY ("scenario_a2_id") REFERENCES "ScenarioA2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExam" ADD CONSTRAINT "MockExam_scenario_a1_id_fkey" FOREIGN KEY ("scenario_a1_id") REFERENCES "ScenarioA1"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExam" ADD CONSTRAINT "MockExam_scenario_b1_option1_id_fkey" FOREIGN KEY ("scenario_b1_option1_id") REFERENCES "ScenarioB1"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExam" ADD CONSTRAINT "MockExam_scenario_b1_option2_id_fkey" FOREIGN KEY ("scenario_b1_option2_id") REFERENCES "ScenarioB1"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExam" ADD CONSTRAINT "MockExam_scenario_b1_id_fkey" FOREIGN KEY ("scenario_b1_id") REFERENCES "ScenarioB1"("id") ON DELETE SET NULL ON UPDATE CASCADE;
