/*
  Warnings:

  - The primary key for the `A1SectionListeningAnswer` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `A1SectionSpeakingAnswer` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `A2SectionListeningAnswer` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `A2SectionSpeakingAnswer` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `B1SectionListeningAnswer` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `B1SectionSpeakingAnswer` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "A1SectionListeningAnswer" DROP CONSTRAINT "A1SectionListeningAnswer_mock_exam_id_fkey";

-- DropForeignKey
ALTER TABLE "A1SectionSpeakingAnswer" DROP CONSTRAINT "A1SectionSpeakingAnswer_mock_exam_id_fkey";

-- DropForeignKey
ALTER TABLE "A2SectionListeningAnswer" DROP CONSTRAINT "A2SectionListeningAnswer_mock_exam_id_fkey";

-- DropForeignKey
ALTER TABLE "A2SectionSpeakingAnswer" DROP CONSTRAINT "A2SectionSpeakingAnswer_mock_exam_id_fkey";

-- DropForeignKey
ALTER TABLE "B1SectionListeningAnswer" DROP CONSTRAINT "B1SectionListeningAnswer_mock_exam_id_fkey";

-- DropForeignKey
ALTER TABLE "B1SectionSpeakingAnswer" DROP CONSTRAINT "B1SectionSpeakingAnswer_mock_exam_id_fkey";

-- AlterTable
ALTER TABLE "A1SectionListeningAnswer" DROP CONSTRAINT "A1SectionListeningAnswer_pkey",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "mock_attempt" INTEGER,
ALTER COLUMN "mock_exam_id" DROP NOT NULL,
ALTER COLUMN "mock_exam_id" DROP DEFAULT,
ADD CONSTRAINT "A1SectionListeningAnswer_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "A1SectionSpeakingAnswer" DROP CONSTRAINT "A1SectionSpeakingAnswer_pkey",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "mock_attempt" INTEGER,
ALTER COLUMN "mock_exam_id" DROP NOT NULL,
ALTER COLUMN "mock_exam_id" DROP DEFAULT,
ADD CONSTRAINT "A1SectionSpeakingAnswer_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "A2SectionListeningAnswer" DROP CONSTRAINT "A2SectionListeningAnswer_pkey",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "mock_attempt" INTEGER,
ALTER COLUMN "mock_exam_id" DROP NOT NULL,
ALTER COLUMN "mock_exam_id" DROP DEFAULT,
ADD CONSTRAINT "A2SectionListeningAnswer_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "A2SectionSpeakingAnswer" DROP CONSTRAINT "A2SectionSpeakingAnswer_pkey",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "mock_attempt" INTEGER,
ALTER COLUMN "mock_exam_id" DROP NOT NULL,
ALTER COLUMN "mock_exam_id" DROP DEFAULT,
ADD CONSTRAINT "A2SectionSpeakingAnswer_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "B1SectionListeningAnswer" DROP CONSTRAINT "B1SectionListeningAnswer_pkey",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "mock_attempt" INTEGER,
ALTER COLUMN "mock_exam_id" DROP NOT NULL,
ALTER COLUMN "mock_exam_id" DROP DEFAULT,
ADD CONSTRAINT "B1SectionListeningAnswer_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "B1SectionSpeakingAnswer" DROP CONSTRAINT "B1SectionSpeakingAnswer_pkey",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "mock_attempt" INTEGER,
ALTER COLUMN "mock_exam_id" DROP NOT NULL,
ALTER COLUMN "mock_exam_id" DROP DEFAULT,
ADD CONSTRAINT "B1SectionSpeakingAnswer_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "MockExam" ADD COLUMN     "attempt" INTEGER NOT NULL DEFAULT 1;

-- AddForeignKey
ALTER TABLE "A1SectionSpeakingAnswer" ADD CONSTRAINT "A1SectionSpeakingAnswer_mock_exam_id_fkey" FOREIGN KEY ("mock_exam_id") REFERENCES "MockExam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "A1SectionListeningAnswer" ADD CONSTRAINT "A1SectionListeningAnswer_mock_exam_id_fkey" FOREIGN KEY ("mock_exam_id") REFERENCES "MockExam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "A2SectionSpeakingAnswer" ADD CONSTRAINT "A2SectionSpeakingAnswer_mock_exam_id_fkey" FOREIGN KEY ("mock_exam_id") REFERENCES "MockExam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "A2SectionListeningAnswer" ADD CONSTRAINT "A2SectionListeningAnswer_mock_exam_id_fkey" FOREIGN KEY ("mock_exam_id") REFERENCES "MockExam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "B1SectionSpeakingAnswer" ADD CONSTRAINT "B1SectionSpeakingAnswer_mock_exam_id_fkey" FOREIGN KEY ("mock_exam_id") REFERENCES "MockExam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "B1SectionListeningAnswer" ADD CONSTRAINT "B1SectionListeningAnswer_mock_exam_id_fkey" FOREIGN KEY ("mock_exam_id") REFERENCES "MockExam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
