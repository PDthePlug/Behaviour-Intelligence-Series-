import { getDb } from "@/db";
import { partnershipInquiries } from "@/db/schema";

type InquiryPayload = {
  organisation?: string;
  contactName?: string;
  email?: string;
  audience?: string;
  cohortSize?: number;
  message?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = (await request.json()) as InquiryPayload;
  const organisation = body.organisation?.trim() ?? "";
  const contactName = body.contactName?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const audience = body.audience?.trim() ?? "";
  const message = body.message?.trim() ?? "";
  const cohortSize = Math.min(Math.max(Number(body.cohortSize) || 0, 1), 100000);

  if (!organisation || !contactName || !audience || message.length < 10 || !emailPattern.test(email)) {
    return Response.json({ error: "Please complete the organisation, contact, email, audience and message fields." }, { status: 400 });
  }

  await getDb().insert(partnershipInquiries).values({
    id: crypto.randomUUID(),
    organisation,
    contactName,
    email,
    audience,
    cohortSize,
    message,
    status: "new",
    createdAt: Date.now(),
  });
  return Response.json({ received: true }, { status: 201 });
}
