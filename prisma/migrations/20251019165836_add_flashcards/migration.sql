/*
  Warnings:

  - A unique constraint covering the columns `[favourite_list]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "Language" AS ENUM ('FR', 'EN', 'DE');

-- CreateEnum
CREATE TYPE "VocabStatus" AS ENUM ('unknown', 'green', 'red');

-- CreateEnum
CREATE TYPE "VocabReferenceKind" AS ENUM ('DEFAULT', 'CUSTOM');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "favourite_list" INTEGER,
ADD COLUMN     "source_lang" "Language" NOT NULL DEFAULT 'EN',
ADD COLUMN     "target_lang" "Language" NOT NULL DEFAULT 'FR';

-- CreateTable
CREATE TABLE "CustomVocab" (
    "custom_vocab_id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "target_lang" "Language" NOT NULL,
    "source_lang" "Language" NOT NULL,

    CONSTRAINT "CustomVocab_pkey" PRIMARY KEY ("custom_vocab_id")
);

-- CreateTable
CREATE TABLE "Vocab" (
    "vocab_id" SERIAL NOT NULL,
    "reference_id" INTEGER,
    "reference_kind" "VocabReferenceKind" NOT NULL,
    "custom_vocab_id" INTEGER,

    CONSTRAINT "Vocab_pkey" PRIMARY KEY ("vocab_id")
);

-- CreateTable
CREATE TABLE "HiddenVocab" (
    "uid" TEXT NOT NULL,
    "vocab_id" INTEGER NOT NULL,

    CONSTRAINT "HiddenVocab_pkey" PRIMARY KEY ("uid","vocab_id")
);

-- CreateTable
CREATE TABLE "VocabList" (
    "list_id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "list_name" TEXT NOT NULL,

    CONSTRAINT "VocabList_pkey" PRIMARY KEY ("list_id")
);

-- CreateTable
CREATE TABLE "VocabListItem" (
    "id" SERIAL NOT NULL,
    "list_id" INTEGER NOT NULL,
    "vocab_id" INTEGER NOT NULL,
    "list_name" TEXT,
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timesGreen" INTEGER NOT NULL DEFAULT 0,
    "timesRed" INTEGER NOT NULL DEFAULT 0,
    "vocab_status" "VocabStatus" NOT NULL DEFAULT 'unknown',

    CONSTRAINT "VocabListItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomVocab_uid_idx" ON "CustomVocab"("uid");

-- CreateIndex
CREATE INDEX "Vocab_reference_kind_reference_id_idx" ON "Vocab"("reference_kind", "reference_id");

-- CreateIndex
CREATE INDEX "Vocab_custom_vocab_id_idx" ON "Vocab"("custom_vocab_id");

-- CreateIndex
CREATE INDEX "VocabList_uid_idx" ON "VocabList"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "VocabList_uid_list_name_key" ON "VocabList"("uid", "list_name");

-- CreateIndex
CREATE INDEX "VocabListItem_vocab_id_idx" ON "VocabListItem"("vocab_id");

-- CreateIndex
CREATE UNIQUE INDEX "VocabListItem_list_id_vocab_id_key" ON "VocabListItem"("list_id", "vocab_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_favourite_list_key" ON "User"("favourite_list");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_favourite_list_fkey" FOREIGN KEY ("favourite_list") REFERENCES "VocabList"("list_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomVocab" ADD CONSTRAINT "CustomVocab_uid_fkey" FOREIGN KEY ("uid") REFERENCES "User"("uid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vocab" ADD CONSTRAINT "Vocab_custom_vocab_id_fkey" FOREIGN KEY ("custom_vocab_id") REFERENCES "CustomVocab"("custom_vocab_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiddenVocab" ADD CONSTRAINT "HiddenVocab_uid_fkey" FOREIGN KEY ("uid") REFERENCES "User"("uid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiddenVocab" ADD CONSTRAINT "HiddenVocab_vocab_id_fkey" FOREIGN KEY ("vocab_id") REFERENCES "Vocab"("vocab_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabList" ADD CONSTRAINT "VocabList_uid_fkey" FOREIGN KEY ("uid") REFERENCES "User"("uid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabListItem" ADD CONSTRAINT "VocabListItem_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "VocabList"("list_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabListItem" ADD CONSTRAINT "VocabListItem_vocab_id_fkey" FOREIGN KEY ("vocab_id") REFERENCES "Vocab"("vocab_id") ON DELETE RESTRICT ON UPDATE CASCADE;
