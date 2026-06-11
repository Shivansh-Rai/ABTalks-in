-- AlterTable
ALTER TABLE "RecruiterReview" ADD COLUMN     "achievements" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "education" JSONB,
ADD COLUMN     "projects" JSONB;
