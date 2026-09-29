-- AlterTable
ALTER TABLE "permits" ADD COLUMN     "contractorDepartment" TEXT,
ADD COLUMN     "controlMeasures" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "hazards" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "location" TEXT,
ADD COLUMN     "requiredPpe" TEXT[] DEFAULT ARRAY[]::TEXT[];
