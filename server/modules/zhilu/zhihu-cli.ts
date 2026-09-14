import { execFile } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import {
  HttpException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
export function cliPath(): string {
  return (
    process.env.ZHIHU_CLI_PATH ||
    (process.platform === 'darwin'
      ? join(
          homedir(),
          'Library/Application Support/zhihu-cli/current/zhihu-cli',
        )
      : join(process.cwd(), 'bin', 'zhihu-cli'))
  );
}
export function cliAvailable(): boolean {
  try {
    if (!isAbsolute(cliPath())) return false;
    accessSync(cliPath(), constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
export async function searchWithCli(query: string): Promise<unknown> {
  if (!cliAvailable())
    throw new ServiceUnavailableException('搜索程序暂不可用，请稍后重试。');
  return new Promise((resolve, reject) => {
    execFile(
      cliPath(),
      [
        'search',
        'zhihu',
        '--query',
        query,
        '--count',
        '10',
        '--timeout',
        '12s',
      ],
      {
        timeout: 15000,
        maxBuffer: 2 * 1024 * 1024,
        encoding: 'utf8',
        shell: false,
      },
      (error, stdout, stderr) => {
        // Never expose the child error, arguments, stderr or credential environment.
        let data: { Code?: number; error?: { code?: string } };
        try {
          data = JSON.parse(stdout || stderr);
        } catch {
          reject(new ServiceUnavailableException('搜索未能完成，请稍后重试。'));
          return;
        }
        if (
          data?.Code === 20001 ||
          ['AUTH_REQUIRED', 'AUTH_INVALID', 'ENV_SHADOWS_KEYCHAIN'].includes(
            data?.error?.code || '',
          )
        ) {
          reject(
            new HttpException('知乎搜索授权暂不可用，请联系应用维护者。', 401),
          );
        } else if (data?.Code === 30001 || data?.Code === 30002) {
          reject(
            new HttpException(
              data.Code === 30002
                ? '今天的搜索额度已用完，请明天再试。'
                : '搜索请求较密，请稍后再试。',
              429,
            ),
          );
        } else if (error) {
          reject(new ServiceUnavailableException('搜索未能完成，请稍后重试。'));
        } else {
          new Logger('ZhihuCli').log('search_completed');
          resolve(data);
        }
      },
    );
  });
}
