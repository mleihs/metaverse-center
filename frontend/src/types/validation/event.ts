import { z } from 'zod';

export const eventCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  event_type: z.string().optional(),
  description: z.string().optional(),
  occurred_at: z.string().datetime().optional(),
  data_source: z.string().default('manual'),
  impact_level: z.number().int().min(1).max(10).default(1),
  location: z.string().optional(),
  tags: z.array(z.string()).default([]),
  propaganda_type: z.string().optional(),
  target_demographic: z.string().optional(),
  urgency_level: z.string().optional(),
});

export const eventUpdateSchema = eventCreateSchema.partial().omit({ data_source: true });

export type EventCreateData = z.infer<typeof eventCreateSchema>;
export type EventUpdateData = z.infer<typeof eventUpdateSchema>;
