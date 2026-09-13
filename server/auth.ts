import { createHmac, timingSafeEqual } from 'node:crypto';
export function equal(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function session(secret: string) {
  const expires = String(Date.now() + 12 * 60 * 60 * 1000);
  return `${expires}.${createHmac('sha256', secret).update(expires).digest('hex')}`;
}
export function validSession(value: string | undefined, secret: string) {
  if (!value) return false;
  const [expires, signature] = value.split('.');
  return (
    !!expires &&
    !!signature &&
    Number(expires) > Date.now() &&
    equal(signature, createHmac('sha256', secret).update(expires).digest('hex'))
  );
}
export function csvCell(value: unknown) {
  let text = value == null ? '' : String(value);
  if (/^[\s]*[=+@\-\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
