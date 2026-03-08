import { prisma } from "@/lib/db";

export async function withIdempotency<T>(
  idempotencyKey: string,
  scope: string,
  run: () => Promise<T>
): Promise<T> {
  const existing = await prisma.idempotencyKey.findUnique({ where: { key: idempotencyKey } });
  if (existing?.responseJson) {
    return JSON.parse(existing.responseJson) as T;
  }

  const result = await run();

  await prisma.idempotencyKey.upsert({
    where: { key: idempotencyKey },
    update: { responseJson: JSON.stringify(result), scope },
    create: { key: idempotencyKey, scope, responseJson: JSON.stringify(result) }
  });

  return result;
}
