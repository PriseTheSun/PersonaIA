import { auditQuerySchema } from './audit.schemas';

describe('auditQuerySchema', () => {
  it('applies bounded pagination defaults', () => {
    expect(auditQuerySchema.parse({})).toEqual({ page: 1, pageSize: 25 });
    expect(auditQuerySchema.safeParse({ page: '1', pageSize: '101' }).success).toBe(false);
  });

  it('rejects invalid and inverted date ranges', () => {
    expect(auditQuerySchema.safeParse({ from: '2026-02-30' }).success).toBe(false);
    expect(auditQuerySchema.safeParse({ from: '2026-08-20', to: '2026-08-19' }).success).toBe(false);
    expect(auditQuerySchema.safeParse({ from: '2026-08-19', to: '2026-08-20' }).success).toBe(true);
  });

  it('rejects unknown query properties', () => {
    expect(auditQuerySchema.safeParse({ includeSecrets: 'true' }).success).toBe(false);
  });
});
