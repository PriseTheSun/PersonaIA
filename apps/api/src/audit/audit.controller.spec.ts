import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { AuditController } from './audit.controller';

describe('AuditController authorization', () => {
  it('is restricted to SUPER_ADMIN at controller level', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AuditController)).toEqual(['SUPER_ADMIN']);
  });
});
