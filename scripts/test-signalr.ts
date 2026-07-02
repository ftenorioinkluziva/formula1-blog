import { config } from 'dotenv'
config({ path: '.env.local' })

import { ensureAuthenticated, getDecodedToken } from '../lib/f1tv/auth'

async function main() {
  console.log('=== F1TV SignalR Connection Test ===\n')

  const token = process.env.F1TV_TOKEN
  if (!token) {
    console.error('F1TV_TOKEN not set in .env.local')
    console.log('\nRun: pnpm f1tv:login')
    process.exit(1)
  }

  console.log('1. Validating token...')
  try {
    await ensureAuthenticated()
    const decoded = getDecodedToken()
    console.log(`   OK: ${decoded?.FirstName} ${decoded?.LastName}`)
    console.log(`   Subscription: ${decoded?.SubscriptionStatus}`)
    console.log(`   Expires: ${decoded ? new Date(decoded.exp * 1000).toISOString() : 'unknown'}`)
  } catch (err) {
    console.error('   FAIL:', err)
    console.log('\nYour token may be expired. Run: pnpm f1tv:login')
    process.exit(1)
  }

  console.log('\n2. Connecting to SignalR hub...')
  try {
    const { startSignalRClient, onFeed, getSessionKey, isConnected, stopSignalRClient } =
      await import('../lib/live-timing/signalr/client')

    const topicsReceived = new Set<string>()
    let messageCount = 0

    onFeed((topic, _data, timestamp) => {
      messageCount++
      if (!topicsReceived.has(topic)) {
        topicsReceived.add(topic)
        console.log(`   [${timestamp.toISOString()}] New topic: ${topic}`)
      }
    })

    await startSignalRClient()
    console.log(`   Connected: ${isConnected()}`)
    console.log(`   Session: ${getSessionKey()}`)

    console.log('\n3. Listening for 10 seconds...')
    await new Promise((resolve) => setTimeout(resolve, 10_000))

    console.log(`\n=== Results ===`)
    console.log(`   Topics received: ${topicsReceived.size}`)
    console.log(`   Total messages: ${messageCount}`)
    console.log(`   Topics: ${[...topicsReceived].sort().join(', ')}`)

    console.log('\n4. Stopping...')
    await stopSignalRClient()
    console.log('   Disconnected')
  } catch (err) {
    console.error('   SignalR error:', err)
    process.exit(1)
  }

  process.exit(0)
}

main()
