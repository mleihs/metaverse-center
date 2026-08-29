import { describe, it, expect } from 'vitest';
import type {
  Simulation,
  Agent,
  Building,
  Event,
  ApiResponse,
  PaginatedResponse,
  UUID,
} from '../src/types/index.js';

describe('Type definitions', () => {
  it('should compile UUID type alias', () => {
    const id: UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    expect(typeof id).toBe('string');
  });

  it('should compile Simulation interface', () => {
    const sim: Simulation = {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Test Simulation',
      slug: 'test-simulation',
      description: 'A test simulation',
      theme: 'dystopian',
      status: 'draft',
      simulation_type: 'template',
      content_locale: 'de',
      additional_locales: ['en'],
      owner_id: '00000000-0000-0000-0000-000000000002',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    expect(sim.name).toBe('Test Simulation');
    expect(sim.theme).toBe('dystopian');
    expect(sim.status).toBe('draft');
  });

  it('should compile Agent interface', () => {
    const agent: Agent = {
      id: '00000000-0000-0000-0000-000000000003',
      simulation_id: '00000000-0000-0000-0000-000000000001',
      slug: 'test-agent',
      name: 'Test Agent',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    expect(agent.name).toBe('Test Agent');
  });

  it('should compile Building interface', () => {
    const building: Building = {
      id: '00000000-0000-0000-0000-000000000004',
      simulation_id: '00000000-0000-0000-0000-000000000001',
      slug: 'test-building',
      name: 'Test Building',
      building_type: 'residential',
      population_capacity: 100,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    expect(building.building_type).toBe('residential');
  });

  it('should compile Event interface', () => {
    const event: Event = {
      id: '00000000-0000-0000-0000-000000000005',
      simulation_id: '00000000-0000-0000-0000-000000000001',
      title: 'Test Event',
      occurred_at: '2026-01-01T00:00:00Z',
      data_source: 'local',
      impact_level: 5,
      tags: ['test'],
      event_status: 'active',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    expect(event.title).toBe('Test Event');
    expect(event.impact_level).toBe(5);
  });

  it('should compile ApiResponse generic type', () => {
    const response: ApiResponse<string> = {
      success: true,
      data: 'hello',
    };
    expect(response.success).toBe(true);
    expect(response.data).toBe('hello');
  });

  it('should compile ApiResponse error variant', () => {
    const response: ApiResponse<string> = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
      },
    };
    expect(response.success).toBe(false);
    expect(response.error?.code).toBe('NOT_FOUND');
  });

  it('should compile PaginatedResponse type with meta', () => {
    const response: PaginatedResponse<Agent> = {
      success: true,
      data: [],
      meta: { count: 0, total: 0, limit: 25, offset: 0 },
    };
    expect(response.meta?.total).toBe(0);
    expect(response.meta?.limit).toBe(25);
  });

  it('should compile PaginatedResponse error branch without meta', () => {
    // A *successful* paginated response always carries meta; only the failure
    // branch omits it. The previous version of this test asserted an optional
    // meta on `success: true` -- a shape the type has not permitted for a long
    // time. tsc never saw this file, so the assertion went on passing.
    const response: PaginatedResponse<Agent> = {
      success: false,
      error: { code: 'NOT_FOUND', message: 'No agents.' },
    };
    expect(response.meta).toBeUndefined();
    expect(response.error?.code).toBe('NOT_FOUND');
  });
});
