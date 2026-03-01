-- CreateTable
CREATE TABLE "FaceEmbedding" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "faceIndex" INTEGER NOT NULL DEFAULT 0,
    "embedding" DOUBLE PRECISION[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaceEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FaceEmbedding_roomId_idx" ON "FaceEmbedding"("roomId");

-- CreateIndex
CREATE INDEX "FaceEmbedding_photoId_idx" ON "FaceEmbedding"("photoId");

-- AddForeignKey
ALTER TABLE "FaceEmbedding" ADD CONSTRAINT "FaceEmbedding_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
