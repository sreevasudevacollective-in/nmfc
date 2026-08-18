import { z } from "zod";

export const weightClasses = [
  "FLYWEIGHT",
  "BANTAMWEIGHT",
  "FEATHERWEIGHT",
  "LIGHTWEIGHT",
  "WELTERWEIGHT",
  "MIDDLEWEIGHT",
  "LIGHT_HEAVYWEIGHT",
  "HEAVYWEIGHT",
] as const;

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalText = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

export const applicationDraftBody = z.object({
  draftStep: z.coerce.number().int().min(1).max(4).optional(),
  firstName: optionalText(80),
  lastName: optionalText(80),
  nickname: optionalText(80),
  dob: z.preprocess(emptyToUndefined, z.iso.date().optional()),
  weightClass: z.preprocess(emptyToUndefined, z.enum(weightClasses).optional()),
  heightCm: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().max(250).optional()),
  reachCm: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().max(250).optional()),
  gym: optionalText(120),
  hometown: optionalText(120),
  instagram: optionalText(80),
  bio: optionalText(2000),
  phone: optionalText(40),
  address: optionalText(240),
});

export const applicationSubmitBody = applicationDraftBody.extend({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
});

export type ApplicationDraftBody = z.infer<typeof applicationDraftBody>;
