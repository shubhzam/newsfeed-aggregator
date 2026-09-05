/*
  Warnings:

  - A unique constraint covering the columns `[newId]` on the table `Article` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[newId]` on the table `Publisher` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "newId" TEXT,
ADD COLUMN     "newPublisherId" TEXT;

-- AlterTable
ALTER TABLE "Publisher" ADD COLUMN     "newId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Article_newId_key" ON "Article"("newId");

-- CreateIndex
CREATE UNIQUE INDEX "Publisher_newId_key" ON "Publisher"("newId");
