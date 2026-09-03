// Snowflake INFORMATION_SCHEMA 조회 → DataAsset upsert
// snowflake-sdk는 선택적 의존성 — 런타임에 동적 로드
import { prisma } from '@/lib/prisma'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SnowflakeSDK = any

interface SnowflakeTable {
  TABLE_CATALOG: string
  TABLE_SCHEMA: string
  TABLE_NAME: string
  TABLE_TYPE: string
  COMMENT: string | null
}

function getSDK(): SnowflakeSDK {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('snowflake-sdk')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSnowflakeConnection(): any {
  const snowflake = getSDK()
  return snowflake.createConnection({
    account: process.env.SNOWFLAKE_ACCOUNT!,
    username: process.env.SNOWFLAKE_USER!,
    password: process.env.SNOWFLAKE_PASSWORD!,
    warehouse: process.env.SNOWFLAKE_WAREHOUSE,
    database: process.env.SNOWFLAKE_DATABASE,
    role: process.env.SNOWFLAKE_ROLE ?? 'READONLY',
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function connectAsync(conn: any): Promise<any> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conn.connect((err: any, c: any) => {
      if (err) reject(err)
      else resolve(c)
    })
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function executeAsync<T>(conn: any, sqlText: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      complete: (err: any, _stmt: any, rows: any) => {
        if (err) reject(err)
        else resolve((rows ?? []) as T[])
      },
    })
  })
}

export async function syncSnowflakeCatalog(): Promise<{ upserted: number; syncedAt: string }> {
  const conn = getSnowflakeConnection()
  try {
    await connectAsync(conn)

    const tables = await executeAsync<SnowflakeTable>(
      conn,
      `SELECT TABLE_CATALOG, TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE, COMMENT
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_TYPE IN ('BASE TABLE', 'VIEW')`,
    )

    const now = new Date()
    let upserted = 0

    for (const table of tables) {
      const externalId = `${table.TABLE_CATALOG}.${table.TABLE_SCHEMA}.${table.TABLE_NAME}`
      await prisma.dataAsset.upsert({
        where: { externalId },
        create: {
          name: table.TABLE_NAME,
          description: table.COMMENT ?? table.TABLE_NAME,
          ownerDept: 'DATA_PLATFORM',
          classification: 'RESTRICTED',
          deliveryModes: 'DB',
          sourceSystem: 'SNOWFLAKE',
          externalId,
          snowflakeDb: table.TABLE_CATALOG,
          snowflakeSchema: table.TABLE_SCHEMA,
          syncedAt: now,
        },
        update: {
          name: table.TABLE_NAME,
          description: table.COMMENT ?? table.TABLE_NAME,
          sourceSystem: 'SNOWFLAKE',
          snowflakeDb: table.TABLE_CATALOG,
          snowflakeSchema: table.TABLE_SCHEMA,
          syncedAt: now,
        },
      })
      upserted++
    }

    return { upserted, syncedAt: now.toISOString() }
  } finally {
    conn.destroy(() => {}) // 콜백 필수, 에러 무시
  }
}
