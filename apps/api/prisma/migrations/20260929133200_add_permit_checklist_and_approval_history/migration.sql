-- CreateEnum
CREATE TYPE "PermitApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "permit_checklist_items" (
    "id" UUID NOT NULL,
    "permitId" UUID NOT NULL,
    "itemText" TEXT NOT NULL,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "completedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permit_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permit_approvals" (
    "id" UUID NOT NULL,
    "permitId" UUID NOT NULL,
    "approverId" UUID NOT NULL,
    "decision" "PermitApprovalDecision" NOT NULL,
    "comments" TEXT,
    "approvalDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permit_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "permit_checklist_items_permitId_idx" ON "permit_checklist_items"("permitId");

-- CreateIndex
CREATE INDEX "permit_checklist_items_completedById_idx" ON "permit_checklist_items"("completedById");

-- CreateIndex
CREATE INDEX "permit_checklist_items_permitId_isMandatory_isCompleted_idx" ON "permit_checklist_items"("permitId", "isMandatory", "isCompleted");

-- CreateIndex
CREATE INDEX "permit_approvals_permitId_idx" ON "permit_approvals"("permitId");

-- CreateIndex
CREATE INDEX "permit_approvals_approverId_idx" ON "permit_approvals"("approverId");

-- CreateIndex
CREATE INDEX "permit_approvals_permitId_approvalDate_idx" ON "permit_approvals"("permitId", "approvalDate");

-- AddForeignKey
ALTER TABLE "permit_checklist_items" ADD CONSTRAINT "permit_checklist_items_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "permits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permit_checklist_items" ADD CONSTRAINT "permit_checklist_items_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permit_approvals" ADD CONSTRAINT "permit_approvals_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "permits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permit_approvals" ADD CONSTRAINT "permit_approvals_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
