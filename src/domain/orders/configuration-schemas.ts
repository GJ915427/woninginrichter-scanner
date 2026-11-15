/**
 * src/domain/orders/configuration-schemas.ts
 *
 * Runtime validatieschema's voor geëxtraheerde productconfiguraties (Zod).
 * Beschermt tegen ongetypeerde JSONB payload drift en waarborgt integriteit.
 */

import { z } from 'zod';

export const ConfigurationDimensionsSchema = z.object({
  width_mm: z.number().int().positive().optional(),
  height_mm: z.number().int().positive().optional(),
  depth_mm: z.number().int().positive().optional(),
  area_m2: z.number().positive().optional(),
  linear_meters: z.number().positive().optional(),
});

export const ConfigurationSpecSchema = z.object({
  status: z.enum(['valid', 'incomplete', 'requires_review']),
  confidence: z.number().min(0).max(1),
  source: z.enum(['erp_fields', 'eorder_json', 'regex_tokenizer', 'cognitive', 'manual']),
  dimensions: ConfigurationDimensionsSchema.optional(),
  options: z.array(z.string()).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  extraction_notes: z.array(z.string()).optional(),
  reconciled_product_group_code: z.string().optional(),
});

export const CurtainConfigSchema = ConfigurationSpecSchema.extend({
  attributes: z
    .object({
      pleat_type: z.string().optional(),
      hook_type: z.string().optional(),
      track_type: z.string().optional(),
      fabric_width_mm: z.number().optional(),
      lead_cord: z.boolean().optional(),
      hem_cm: z.number().optional(),
    })
    .catchall(z.unknown())
    .optional(),
});

export const HardWindowConfigSchema = ConfigurationSpecSchema.extend({
  attributes: z
    .object({
      model: z.string().optional(),
      operation: z.string().optional(),
      side: z.string().optional(),
      profile_color: z.string().optional(),
      mounting: z.string().optional(),
      slat_width_mm: z.number().optional(),
    })
    .catchall(z.unknown())
    .optional(),
});

export const FlooringConfigSchema = ConfigurationSpecSchema.extend({
  attributes: z
    .object({
      subfloor: z.string().optional(),
      plinth_type: z.string().optional(),
      laying_pattern: z.string().optional(),
      underfloor_heating: z.boolean().optional(),
      waste_percentage: z.number().optional(),
    })
    .catchall(z.unknown())
    .optional(),
});

export const ServiceConfigSchema = ConfigurationSpecSchema.extend({
  attributes: z
    .object({
      discipline: z.string().optional(),
      is_included: z.boolean().optional(),
      reference_line: z.number().optional(),
    })
    .catchall(z.unknown())
    .optional(),
});

export type ConfigurationSpecDto = z.infer<typeof ConfigurationSpecSchema>;
