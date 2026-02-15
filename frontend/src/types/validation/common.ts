import { z } from 'zod';

export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
});

export const filterSchema = z.object({
  search: z.string().optional(),
  filters: z.record(z.string()).optional(),
});

export const uuidSchema = z.string().uuid('Invalid UUID format');

export type PaginationParams = z.infer<typeof paginationSchema>;
export type FilterParams = z.infer<typeof filterSchema>;
