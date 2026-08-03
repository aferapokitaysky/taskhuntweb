-- AlterTable
ALTER TABLE "file_assets" ADD COLUMN     "moderatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "moderatedAt" TIMESTAMP(3);
