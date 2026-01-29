/*
  Warnings:

  - You are about to alter the column `uid` on the `CustomVocab` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - The primary key for the `HiddenVocab` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `uid` on the `HiddenVocab` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `uid` on the `VocabList` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - A unique constraint covering the columns `[userId,list_name]` on the table `VocabList` will be added. If there are existing duplicate values, this will fail.
  - Made the column `userId` on table `CustomVocab` required. This step will fail if there are existing NULL values in that column.
  - Made the column `userId` on table `HiddenVocab` required. This step will fail if there are existing NULL values in that column.
  - Made the column `userId` on table `VocabList` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "CustomVocab" DROP CONSTRAINT "CustomVocab_uid_fkey";

-- DropForeignKey
ALTER TABLE "HiddenVocab" DROP CONSTRAINT "HiddenVocab_uid_fkey";

-- DropForeignKey
ALTER TABLE "VocabList" DROP CONSTRAINT "VocabList_uid_fkey";

-- DropIndex
DROP INDEX "VocabList_uid_list_name_key";

-- AlterTable
ALTER TABLE "CustomVocab" ALTER COLUMN "uid" DROP NOT NULL,
ALTER COLUMN "uid" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "HiddenVocab" DROP CONSTRAINT "HiddenVocab_pkey",
ALTER COLUMN "uid" DROP NOT NULL,
ALTER COLUMN "uid" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "userId" SET NOT NULL,
ADD CONSTRAINT "HiddenVocab_pkey" PRIMARY KEY ("userId", "vocab_id");

-- AlterTable
ALTER TABLE "VocabList" ALTER COLUMN "uid" DROP NOT NULL,
ALTER COLUMN "uid" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "userId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "CustomVocab_userId_idx" ON "CustomVocab"("userId");

-- CreateIndex
CREATE INDEX "HiddenVocab_uid_idx" ON "HiddenVocab"("uid");

-- CreateIndex
CREATE INDEX "VocabList_userId_idx" ON "VocabList"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VocabList_userId_list_name_key" ON "VocabList"("userId", "list_name");

-- AddForeignKey
ALTER TABLE "CustomVocab" ADD CONSTRAINT "CustomVocab_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiddenVocab" ADD CONSTRAINT "HiddenVocab_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabList" ADD CONSTRAINT "VocabList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
