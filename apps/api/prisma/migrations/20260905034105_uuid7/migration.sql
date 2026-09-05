-- DropIndex
DROP INDEX "Article_newId_key";

-- DropIndex
DROP INDEX "Publisher_newId_key";

-- CreateIndex
CREATE INDEX "Article_region_publishedAt_id_idx" ON "Article"("region", "publishedAt", "id");
