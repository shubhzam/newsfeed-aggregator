-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "categories" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Article_categories_idx" ON "Article" USING GIN ("categories");
