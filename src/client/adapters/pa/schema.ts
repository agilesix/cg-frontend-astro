// Source of truth: cg-api-pa/src/adapter/{fields.ts,plugin.ts}.
// TODO: replace with `@common-grants/cg-pa` once published. Keep byte-identical
// until then — the API uses the same definePlugin() output shape.
import { definePlugin } from '@common-grants/sdk/extensions';
import { z } from 'zod';

const AgencyValueSchema = z.object({
  code: z.string().nullish(),
  name: z.string().nullish(),
  parentName: z.string().nullish(),
  parentCode: z.string().nullish(),
});

const ContactInfoValueSchema = z.object({
  name: z.string().nullish(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  description: z.string().nullish(),
});

const AdditionalInfoValueSchema = z.object({
  url: z.string().nullish(),
  description: z.string().nullish(),
});

const CostSharingValueSchema = z.object({
  isRequired: z.boolean().nullish(),
});

const PaProcessStepSchema = z.object({
  stepNumber: z.number().int(),
  description: z.string(),
});

const PaAdditionalResourceSchema = z.object({
  title: z.string(),
  url: z.string(),
});

const PaFaqSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

export const PaPlugin = definePlugin({
  extensions: {
    Opportunity: {
      legacySerialId: {
        fieldType: 'integer',
        description:
          'An integer ID for the opportunity, needed for compatibility with legacy systems',
      },
      agency: {
        fieldType: 'object',
        value: AgencyValueSchema,
        description: 'Information about the agency offering this opportunity',
      },
      contactInfo: {
        fieldType: 'object',
        value: ContactInfoValueSchema,
        description: 'Contact information (name, email, phone, description) for this resource',
      },
      additionalInfo: {
        fieldType: 'object',
        value: AdditionalInfoValueSchema,
        description: 'URL and description for additional information about the opportunity',
      },
      costSharing: {
        fieldType: 'object',
        value: CostSharingValueSchema,
        description: 'Whether cost sharing or matching funds are required for this opportunity',
      },
      paSlug: {
        fieldType: 'string',
        description: "Pennsylvania's URL-friendly opportunity identifier",
      },
      paCategory: {
        fieldType: 'string',
        description: "Pennsylvania's category taxonomy (often mirrors the issuing agency)",
      },
      paGrantCycle: {
        fieldType: 'string',
        description: 'PA grant cycle label (e.g. "Annual")',
      },
      paFundingType: {
        fieldType: 'string',
        description: 'PA funding type label (e.g. "Grant", "Loan")',
      },
      paFundingSource: {
        fieldType: 'string',
        description: 'PA funding source label (e.g. "State", "Federal")',
      },
      paMatchingFundsRequirement: {
        fieldType: 'number',
        value: z.number().min(0).max(1),
        description: 'Exact matching-funds ratio (0–1).',
      },
      paRawMinAward: {
        fieldType: 'string',
        description: 'Original `minimumAward` string when not parseable to a number',
      },
      paRawMaxAward: {
        fieldType: 'string',
        description: 'Original `maximumAward` string when not parseable to a number',
      },
      paRawTotalFunds: {
        fieldType: 'string',
        description: 'Original `totalFundsToBeAwarded` string when not parseable to a number',
      },
      paProcessSteps: {
        fieldType: 'array',
        value: z.array(PaProcessStepSchema),
        description: 'PA application process steps',
      },
      paAdditionalResources: {
        fieldType: 'array',
        value: z.array(PaAdditionalResourceSchema),
        description: 'Links to supporting documents and pages for the opportunity',
      },
      paFaqs: {
        fieldType: 'array',
        value: z.array(PaFaqSchema),
        description: 'Frequently asked questions for the opportunity',
      },
      paLastSyncedAt: {
        fieldType: 'string',
        value: z.string().datetime(),
        description: 'ISO 8601 datetime when this record was last ingested from PA',
      },
    },
  },
} as const);

export const PaOpportunitySchema = PaPlugin.schemas.Opportunity;
export type PaOpportunity = z.infer<typeof PaOpportunitySchema>;
