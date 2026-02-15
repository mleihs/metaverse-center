import { z } from 'zod';

export const buildingCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  building_type: z.string().min(1, 'Building type is required'),
  description: z.string().optional(),
  style: z.string().optional(),
  location: z
    .object({
      lat: z.number(),
      lng: z.number(),
      address: z.string().optional(),
    })
    .optional(),
  city_id: z.string().uuid().optional(),
  zone_id: z.string().uuid().optional(),
  street_id: z.string().uuid().optional(),
  address: z.string().optional(),
  population_capacity: z.number().int().min(0).default(0),
  construction_year: z.number().int().optional(),
  building_condition: z.string().optional(),
  image_url: z.string().url().optional().or(z.literal('')),
  special_type: z.string().optional(),
  data_source: z.string().default('manual'),
});

export const buildingUpdateSchema = buildingCreateSchema.partial().omit({ data_source: true });

export type BuildingCreateData = z.infer<typeof buildingCreateSchema>;
export type BuildingUpdateData = z.infer<typeof buildingUpdateSchema>;
