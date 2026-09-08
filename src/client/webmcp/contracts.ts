import { z } from 'zod';
import { portalConfig } from '@/portal.config';
import type { SourceId } from '@/client/federation/source';
import { SORT_OPTIONS } from '@/client/searchOptions';

// Build validation and advertised JSON Schema together from UI configuration.
export function createContracts(sources: SourceId[]) {
  const source = z
    .string()
    .refine((id) => sources.includes(id as SourceId), 'Source is not configured');
  const properties: Record<string, unknown> = {};
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const filter of portalConfig.filters) {
    if (filter.type === 'checkbox-group' || filter.type === 'select') {
      const item = filter.options?.length
        ? z.enum([...filter.options] as [string, ...string[]])
        : z.string().min(1).max(200);
      shape[filter.id] = z.array(item).max(50).optional();
      properties[filter.id] = {
        type: 'array',
        maxItems: 50,
        items: {
          type: 'string',
          ...(filter.options ? { enum: filter.options } : { minLength: 1, maxLength: 200 }),
        },
        description: filter.label,
      };
    } else if (filter.type === 'date-range') {
      shape[filter.id] = z
        .object({ start: z.string().date().optional(), end: z.string().date().optional() })
        .strict()
        .refine((v) => !v.start || !v.end || v.start <= v.end, 'Start must not follow end')
        .optional();
      properties[filter.id] = {
        type: 'object',
        additionalProperties: false,
        properties: {
          start: { type: 'string', format: 'date' },
          end: { type: 'string', format: 'date' },
        },
      };
    } else {
      shape[filter.id] = z
        .object({
          min: z.number().finite().nonnegative().optional(),
          max: z.number().finite().nonnegative().optional(),
        })
        .strict()
        .refine(
          (v) => v.min == null || v.max == null || v.min <= v.max,
          'Minimum must not exceed maximum',
        )
        .optional();
      properties[filter.id] = {
        type: 'object',
        additionalProperties: false,
        properties: { min: { type: 'number', minimum: 0 }, max: { type: 'number', minimum: 0 } },
      };
    }
  }
  const sorts = SORT_OPTIONS.map((s) => s.value);
  const search = z
    .object({
      source: source.optional(),
      query: z.string().max(500).optional(),
      filters: z.object(shape).strict().optional(),
      page: z.number().int().min(1).max(40).optional(),
      sort: z.enum(sorts as [(typeof sorts)[number], ...(typeof sorts)[number][]]).optional(),
    })
    .strict();
  return {
    search,
    detail: z.object({ source, id: z.string().uuid() }).strict(),
    searchJson: {
      type: 'object',
      additionalProperties: false,
      properties: {
        source: {
          type: 'string',
          enum: sources,
          description: 'Select visible source; omitted keeps current tab.',
        },
        query: {
          type: 'string',
          maxLength: 500,
          description: 'Omitted keeps query; empty clears it.',
        },
        filters: {
          type: 'object',
          additionalProperties: false,
          properties,
          description:
            'Replaces all filters when supplied. Omit to keep them. {} clears all, including status.',
        },
        page: { type: 'integer', minimum: 1, maximum: 40 },
        sort: { type: 'string', enum: sorts },
      },
    },
    detailJson: {
      type: 'object',
      additionalProperties: false,
      required: ['source', 'id'],
      properties: {
        source: { type: 'string', enum: sources },
        id: { type: 'string', format: 'uuid' },
      },
    },
  };
}
