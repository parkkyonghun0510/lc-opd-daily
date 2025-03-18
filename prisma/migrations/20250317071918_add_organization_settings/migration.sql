-- CreateTable
CREATE TABLE "OrganizationSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "validationRules" JSONB NOT NULL DEFAULT '{"writeOffs": {"maxAmount": 1000, "requireApproval": true}, "ninetyPlus": {"maxAmount": 5000, "requireApproval": true}, "comments": {"required": true, "minLength": 10}, "duplicateCheck": {"enabled": true}}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationSettings_organizationId_key" ON "OrganizationSettings"("organizationId"); 