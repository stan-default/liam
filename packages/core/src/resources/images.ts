import { readFile } from "node:fs/promises";
import type { LinkedInClient } from "../http.js";

interface InitUploadResponse {
  value: {
    uploadUrl: string;
    image: string; // urn:li:image:...
  };
}

/**
 * Uploads a local image to LinkedIn and returns its image URN, usable as post
 * media. Two steps: initialize the upload to get a signed URL, then PUT the bytes.
 */
export async function uploadImage(
  client: LinkedInClient,
  opts: { imagePath: string; ownerUrn: string; token: string },
): Promise<string> {
  const init = await client.request<InitUploadResponse>({
    method: "POST",
    path: "/images",
    query: { action: "initializeUpload" },
    body: { initializeUploadRequest: { owner: opts.ownerUrn } },
  });
  const { uploadUrl, image } = init.data.value;

  const bytes = await readFile(opts.imagePath);
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${opts.token}` },
    body: bytes,
  });
  if (!put.ok) {
    throw new Error(`Image upload failed (${put.status}): ${await put.text()}`);
  }
  return image;
}
