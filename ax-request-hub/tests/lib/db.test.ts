import { db } from '../../src/lib/db'

test('DB 연결 정상', async () => {
  const count = await db.project.count()
  expect(count).toBeGreaterThanOrEqual(0)
})
