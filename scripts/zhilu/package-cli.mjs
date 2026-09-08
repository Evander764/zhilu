import { readFile, writeFile, mkdir, mkdtemp, rm, chmod } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const release = JSON.parse(await readFile(new URL('./cli-release.json', import.meta.url), 'utf8'));
const arch = { x64: 'amd64', arm64: 'arm64' }[process.arch];
const platform = process.argv[2] || `${process.platform}-${arch}`;
const artifact = release.artifacts[platform];
if (!artifact) throw new Error(`Unsupported CLI deployment platform: ${platform}`);
const url = new URL(artifact.url);
if (url.protocol !== 'https:' || url.hostname !== 'developer-cdn.zhihu.com') throw new Error('Untrusted CLI release host');
const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`CLI download failed: ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
if (bytes.length !== artifact.size || createHash('sha256').update(bytes).digest('hex') !== artifact.sha256) throw new Error('CLI archive integrity mismatch');
const temp = await mkdtemp(join(tmpdir(), 'zhilu-cli-'));
try {
  const archive = join(temp, 'cli.tar.gz');
  await writeFile(archive, bytes);
  const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim();
  if (entries !== 'zhihu-cli') throw new Error('Unexpected CLI archive entries');
  const binary = execFileSync('tar', ['-xOzf', archive, 'zhihu-cli'], { maxBuffer: 32 * 1024 * 1024 });
  const machine = platform === 'linux-amd64' ? 62 : 183;
  if (binary.subarray(0, 4).toString('hex') !== '7f454c46' || binary.readUInt16LE(18) !== machine) throw new Error('CLI binary platform mismatch');
  const destination = join(process.cwd(), 'dist', 'bin');
  await mkdir(destination, { recursive: true });
  const executable = join(destination, 'zhihu-cli');
  await writeFile(executable, binary);
  await chmod(executable, 0o755);
  const native = platform === `${process.platform}-${arch}`;
  if (native) {
    const version = execFileSync(executable, ['--version'], { encoding: 'utf8', timeout: 5000 }).trim();
    if (!version.includes(release.version)) throw new Error('CLI version mismatch');
  }
  await writeFile(join(destination, 'release.json'), JSON.stringify({ version: release.version, platform, archiveSha256: artifact.sha256, binarySha256: createHash('sha256').update(binary).digest('hex'), executableVerified: native }) + '\n');
  console.log(`Packaged official zhihu-cli ${release.version} (${platform}); checksum verified; executable check: ${native ? 'passed' : 'deferred to Linux deployment'}`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
