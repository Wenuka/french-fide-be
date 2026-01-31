/*
  Warnings:

  - You are about to drop the column `uid` on the `CustomVocab` table. All the data in the column will be lost.
  - You are about to drop the column `uid` on the `HiddenVocab` table. All the data in the column will be lost.
  - You are about to drop the column `uid` on the `VocabList` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "CustomVocab_uid_idx";

-- DropIndex
DROP INDEX "HiddenVocab_uid_idx";

-- DropIndex
DROP INDEX "VocabList_uid_idx";

-- AlterTable
ALTER TABLE "CustomVocab" DROP COLUMN "uid";

-- AlterTable
ALTER TABLE "HiddenVocab" DROP COLUMN "uid";

-- AlterTable
ALTER TABLE "VocabList" DROP COLUMN "uid";
