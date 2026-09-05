BEGIN;

ALTER TABLE "Article" DROP CONSTRAINT "Article_publisherId_fkey";
ALTER TABLE "Publisher" DROP CONSTRAINT "Publisher_pkey";
ALTER TABLE "Article" DROP CONSTRAINT "Article_pkey";

ALTER TABLE "Publisher" DROP COLUMN "id";
ALTER TABLE "Publisher" RENAME COLUMN "newId" TO "id";

ALTER TABLE "Article" DROP COLUMN "id";
ALTER TABLE "Article" RENAME COLUMN "newId" TO "id";

ALTER TABLE "Article" DROP COLUMN "publisherId";
ALTER TABLE "Article" RENAME COLUMN "newPublisherId" TO "publisherId";

ALTER TABLE "Publisher" ADD PRIMARY KEY ("id");
ALTER TABLE "Article" ADD PRIMARY KEY ("id");

ALTER TABLE "Article" ALTER COLUMN "publisherId" SET NOT NULL;
ALTER TABLE "Article" ADD CONSTRAINT "Article_publisherId_fkey"
  FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

COMMIT;
