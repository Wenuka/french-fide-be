-- CreateEnum
CREATE TYPE "TopicSection" AS ENUM ('DIALOGUE', 'DISCUSSION');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "has_generated_default_lists" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "topic_progress" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "section" "TopicSection" NOT NULL,
    "topic_id" INTEGER NOT NULL,

    CONSTRAINT "topic_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "topic_progress_user_id_idx" ON "topic_progress"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "topic_progress_user_id_section_topic_id_key" ON "topic_progress"("user_id", "section", "topic_id");

-- AddForeignKey
ALTER TABLE "topic_progress" ADD CONSTRAINT "topic_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
