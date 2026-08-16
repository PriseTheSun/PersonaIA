import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { NotificationsController } from './notifications.controller';

describe('NotificationsController authorization', () => {
  it('allows every authenticated application role', () => {
    expect(Reflect.getMetadata(ROLES_KEY, NotificationsController)).toEqual([
      'SUPER_ADMIN', 'CLIENT_ADMIN', 'WORKSPACE_ADMIN', 'WORKSPACE_MEMBER', 'PROJECT_USER',
    ]);
  });
});
