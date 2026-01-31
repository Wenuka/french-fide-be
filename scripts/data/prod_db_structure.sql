-- CreateEnum
CREATE TYPE "Language" AS ENUM ('FR', 'EN', 'DE');

-- CreateEnum
CREATE TYPE "TopicSection" AS ENUM ('DIALOGUE', 'DISCUSSION');

-- CreateEnum
CREATE TYPE "VocabReferenceKind" AS ENUM ('DEFAULT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "VocabStatus" AS ENUM ('unknown', 'green', 'red');

-- CreateTable
CREATE TABLE "CustomVocab" (
    "custom_vocab_id" SERIAL NOT NULL,
    "uid" VARCHAR(255),
    "target_lang" "Language" NOT NULL,
    "source_lang" "Language" NOT NULL,
    "userId" INTEGER NOT NULL,
    "source_text" TEXT NOT NULL,
    "target_text" TEXT NOT NULL,

    CONSTRAINT "CustomVocab_pkey" PRIMARY KEY ("custom_vocab_id")
);

-- CreateTable
CREATE TABLE "HiddenVocab" (
    "uid" VARCHAR(255),
    "vocab_id" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "HiddenVocab_pkey" PRIMARY KEY ("userId","vocab_id")
);

-- CreateTable
CREATE TABLE "User" (
    "uid" TEXT NOT NULL,
    "email" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" SERIAL NOT NULL,
    "favourite_list" INTEGER,
    "source_lang" "Language" NOT NULL DEFAULT 'EN',
    "target_lang" "Language" NOT NULL DEFAULT 'FR',
    "has_generated_default_lists" BOOLEAN NOT NULL DEFAULT false,
    "communicate_important_updates" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "VocabList" (
    "list_id" SERIAL NOT NULL,
    "uid" VARCHAR(255),
    "list_name" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,

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

-- CreateTable
CREATE TABLE "topic_progress" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "section" "TopicSection" NOT NULL,
    "topic_id" INTEGER NOT NULL,

    CONSTRAINT "topic_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomVocab_uid_idx" ON "CustomVocab"("uid" ASC);

-- CreateIndex
CREATE INDEX "CustomVocab_userId_idx" ON "CustomVocab"("userId" ASC);

-- CreateIndex
CREATE INDEX "HiddenVocab_uid_idx" ON "HiddenVocab"("uid" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_favourite_list_key" ON "User"("favourite_list" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_uid_key" ON "User"("uid" ASC);

-- CreateIndex
CREATE INDEX "Vocab_custom_vocab_id_idx" ON "Vocab"("custom_vocab_id" ASC);

-- CreateIndex
CREATE INDEX "Vocab_reference_kind_reference_id_idx" ON "Vocab"("reference_kind" ASC, "reference_id" ASC);

-- CreateIndex
CREATE INDEX "VocabList_uid_idx" ON "VocabList"("uid" ASC);

-- CreateIndex
CREATE INDEX "VocabList_userId_idx" ON "VocabList"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "VocabList_userId_list_name_key" ON "VocabList"("userId" ASC, "list_name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "VocabListItem_list_id_vocab_id_key" ON "VocabListItem"("list_id" ASC, "vocab_id" ASC);

-- CreateIndex
CREATE INDEX "VocabListItem_vocab_id_idx" ON "VocabListItem"("vocab_id" ASC);

-- CreateIndex
CREATE INDEX "topic_progress_user_id_idx" ON "topic_progress"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "topic_progress_user_id_section_topic_id_key" ON "topic_progress"("user_id" ASC, "section" ASC, "topic_id" ASC);

-- AddForeignKey
ALTER TABLE "CustomVocab" ADD CONSTRAINT "CustomVocab_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiddenVocab" ADD CONSTRAINT "HiddenVocab_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiddenVocab" ADD CONSTRAINT "HiddenVocab_vocab_id_fkey" FOREIGN KEY ("vocab_id") REFERENCES "Vocab"("vocab_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_favourite_list_fkey" FOREIGN KEY ("favourite_list") REFERENCES "VocabList"("list_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vocab" ADD CONSTRAINT "Vocab_custom_vocab_id_fkey" FOREIGN KEY ("custom_vocab_id") REFERENCES "CustomVocab"("custom_vocab_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabList" ADD CONSTRAINT "VocabList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabListItem" ADD CONSTRAINT "VocabListItem_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "VocabList"("list_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabListItem" ADD CONSTRAINT "VocabListItem_vocab_id_fkey" FOREIGN KEY ("vocab_id") REFERENCES "Vocab"("vocab_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_progress" ADD CONSTRAINT "topic_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

