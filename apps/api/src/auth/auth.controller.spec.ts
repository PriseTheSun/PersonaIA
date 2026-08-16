import { AuthController } from './auth.controller';

describe('AuthController session persistence', () => {
  const input = { email: 'admin@personaia.test', password: 'Secure!Pass123', rememberMe: false };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-15T20:00:00.000Z'));
  });

  afterEach(() => jest.useRealTimers());

  function setup(rememberMe: boolean) {
    const auth = {
      login: jest.fn().mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: '15m',
        sessionExpiresAt: '2026-08-15T22:00:00.000Z',
        rememberMe,
        user: { id: 'user-1' }
      })
    };
    const config = {
      get: jest.fn((key: string) => key === 'NODE_ENV' ? 'test' : 'false'),
      getOrThrow: jest.fn()
    };
    const response = { cookie: jest.fn() };
    const request = { get: jest.fn().mockReturnValue('test-agent'), ip: '127.0.0.1' };
    const access = { contexts: jest.fn().mockResolvedValue([]) };
    return { controller: new AuthController(auth as never, config as never, access as never), auth, response, request };
  }

  it('uses browser-session cookies when remember me is disabled', async () => {
    const { controller, response, request } = setup(false);

    const body = await controller.login(input, request as never, response as never);

    expect(response.cookie).toHaveBeenCalledTimes(2);
    expect(response.cookie.mock.calls[0]?.[2]).not.toHaveProperty('maxAge');
    expect(response.cookie.mock.calls[1]?.[2]).not.toHaveProperty('maxAge');
    expect(body).not.toHaveProperty('refreshToken');
    expect(body).not.toHaveProperty('rememberMe');
    expect(body).toHaveProperty('sessionExpiresAt', '2026-08-15T22:00:00.000Z');
  });

  it('persists secure cookies only when remember me is enabled', async () => {
    const { controller, response, request } = setup(true);

    await controller.login({ ...input, rememberMe: true }, request as never, response as never);

    expect(response.cookie.mock.calls[0]?.[2]).toEqual(expect.objectContaining({ httpOnly: true, sameSite: 'strict', maxAge: 7_200_000 }));
    expect(response.cookie.mock.calls[1]?.[2]).toEqual(expect.objectContaining({ httpOnly: false, sameSite: 'strict', maxAge: 7_200_000 }));
  });
});
