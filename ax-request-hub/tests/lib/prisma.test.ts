import { prisma } from '../../lib/prisma'

test('DB 연결 정상', async () => {
  const count = await prisma.project.count()
  expect(count).toBeGreaterThanOrEqual(0)
})
