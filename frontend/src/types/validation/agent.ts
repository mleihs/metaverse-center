import { z } from 'zod';

export const agentCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  system: z.string().optional(),
  character: z.string().optional(),
  background: z.string().optional(),
  gender: z.string().optional(),
  primary_profession: z.string().optional(),
  portrait_image_url: z.string().url().optional().or(z.literal('')),
  portrait_description: z.string().optional(),
  data_source: z.string().default('manual'),
});

export const agentUpdateSchema = agentCreateSchema.partial().omit({ data_source: true });

export type AgentCreateData = z.infer<typeof agentCreateSchema>;
export type AgentUpdateData = z.infer<typeof agentUpdateSchema>;
