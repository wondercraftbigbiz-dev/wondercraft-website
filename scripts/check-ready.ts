// What still stands between this checkout and taking real orders.
//
//   pnpm check:ready
//
// The offline half of GET /api/health. This reads the local environment, so it
// answers "is my machine set up", not "is the deployment set up" — for that, ask
// the deployment, because Vercel bakes variables in at build time and the two
// can disagree.

import { DISPATCH_IS_PLACEHOLDER } from '../lib/data/dispatch.ts'
import { PARCEL_IS_PLACEHOLDER } from '../lib/data/pricing.ts'
import { readinessIssues } from '../lib/payments/readiness.ts'

const issues = readinessIssues()

if (issues.length === 0) {
  console.log('check:ready: this environment can take live orders.')
  process.exit(0)
}

const blocking = issues.filter((i) => i.blocksLiveCharge)

console.log('')
console.log('  Not ready to take real orders:')
console.log('')
for (const issue of issues) {
  console.log(`  ${issue.blocksLiveCharge ? '!!' : '--'} ${issue.key}`)
  console.log(`     ${issue.consequence}`)
  console.log('')
}

if (blocking.length > 0) {
  console.log('  Items marked !! block a live card charge (assertChargeable).')
  console.log('  With sk_test_ keys they are allowed, so testing is unaffected.')
  console.log('')
}

if (PARCEL_IS_PLACEHOLDER || DISPATCH_IS_PLACEHOLDER) {
  console.log('  Owner-supplied values still outstanding:')
  if (PARCEL_IS_PLACEHOLDER) {
    console.log('    - measure a packed box  -> lib/data/pricing.ts')
  }
  if (DISPATCH_IS_PLACEHOLDER) {
    console.log('    - pick a dispatch point -> lib/data/dispatch.ts')
  }
  console.log('')
}

// Not a failure: this script reports, it does not gate. The gate is
// assertChargeable() at request time, which is the only place that can see the
// deployment's real environment.
process.exit(0)
