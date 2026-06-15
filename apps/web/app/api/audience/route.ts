import {
  createLiads,
  requireDefaultAccountId,
  extractEmailsFromCsvText,
  uploadAudienceFromEmails,
} from "@liads/core";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Audience upload: accepts a CSV (multipart) plus a name, hashes the emails, and
 * creates a matched-audience DMP segment. Gated by MCP_AUTH_TOKEN, the same shared
 * secret as the MCP endpoint, so only the operator can write to the ad account.
 */
export async function POST(req: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Expected multipart form data." }, 400);
  }

  const secret = process.env.MCP_AUTH_TOKEN;
  if (secret && form.get("token") !== secret) {
    return json({ error: "Unauthorized. Check your access token." }, 401);
  }

  const name = String(form.get("name") ?? "").trim();
  const emailColumn = String(form.get("emailColumn") ?? "email").trim() || "email";
  const accountOverride = String(form.get("accountId") ?? "").trim();
  const file = form.get("file");

  if (!name) return json({ error: "Audience name is required." }, 400);
  if (!(file instanceof File)) return json({ error: "A CSV file is required." }, 400);

  let emails: string[];
  try {
    emails = extractEmailsFromCsvText(await file.text(), emailColumn);
  } catch {
    return json({ error: `Could not parse the CSV. Check that it has a "${emailColumn}" column.` }, 400);
  }
  if (emails.length === 0) {
    return json({ error: `No emails found in column "${emailColumn}".` }, 400);
  }

  try {
    const liads = await createLiads();
    const accountId = accountOverride || (await requireDefaultAccountId());
    const result = await uploadAudienceFromEmails(liads.client, liads.getToken, { accountId, name, emails });
    return json({ ok: true, accountId, ...result });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Upload failed." }, 502);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
