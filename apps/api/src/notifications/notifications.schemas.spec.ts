import { notificationsQuerySchema } from './notifications.schemas';

describe('notificationsQuerySchema', () => {
  it('coerces safe pagination defaults and accepts the read filter', () => {
    expect(notificationsQuerySchema.parse({ page: '2', pageSize: '20', status: 'READ' })).toEqual({
      page: 2,
      pageSize: 20,
      status: 'READ',
    });
    expect(notificationsQuerySchema.parse({})).toEqual({ page: 1, pageSize: 25, status: 'ALL' });
  });

  it('rejects unbounded pages and unknown query keys', () => {
    expect(notificationsQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
    expect(notificationsQuerySchema.safeParse({ recipientId: 'another-user' }).success).toBe(false);
  });
});
