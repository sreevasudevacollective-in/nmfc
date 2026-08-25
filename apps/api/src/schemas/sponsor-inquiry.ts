import { z } from "zod";

export const sponsorInquiryBody = z.object({
  name: z.string().trim().min(1).max(120),
  organization: z.string().trim().max(160).optional(),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().max(2000).optional(),
  interestedPackage: z.string().trim().max(80).optional(),
});

export type SponsorInquiryBody = z.infer<typeof sponsorInquiryBody>;
