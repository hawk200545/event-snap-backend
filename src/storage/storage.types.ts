export type GenerateUploadUrlInput = {
  roomId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

export type GenerateUploadUrlOutput = {
  bucket: string;
  key: string;
  uploadUrl: string;
  expiresInSeconds: number;
};

export interface StorageService {
  generateUploadUrl(input: GenerateUploadUrlInput): Promise<GenerateUploadUrlOutput>;
  assertObjectExists(bucket: string, key: string): Promise<void>;
  generateReadUrl(key: string, expiresInSeconds?: number): Promise<string>;
}
