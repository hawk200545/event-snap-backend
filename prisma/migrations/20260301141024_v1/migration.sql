-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ORGANIZER', 'ADMIN');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'DELETED');

-- CreateEnum
CREATE TYPE "UploadPermission" AS ENUM ('PUBLIC', 'APPROVAL_REQUIRED');

-- CreateEnum
CREATE TYPE "GuestSessionStatus" AS ENUM ('ACTIVE', 'LEFT', 'BLOCKED');

-- CreateEnum
CREATE TYPE "PhotoStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'READY', 'PENDING_APPROVAL', 'REJECTED', 'DELETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PhotoSource" AS ENUM ('GUEST_UPLOAD', 'ORGANIZER_UPLOAD', 'SELFIE_UPLOAD');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'ORGANIZER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "retentionDays" INTEGER NOT NULL DEFAULT 7,
    "uploadPermission" "UploadPermission" NOT NULL DEFAULT 'PUBLIC',
    "faceRecognitionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "status" "RoomStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestSession" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "guestToken" TEXT NOT NULL,
    "displayName" TEXT,
    "status" "GuestSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "GuestSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "uploaderSessionId" TEXT,
    "uploadedByUserId" TEXT,
    "source" "PhotoSource" NOT NULL DEFAULT 'GUEST_UPLOAD',
    "storageKey" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "originalFileName" TEXT,
    "contentType" TEXT NOT NULL,
    "extension" TEXT,
    "sizeBytes" BIGINT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PhotoStatus" NOT NULL DEFAULT 'UPLOADED',
    "processingJobId" TEXT,
    "processingError" TEXT,
    "processedAt" TIMESTAMP(3),
    "thumbnailKey" TEXT,
    "previewKey" TEXT,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Room_code_key" ON "Room"("code");

-- CreateIndex
CREATE INDEX "Room_organizerId_createdAt_idx" ON "Room"("organizerId", "createdAt");

-- CreateIndex
CREATE INDEX "Room_status_endsAt_idx" ON "Room"("status", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "GuestSession_guestToken_key" ON "GuestSession"("guestToken");

-- CreateIndex
CREATE INDEX "GuestSession_roomId_status_idx" ON "GuestSession"("roomId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Photo_storageKey_key" ON "Photo"("storageKey");

-- CreateIndex
CREATE INDEX "Photo_roomId_uploadedAt_idx" ON "Photo"("roomId", "uploadedAt");

-- CreateIndex
CREATE INDEX "Photo_roomId_status_uploadedAt_idx" ON "Photo"("roomId", "status", "uploadedAt");

-- CreateIndex
CREATE INDEX "Photo_processingJobId_idx" ON "Photo"("processingJobId");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestSession" ADD CONSTRAINT "GuestSession_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_uploaderSessionId_fkey" FOREIGN KEY ("uploaderSessionId") REFERENCES "GuestSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
