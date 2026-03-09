import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mockFetch, resetFetchMock } from './helpers/mock-api.js';
import { createAllianceProposal, createAllianceVote } from './helpers/fixtures.js';

// ---------------------------------------------------------------------------
// Testable service replicating BaseApiService for alliance endpoint contract.
// ---------------------------------------------------------------------------

class TestableBaseApiService {
  private baseUrl: string;
  private token: string | null;

  constructor(baseUrl = '/api/v1', token: string | null = null) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    return headers;
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(`${this.baseUrl}${path}`, 'http://localhost');
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>,
  ): Promise<{ success: boolean; data?: T; error?: { code: string; message: string } }> {
    try {
      const url = this.buildUrl(path, params);
      const headers = this.getHeaders();
      const options: RequestInit = { method, headers };
      if (body !== undefined && method !== 'GET') {
        options.body = JSON.stringify(body);
      }
      const response = await fetch(url, options);
      const json = await response.json();
      if (!response.ok) {
        return {
          success: false,
          error: {
            code: json.code || `HTTP_${response.status}`,
            message: json.message || json.detail || response.statusText,
          },
        };
      }
      return {
        success: true,
        data: json.data !== undefined ? json.data : json,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      return {
        success: false,
        error: { code: 'NETWORK_ERROR', message },
      };
    }
  }

  get<T>(path: string, params?: Record<string, string>) {
    return this.request<T>('GET', path, undefined, params);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, body);
  }
}

// ---------------------------------------------------------------------------
// listProposals
// ---------------------------------------------------------------------------

describe('EpochAllianceApi — listProposals', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call GET /epochs/{id}/proposals', async () => {
    const spy = mockFetch([{ body: { data: [] } }]);
    await service.get('/epochs/epoch-1/proposals');
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/epochs/epoch-1/proposals');
    expect(init.method).toBe('GET');
  });

  it('should return proposals array', async () => {
    const proposals = [
      createAllianceProposal({ id: 'p-1', status: 'pending' }),
      createAllianceProposal({ id: 'p-2', status: 'accepted' }),
    ];
    mockFetch([{ body: { data: proposals } }]);
    const result = await service.get('/epochs/epoch-1/proposals');
    expect(result.success).toBe(true);
    expect(result.data).toEqual(proposals);
    expect((result.data as unknown[]).length).toBe(2);
  });

  it('should handle empty proposals', async () => {
    mockFetch([{ body: { data: [] } }]);
    const result = await service.get('/epochs/epoch-1/proposals');
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// createProposal
// ---------------------------------------------------------------------------

describe('EpochAllianceApi — createProposal', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call POST /epochs/{id}/proposals with simulation_id and team_id', async () => {
    const proposal = createAllianceProposal();
    const spy = mockFetch([{ body: { data: proposal } }]);

    // Mirrors EpochsApiService.createProposal: query param simulation_id, body { team_id }
    await service.post('/epochs/epoch-1/proposals?simulation_id=sim-1', {
      team_id: 'team-1',
    });

    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/epochs/epoch-1/proposals');
    expect(url).toContain('simulation_id=sim-1');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ team_id: 'team-1' });
  });

  it('should return created proposal with pending status', async () => {
    const proposal = createAllianceProposal({ id: 'p-new', status: 'pending' });
    mockFetch([{ body: { data: proposal } }]);
    const result = await service.post('/epochs/epoch-1/proposals?simulation_id=sim-1', {
      team_id: 'team-1',
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual(proposal);
    expect((result.data as Record<string, unknown>).status).toBe('pending');
  });

  it('should handle 400 error (team full)', async () => {
    mockFetch([{
      status: 400,
      body: { code: 'TEAM_FULL', message: 'Team has reached maximum capacity' },
    }]);
    const result = await service.post('/epochs/epoch-1/proposals?simulation_id=sim-1', {
      team_id: 'team-1',
    });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('TEAM_FULL');
    expect(result.error?.message).toBe('Team has reached maximum capacity');
  });

  it('should handle 409 error (duplicate proposal)', async () => {
    mockFetch([{
      status: 409,
      body: { code: 'DUPLICATE_PROPOSAL', message: 'A proposal already exists for this team' },
    }]);
    const result = await service.post('/epochs/epoch-1/proposals?simulation_id=sim-1', {
      team_id: 'team-1',
    });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('DUPLICATE_PROPOSAL');
    expect(result.error?.message).toBe('A proposal already exists for this team');
  });
});

// ---------------------------------------------------------------------------
// voteOnProposal
// ---------------------------------------------------------------------------

describe('EpochAllianceApi — voteOnProposal', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call POST /epochs/{id}/proposals/{pid}/vote with simulation_id and vote', async () => {
    const vote = createAllianceVote();
    const spy = mockFetch([{ body: { data: vote } }]);

    // Mirrors EpochsApiService.voteOnProposal: query param simulation_id, body { vote }
    await service.post(
      '/epochs/epoch-1/proposals/proposal-1/vote?simulation_id=sim-1',
      { vote: 'accept' },
    );

    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/epochs/epoch-1/proposals/proposal-1/vote');
    expect(url).toContain('simulation_id=sim-1');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ vote: 'accept' });
  });

  it('should return vote response on accept', async () => {
    const vote = createAllianceVote({ vote: 'accept' });
    mockFetch([{ body: { data: vote } }]);
    const result = await service.post(
      '/epochs/epoch-1/proposals/proposal-1/vote?simulation_id=sim-1',
      { vote: 'accept' },
    );
    expect(result.success).toBe(true);
    expect(result.data).toEqual(vote);
    expect((result.data as Record<string, unknown>).vote).toBe('accept');
  });

  it('should return vote response on reject', async () => {
    const vote = createAllianceVote({ vote: 'reject' });
    mockFetch([{ body: { data: vote } }]);
    const result = await service.post(
      '/epochs/epoch-1/proposals/proposal-1/vote?simulation_id=sim-1',
      { vote: 'reject' },
    );
    expect(result.success).toBe(true);
    expect(result.data).toEqual(vote);
    expect((result.data as Record<string, unknown>).vote).toBe('reject');
  });

  it('should handle 403 error (not team member)', async () => {
    mockFetch([{
      status: 403,
      body: { code: 'FORBIDDEN', message: 'Not a member of the target team' },
    }]);
    const result = await service.post(
      '/epochs/epoch-1/proposals/proposal-1/vote?simulation_id=sim-1',
      { vote: 'accept' },
    );
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('FORBIDDEN');
    expect(result.error?.message).toBe('Not a member of the target team');
  });

  it('should handle 400 error (already resolved)', async () => {
    mockFetch([{
      status: 400,
      body: { code: 'PROPOSAL_RESOLVED', message: 'Proposal has already been resolved' },
    }]);
    const result = await service.post(
      '/epochs/epoch-1/proposals/proposal-1/vote?simulation_id=sim-1',
      { vote: 'accept' },
    );
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('PROPOSAL_RESOLVED');
    expect(result.error?.message).toBe('Proposal has already been resolved');
  });
});
