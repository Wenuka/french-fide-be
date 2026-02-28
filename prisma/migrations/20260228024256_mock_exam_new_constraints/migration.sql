/*
  Warnings:

  - A unique constraint covering the columns `[user_id,speaking_a2_id]` on the table `MockExam` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "A1SectionListeningAnswer_section_id_idx" ON "A1SectionListeningAnswer"("section_id");

-- CreateIndex
CREATE INDEX "A1SectionSpeakingAnswer_section_id_idx" ON "A1SectionSpeakingAnswer"("section_id");

-- CreateIndex
CREATE INDEX "A2SectionListeningAnswer_section_id_idx" ON "A2SectionListeningAnswer"("section_id");

-- CreateIndex
CREATE INDEX "A2SectionSpeakingAnswer_section_id_idx" ON "A2SectionSpeakingAnswer"("section_id");

-- CreateIndex
CREATE INDEX "B1SectionListeningAnswer_section_id_idx" ON "B1SectionListeningAnswer"("section_id");

-- CreateIndex
CREATE INDEX "B1SectionSpeakingAnswer_section_id_idx" ON "B1SectionSpeakingAnswer"("section_id");

-- CreateIndex
CREATE UNIQUE INDEX "MockExam_user_id_speaking_a2_id_key" ON "MockExam"("user_id", "speaking_a2_id");
