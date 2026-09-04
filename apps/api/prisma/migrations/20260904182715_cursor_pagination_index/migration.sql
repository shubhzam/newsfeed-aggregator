-- DropIndex
DROP INDEX "Article_region_publishedAt_idx";

-- CreateIndex
CREATE INDEX "Article_region_publishedAt_id_idx" ON "Article"("region", "publishedAt", "id");
