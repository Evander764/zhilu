import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export const MIAODA_CALLBACK =
  'https://ucne7375gmu5.feishuapp.com/app/app_17dut1cfq4a/auth/zhihu/callback';
const MAX_AGE_MS = 10 * 60 * 1000;
const stateSchema = z.object({
  subject: z.string().length(64),
  proof: z.string().length(64),
  expiresAt: z.number().int(),
  nonce: z.string().length(32),
});

export function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function signature(value: string, key: string): string {
  return createHmac('sha256', key)
    .update(`zhilu-oauth-v1:${value}`)
    .digest('hex');
}
function equal(a: string, b: string): boolean {
  const left: Buffer = Buffer.from(a);
  const right: Buffer = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function makeTicket(
  userId: string,
  proof: string,
  key: string,
  now = Date.now(),
): string {
  const payload: string = Buffer.from(
    JSON.stringify({
      subject: signature(`user:${userId}`, key),
      proof,
      expiresAt: now + MAX_AGE_MS,
      nonce: randomBytes(16).toString('hex'),
    }),
  ).toString('base64url');
  return `${payload}.${signature(payload, key)}`;
}
export function verifyTicket(
  ticket: string,
  returnedState: string,
  verifier: string,
  userId: string,
  key: string,
  now = Date.now(),
): void {
  if (!returnedState)
    throw new BadRequestException(
      '知乎未返回授权校验信息（state），本次连接未建立。此类回调仅适合临时联调，请联系应用管理员。',
    );
  const fail = (): never => {
    throw new BadRequestException('授权校验未通过，请从本应用重新连接知乎。');
  };
  if (!equal(ticket, returnedState)) fail();
  const parts: string[] = ticket.split('.');
  if (parts.length !== 2 || !equal(parts[1], signature(parts[0], key))) fail();
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch {
    fail();
  }
  const parsed = stateSchema.safeParse(decoded);
  if (!parsed.success) return fail();
  const state = parsed.data;
  if (
    state.expiresAt <= now ||
    state.expiresAt > now + MAX_AGE_MS ||
    !equal(state.subject, signature(`user:${userId}`, key)) ||
    !equal(state.proof, digest(verifier))
  )
    fail();
}
