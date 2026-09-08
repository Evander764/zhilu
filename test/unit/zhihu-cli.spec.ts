import { execFile } from 'node:child_process';
import { accessSync } from 'node:fs';
import { searchWithCli } from '../../server/modules/zhilu/zhihu-cli';
jest.mock('node:child_process', () => ({ execFile: jest.fn() }));
jest.mock('node:fs', () => ({ accessSync: jest.fn(), constants: { X_OK: 1 } }));
const execute = execFile as unknown as jest.Mock;
const access = accessSync as unknown as jest.Mock;
describe('CLI search transport', () => {
  const originalPath = process.env.ZHIHU_CLI_PATH;
  beforeEach(() => {
    process.env.ZHIHU_CLI_PATH = '/test/zhihu-cli';
    jest.clearAllMocks();
    access.mockImplementation(() => undefined);
  });
  afterAll(() => {
    if (originalPath === undefined) delete process.env.ZHIHU_CLI_PATH;
    else process.env.ZHIHU_CLI_PATH = originalPath;
  });
  function reply(error: Error | null, stdout: string) {
    execute.mockImplementation((_path, _args, _options, callback) =>
      callback(error, stdout),
    );
  }
  test('passes query literally to executable, bounds runtime and returns raw result', async () => {
    const query = '学习 $(touch /tmp/never)';
    reply(null, JSON.stringify({ Code: 0, Data: { Items: [] } }));
    await expect(searchWithCli(query)).resolves.toMatchObject({ Code: 0 });
    expect(execute.mock.calls[0][1]).toEqual([
      'search',
      'zhihu',
      '--query',
      query,
      '--count',
      '10',
      '--timeout',
      '12s',
    ]);
    expect(execute.mock.calls[0][2]).toMatchObject({
      shell: false,
      timeout: 15000,
      maxBuffer: 2097152,
    });
  });
  test('does not invoke an absent executable', async () => {
    access.mockImplementation(() => {
      throw new Error('ENOENT');
    });
    await expect(searchWithCli('测试')).rejects.toMatchObject({ status: 503 });
    expect(execute).not.toHaveBeenCalled();
  });
  test.each([30001, 30002])(
    'nonzero CLI exit preserves quota/rate error %s',
    async (Code) => {
      reply(new Error('sensitive command'), JSON.stringify({ Code }));
      await expect(searchWithCli('测试')).rejects.toMatchObject({
        status: 429,
      });
    },
  );
  test('timeout and malformed output become safe errors, never fake empty results', async () => {
    reply(new Error('private credential and command'), 'not-json');
    await expect(searchWithCli('测试')).rejects.toMatchObject({ status: 503 });
    await expect(searchWithCli('测试')).rejects.not.toThrow(
      /private|credential|command|not-json/,
    );
  });
});
