import { z } from 'zod';

export const simulationCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .max(100)
    .optional(),
  description: z.string().optional(),
  theme: z
    .enum(['dystopian', 'utopian', 'fantasy', 'scifi', 'historical', 'custom'])
    .default('custom'),
  content_locale: z.string().default('en'),
  additional_locales: z.array(z.string()).default([]),
});

export type SimulationCreateData = z.infer<typeof simulationCreateSchema>;
