-- CreateEnum
CREATE TYPE "InspectionCategory" AS ENUM ('SITE', 'EQUIPMENT', 'VEHICLE');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "InspectionResponseResult" AS ENUM ('PASS', 'FAIL', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "InspectionFindingSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "InspectionFindingType" AS ENUM ('DEFECT', 'OBSERVATION', 'UNSAFE_ACT', 'UNSAFE_CONDITION');

-- CreateTable
CREATE TABLE "inspection_types" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" "InspectionCategory" NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspection_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_template_items" (
    "id" UUID NOT NULL,
    "inspectionTypeId" UUID NOT NULL,
    "itemText" TEXT NOT NULL,
    "sectionName" TEXT,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspection_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspections" (
    "id" UUID NOT NULL,
    "inspectionNumber" TEXT NOT NULL,
    "inspectionTypeId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "inspectorId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "submittedById" UUID,
    "approvedById" UUID,
    "approvalComments" TEXT,
    "rejectionReason" TEXT,
    "status" "InspectionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_checklist_responses" (
    "id" UUID NOT NULL,
    "inspectionId" UUID NOT NULL,
    "templateItemId" UUID NOT NULL,
    "result" "InspectionResponseResult",
    "comments" TEXT,
    "respondedById" UUID,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspection_checklist_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_findings" (
    "id" UUID NOT NULL,
    "inspectionId" UUID NOT NULL,
    "checklistResponseId" UUID,
    "createdById" UUID NOT NULL,
    "findingType" "InspectionFindingType" NOT NULL,
    "severity" "InspectionFindingSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recommendedAction" TEXT,
    "location" TEXT,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspection_findings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inspection_types_companyId_idx" ON "inspection_types"("companyId");

-- CreateIndex
CREATE INDEX "inspection_types_category_idx" ON "inspection_types"("category");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_types_companyId_code_key" ON "inspection_types"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_types_companyId_name_key" ON "inspection_types"("companyId", "name");

-- CreateIndex
CREATE INDEX "inspection_template_items_inspectionTypeId_idx" ON "inspection_template_items"("inspectionTypeId");

-- CreateIndex
CREATE INDEX "inspection_template_items_inspectionTypeId_isActive_idx" ON "inspection_template_items"("inspectionTypeId", "isActive");

-- CreateIndex
CREATE INDEX "inspection_template_items_inspectionTypeId_displayOrder_idx" ON "inspection_template_items"("inspectionTypeId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "inspections_inspectionNumber_key" ON "inspections"("inspectionNumber");

-- CreateIndex
CREATE INDEX "inspections_inspectionTypeId_idx" ON "inspections"("inspectionTypeId");

-- CreateIndex
CREATE INDEX "inspections_projectId_idx" ON "inspections"("projectId");

-- CreateIndex
CREATE INDEX "inspections_siteId_idx" ON "inspections"("siteId");

-- CreateIndex
CREATE INDEX "inspections_inspectorId_idx" ON "inspections"("inspectorId");

-- CreateIndex
CREATE INDEX "inspections_submittedById_idx" ON "inspections"("submittedById");

-- CreateIndex
CREATE INDEX "inspections_approvedById_idx" ON "inspections"("approvedById");

-- CreateIndex
CREATE INDEX "inspections_status_idx" ON "inspections"("status");

-- CreateIndex
CREATE INDEX "inspections_scheduledAt_idx" ON "inspections"("scheduledAt");

-- CreateIndex
CREATE INDEX "inspections_createdAt_idx" ON "inspections"("createdAt");

-- CreateIndex
CREATE INDEX "inspection_checklist_responses_inspectionId_idx" ON "inspection_checklist_responses"("inspectionId");

-- CreateIndex
CREATE INDEX "inspection_checklist_responses_templateItemId_idx" ON "inspection_checklist_responses"("templateItemId");

-- CreateIndex
CREATE INDEX "inspection_checklist_responses_respondedById_idx" ON "inspection_checklist_responses"("respondedById");

-- CreateIndex
CREATE INDEX "inspection_checklist_responses_result_idx" ON "inspection_checklist_responses"("result");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_checklist_responses_inspectionId_templateItemId_key" ON "inspection_checklist_responses"("inspectionId", "templateItemId");

-- CreateIndex
CREATE INDEX "inspection_findings_inspectionId_idx" ON "inspection_findings"("inspectionId");

-- CreateIndex
CREATE INDEX "inspection_findings_checklistResponseId_idx" ON "inspection_findings"("checklistResponseId");

-- CreateIndex
CREATE INDEX "inspection_findings_createdById_idx" ON "inspection_findings"("createdById");

-- CreateIndex
CREATE INDEX "inspection_findings_findingType_idx" ON "inspection_findings"("findingType");

-- CreateIndex
CREATE INDEX "inspection_findings_severity_idx" ON "inspection_findings"("severity");

-- CreateIndex
CREATE INDEX "inspection_findings_isClosed_idx" ON "inspection_findings"("isClosed");

-- AddForeignKey
ALTER TABLE "inspection_types" ADD CONSTRAINT "inspection_types_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_template_items" ADD CONSTRAINT "inspection_template_items_inspectionTypeId_fkey" FOREIGN KEY ("inspectionTypeId") REFERENCES "inspection_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_inspectionTypeId_fkey" FOREIGN KEY ("inspectionTypeId") REFERENCES "inspection_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_checklist_responses" ADD CONSTRAINT "inspection_checklist_responses_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_checklist_responses" ADD CONSTRAINT "inspection_checklist_responses_templateItemId_fkey" FOREIGN KEY ("templateItemId") REFERENCES "inspection_template_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_checklist_responses" ADD CONSTRAINT "inspection_checklist_responses_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_findings" ADD CONSTRAINT "inspection_findings_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_findings" ADD CONSTRAINT "inspection_findings_checklistResponseId_fkey" FOREIGN KEY ("checklistResponseId") REFERENCES "inspection_checklist_responses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_findings" ADD CONSTRAINT "inspection_findings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
