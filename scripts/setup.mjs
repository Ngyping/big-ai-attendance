/**
 * Automated Supabase setup script.
 * Handles:
 *  1. Storage bucket creation (leave-attachments)
 *  2. Auth user creation (5 employees)
 *  3. Prints the UPDATE SQL to link auth_user_id
 *
 * Run AFTER executing the SQL migrations in Supabase SQL Editor.
 * Usage: node scripts/setup.mjs
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = join(__dir, '..')

// Load env from .env.local
function loadEnv() {
  const raw = readFileSync(join(root, '.env.local'), 'utf8')
  const env = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    env[key] = val
  }
  return env
}

const env = loadEnv()
const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY  = env['SUPABASE_SERVICE_ROLE_KEY']

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const headers = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

// ──────────────────────────────────────────────
// Step 1: Create Storage Bucket
// ──────────────────────────────────────────────
async function createStorageBucket() {
  console.log('\n[1/2] Creating storage bucket "leave-attachments"...')

  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: 'leave-attachments',
      name: 'leave-attachments',
      public: true,
      file_size_limit: 5242880, // 5 MB
      allowed_mime_types: ['image/jpeg', 'image/png', 'application/pdf'],
    }),
  })

  const data = await res.json()

  if (res.ok) {
    console.log('  ✓ Bucket created successfully')
  } else if (data?.error === 'Duplicate' || data?.message?.includes('already exists')) {
    console.log('  ✓ Bucket already exists — skipping')
  } else {
    console.error('  ✗ Failed to create bucket:', JSON.stringify(data))
  }
}

// ──────────────────────────────────────────────
// Step 2: Create Auth Users
// ──────────────────────────────────────────────
const USERS = [
  { email: 'tanweiming@bigai.com.my',  password: 'Test@123', name: 'Tan Wei Ming',     code: 'EMP001' },
  { email: 'siti@bigai.com.my',        password: 'Test@123', name: 'Siti Nurhaliza',   code: 'EMP002' },
  { email: 'rajesh@bigai.com.my',      password: 'Test@123', name: 'Rajesh Kumar',     code: 'EMP003' },
  { email: 'limmeiling@bigai.com.my',  password: 'Test@123', name: 'Lim Mei Ling',     code: 'EMP004' },
  { email: 'ahmad@bigai.com.my',       password: 'Test@123', name: 'Ahmad bin Ismail', code: 'EMP005' },
]

async function createAuthUsers() {
  console.log('\n[2/2] Creating auth users...')

  const results = []

  for (const user of USERS) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { full_name: user.name },
      }),
    })

    const data = await res.json()

    if (res.ok && data.id) {
      console.log(`  ✓ ${user.code} ${user.name} — ${data.id}`)
      results.push({ ...user, uuid: data.id })
    } else if (data?.msg?.includes('already been registered') || data?.error_description?.includes('already')) {
      // User exists — fetch their ID
      const listRes = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(user.email)}`,
        { headers }
      )
      const listData = await listRes.json()
      const existing = listData?.users?.find(u => u.email === user.email)
      if (existing) {
        console.log(`  ✓ ${user.code} ${user.name} — ${existing.id} (already existed)`)
        results.push({ ...user, uuid: existing.id })
      } else {
        console.log(`  ✓ ${user.code} ${user.name} — already exists (could not fetch ID)`)
        results.push({ ...user, uuid: null })
      }
    } else {
      console.error(`  ✗ ${user.code} ${user.name} — failed:`, JSON.stringify(data))
      results.push({ ...user, uuid: null })
    }
  }

  return results
}

// ──────────────────────────────────────────────
// Print linking SQL
// ──────────────────────────────────────────────
function printLinkSQL(users) {
  console.log('\n─────────────────────────────────────────────────────────')
  console.log('NEXT STEP: Run this SQL in Supabase SQL Editor to link users')
  console.log('─────────────────────────────────────────────────────────')
  for (const u of users) {
    if (u.uuid) {
      console.log(`UPDATE employees SET auth_user_id = '${u.uuid}' WHERE employee_code = '${u.code}';`)
    } else {
      console.log(`-- ${u.code}: UUID not available, link manually`)
    }
  }
  console.log('─────────────────────────────────────────────────────────\n')
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────
async function main() {
  console.log('=== Supabase Setup Script ===')
  console.log(`Project: ${SUPABASE_URL}`)

  await createStorageBucket()
  const users = await createAuthUsers()
  printLinkSQL(users)

  console.log('Done! Remember to:')
  console.log('  1. Run the UPDATE SQL above in Supabase SQL Editor')
  console.log('  2. Run: npm run dev')
}

main().catch(err => { console.error(err); process.exit(1) })
