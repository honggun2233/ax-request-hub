import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = join(__dirname, '../prisma/dev.db')

const db = new Database(dbPath)

// 테이블 존재 여부 확인
const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ProjectAppeal'").get()
if (exists) {
  console.log('ProjectAppeal 테이블이 이미 존재합니다.')
  db.close()
  process.exit(0)
}

db.exec(`
CREATE TABLE "ProjectAppeal" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "projectId"      TEXT NOT NULL,
  "requesterEmail" TEXT NOT NULL,
  "reason"         TEXT NOT NULL,
  "evidenceNote"   TEXT NOT NULL DEFAULT '',
  "status"         TEXT NOT NULL DEFAULT 'PENDING',
  "reviewedBy"     TEXT,
  "reviewNote"     TEXT NOT NULL DEFAULT '',
  "resolvedAt"     DATETIME,
  "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectAppeal_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
)
`)

const check = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ProjectAppeal'").get()
console.log(check ? '✓ ProjectAppeal 테이블 생성 완료' : '✗ 생성 실패')
db.close()
