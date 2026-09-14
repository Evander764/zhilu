import { execFile } from 'node:child_process';
import { searchWithCli } from '../../server/modules/zhilu/zhihu-cli';
jest.mock('node:child_process', () => ({ execFile: jest.fn() }));
jest.mock('node:fs', () => ({ accessSync: jest.fn(), constants: { X_OK: 1 } }));
const execute = execFile as unknown as jest.Mock;
describe('related CLI failure taxonomy at process boundary', () => {
  afterEach(() => jest.clearAllMocks());
  test.each(['AUTH_REQUIRED', 'AUTH_INVALID', 'ENV_SHADOWS_KEYCHAIN'])(
    'maps CLI stderr auth %s without exposing data',
    async (code) => {
      execute.mockImplementation((_path, _args, _options, callback) =>
        callback(
          new Error('sensitive arguments'),
          '',
          JSON.stringify({ ok: false, error: { code, message: 'secret' } }),
        ),
      );
      await expect(searchWithCli('测试问题')).rejects.toMatchObject({
        status: 401,
      });
      await expect(searchWithCli('测试问题')).rejects.not.toThrow(
        /secret|sensitive/,
      );
    },
  );
  test.each([
    [20001, 401],
    [30001, 429],
    [30002, 429],
  ])('nonzero CLI exit preserves business code %s', async (Code, status) => {
    execute.mockImplementation((_path, _args, _options, callback) =>
      callback(new Error('secret'), JSON.stringify({ Code }), ''),
    );
    await expect(searchWithCli('测试问题')).rejects.toMatchObject({ status });
  });
});
