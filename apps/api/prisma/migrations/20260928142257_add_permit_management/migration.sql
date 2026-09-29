-- CreateEnum
CREATE TYPE "PermitStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'REJECTED', 'CLOSED');

-- CreateTable
CREATE TABLE "permit_types" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permit_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permits" (
    "id" UUID NOT NULL,
    "permitNumber" TEXT NOT NULL,
    "permitTypeId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "status" "PermitStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" UUID,
    "rejectedAt" TIMESTAMP(3),
    "rejectedById" UUID,
    "rejectionReason" TEXT,
    "activatedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permit_types_name_key" ON "permit_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permits_permitNumber_key" ON "permits"("permitNumber");

-- CreateIndex
CREATE INDEX "permits_permitTypeId_idx" ON "permits"("permitTypeId");

-- CreateIndex
CREATE INDEX "permits_projectId_idx" ON "permits"("projectId");

-- CreateIndex
CREATE INDEX "permits_siteId_idx" ON "permits"("siteId");

-- CreateIndex
CREATE INDEX "permits_requestedById_idx" ON "permits"("requestedById");

-- CreateIndex
CREATE INDEX "permits_approvedById_idx" ON "permits"("approvedById");

-- CreateIndex
CREATE INDEX "permits_rejectedById_idx" ON "permits"("rejectedById");

-- CreateIndex
CREATE INDEX "permits_closedById_idx" ON "permits"("closedById");

-- CreateIndex
CREATE INDEX "permits_status_idx" ON "permits"("status");

-- CreateIndex
CREATE INDEX "permits_startDateTime_idx" ON "permits"("startDateTime");

-- CreateIndex
CREATE INDEX "permits_endDateTime_idx" ON "permits"("endDateTime");

-- AddForeignKey
ALTER TABLE "permits" ADD CONSTRAINT "permits_permitTypeId_fkey" FOREIGN KEY ("permitTypeId") REFERENCES "permit_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits" ADD CONSTRAINT "permits_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits" ADD CONSTRAINT "permits_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits" ADD CONSTRAINT "permits_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits" ADD CONSTRAINT "permits_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits" ADD CONSTRAINT "permits_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits" ADD CONSTRAINT "permits_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
