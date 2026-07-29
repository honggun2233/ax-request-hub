// Snowflake INFORMATION_SCHEMA 조회 → DataAsset upsert
import snowflake from 'snowflake-sdk'
import { prisma } from '@/lib/prisma'

interface SnowflakeTable {
  TABLE_CATALOG: string
  TABLE_SCHEMA: string
  TABLE_NAME: string
  TABLE_TYPE: string
  COMMENT: string | null
}

export function getSnowflakeConnection(): snowflake.Connection {
  return snowflake.createConnection({
    account: process.env.SNOWFLAKE_ACCOUNT!,
    username: process.env.SNOWFLAKE_USER!,
    password: process.env.SNOWFLAKE_PASSWORD!,
    warehouse: process.env.SNOWFLAKE_WAREHOUSE,
    database: process.env.SNOWFLAKE_DATABASE,
    role: process.env.SNOWFLAKE_ROLE ?? 'READONLY',
  })
}

function connectAsync(conn: snowflake.Connection): Promise<snowflake.Connection> {
  return new Promise((resolve, reject) => {
    conn.connect((err, c) => {
      if (err) reject(err)
      else resolve(c)
    })
  })
}

function executeAsync<T>(conn: snowflake.Connection, sqlText: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText,
      complete: (err, _stmt, rows) => {
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
          classification: 'G2',
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
