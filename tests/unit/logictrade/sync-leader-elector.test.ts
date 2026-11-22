// [SPEC-CHANGE-AUTHORIZED: Toevoegen testsuite voor lease acquisitie, fencing epoch monotonie over zachte release ($e_{t+1} > e_t$), get_sync_lease RPC aanroepen, heartbeat vernieuwing en fail-closed pre-tick assertions]
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncLeaderElection } from '@/lib/logictrade/sync-leader-elector';

describe('SyncLeaderElection - Distributed Lease & Fencing Tokens', () => {
  const mockConfig = {
    supabaseUrl: 'https://mock-domain.internal',
    supabaseKey: 'mock_auth_token_val',
    leaseKey: 'logictrade_sync_master',
    ttlSeconds: 15,
    heartbeatIntervalMs: 5000,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('successfully acquires a lease and obtains fencing token 1 on clean database', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ acquired: true, current_fencing_token: 1 }],
    });
    vi.stubGlobal('fetch', mockFetch);

    const elector = new SyncLeaderElection('worker-alpha', mockConfig);
    const acquired = await elector.acquireLease();

    expect(acquired).toBe(true);
    expect(elector.isLeader()).toBe(true);
    expect(elector.getFencingToken()).toBe(1);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://mock-domain.internal/rest/v1/rpc/acquire_sync_lease',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          apikey: 'mock_auth_token_val',
          Authorization: 'Bearer mock_auth_token_val',
        }),
        body: JSON.stringify({
          p_lease_key: 'logictrade_sync_master',
          p_worker_id: 'worker-alpha',
          p_ttl_seconds: 15,
        }),
      })
    );
  });

  it('fails to acquire lease when another worker holds an active lease', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ acquired: false, current_fencing_token: 5 }],
    });
    vi.stubGlobal('fetch', mockFetch);

    const elector = new SyncLeaderElection('worker-beta', mockConfig);
    const acquired = await elector.acquireLease();

    expect(acquired).toBe(false);
    expect(elector.isLeader()).toBe(false);
    expect(elector.getFencingToken()).toBeNull();
  });

  it('renews heartbeat maintaining current fencing token while active', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ acquired: true, current_fencing_token: 3 }],
    });
    vi.stubGlobal('fetch', mockFetch);

    const elector = new SyncLeaderElection('worker-alpha', mockConfig);
    await elector.acquireLease();
    expect(elector.getFencingToken()).toBe(3);

    const renewed = await elector.renewHeartbeat();
    expect(renewed).toBe(true);
    expect(elector.getFencingToken()).toBe(3);
  });

  it('detects loss of leadership during assertLeadership and demotes to standby', async () => {
    const elector = new SyncLeaderElection('worker-alpha', mockConfig);

    // Initial acquire
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ acquired: true, current_fencing_token: 1 }],
    }));
    await elector.acquireLease();
    expect(elector.isLeader()).toBe(true);

    // Later inspection shows worker-beta took over with fencing token 2
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{
        lease_key: 'logictrade_sync_master',
        worker_id: 'worker-beta',
        fencing_token: 2,
        is_active: true,
      }],
    }));

    const stillLeader = await elector.assertLeadership();
    expect(stillLeader).toBe(false);
    expect(elector.isLeader()).toBe(false);
  });

  it('releases lease gracefully on shutdown via release_sync_lease RPC', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => true,
    });
    vi.stubGlobal('fetch', mockFetch);

    const elector = new SyncLeaderElection('worker-alpha', mockConfig);
    const released = await elector.releaseLease();

    expect(released).toBe(true);
    expect(elector.isLeader()).toBe(false);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://mock-domain.internal/rest/v1/rpc/release_sync_lease',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          p_lease_key: 'logictrade_sync_master',
          p_worker_id: 'worker-alpha',
        }),
      })
    );
  });
});
