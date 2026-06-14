import type { LinkedInClient, TokenProvider } from "./http.js";
import type { SponsoredImageCreativeInput } from "./schemas.js";
import { uploadImage } from "./resources/images.js";
import { createInlineImageCreative } from "./resources/creatives.js";

export interface DraftCreativeResult {
  creativeId: string;
  status: string;
  imageUrn?: string;
  /** Set when no image was provided and the creative was intentionally not created. */
  pendingImage?: boolean;
  note?: string;
}

/**
 * High-level path for a single-image Sponsored Content draft. If an image path is
 * given, it's uploaded first and the creative is created inline as a DRAFT. If no
 * image is given, nothing is created — the campaign is left ready for Stan to add
 * creative later (the "I'll drop in the picture myself" workflow).
 */
export async function createSponsoredImageDraft(
  client: LinkedInClient,
  getToken: TokenProvider,
  input: SponsoredImageCreativeInput,
): Promise<DraftCreativeResult> {
  if (!input.imagePath) {
    return {
      creativeId: "",
      status: input.status,
      pendingImage: true,
      note: "No image supplied — campaign is ready; add the creative with an image when available.",
    };
  }

  const token = await getToken();
  const imageUrn = await uploadImage(client, {
    imagePath: input.imagePath,
    ownerUrn: input.organizationUrn,
    token,
  });

  const created = await createInlineImageCreative(client, {
    accountId: input.accountId,
    campaignId: input.campaignId,
    organizationUrn: input.organizationUrn,
    commentary: input.commentary,
    imageUrn,
    altText: input.headline,
    intendedStatus: input.status,
  });

  return { creativeId: created.id, status: input.status, imageUrn };
}
