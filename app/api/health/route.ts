import { NextResponse } from 'next/server'
import { isLiveKeys } from '@/lib/payments/config'
import { readinessIssues } from '@/lib/payments/readiness'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Whether this deployment can actually take an order.
 *
 * Exists because the only previous way to find out was to open the modal, fill
 * in a destination, and see which generic message appeared — and because Vercel
 * bakes environment variables into a deployment at build time, so "I set it in
 * the dashboard" and "the running site has it" are different facts.
 *
 * Returns names and consequences, never values. Every name here already appears
 * in .env.example in a public repository, so nothing is disclosed that a reader
 * of the source does not already have. Deliberately no request body is read and
 * nothing is mutated.
 */
export async function GET() {
  const issues = readinessIssues()
  const ready = issues.length === 0
  const blocking = issues.filter((i) => i.blocksLiveCharge)

  return NextResponse.json(
    {
      ready,
      mode: isLiveKeys() ? 'live' : 'test',
      // With test keys these are warnings; with live keys assertChargeable()
      // turns each one into a refusal.
      wouldBlockLiveCharge: blocking.length > 0,
      issues,
      checkedAt: new Date().toISOString(),
    },
    {
      status: ready ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}
