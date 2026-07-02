const season = Number(process.argv[2] || 2026)
const rounds = (process.argv.slice(3).join(',') || '4,5')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isInteger(value) && value > 0)

async function main() {
  const { Client } = await import('pg')
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  try {
    const weekendRes = await client.query(
      'select id from race_weekends where season = $1 and round = any($2::int[])',
      [season, rounds],
    )
    const weekendIds = weekendRes.rows.map((row) => row.id)

    if (weekendIds.length === 0) {
      throw new Error(`No weekends found for season ${season} rounds ${rounds.join(',')}`)
    }

    const sessionRes = await client.query(
      'select id from race_sessions where weekend_id = any($1::int[])',
      [weekendIds],
    )
    const sessionIds = sessionRes.rows.map((row) => row.id)

    const query = (sql, params = []) => client.query(sql, params)

    if (sessionIds.length > 0) {
      await query('delete from race_control_messages where session_id = any($1::int[])', [sessionIds])
      await query('delete from session_status_events where session_id = any($1::int[])', [sessionIds])
      await query('delete from session_results where session_id = any($1::int[])', [sessionIds])
      await query('delete from lap_summaries where session_id = any($1::int[])', [sessionIds])
      await query('delete from pit_stops where session_id = any($1::int[])', [sessionIds])
      await query('delete from tire_stints where session_id = any($1::int[])', [sessionIds])
      await query('delete from session_weather where session_id = any($1::int[])', [sessionIds])
      await query('delete from race_intervals where session_id = any($1::int[])', [sessionIds])
      await query('delete from team_radio where session_id = any($1::int[])', [sessionIds])
      await query('delete from car_telemetry where session_id = any($1::int[])', [sessionIds])
      await query('delete from f1tv_sync_points where session_id = any($1::int[])', [sessionIds])
    }

    await query('delete from fantasy_predictions where weekend_id = any($1::int[])', [weekendIds])
    await query('delete from fantasy_round_scores where weekend_id = any($1::int[])', [weekendIds])
    await query('delete from fantasy_transfers where weekend_id = any($1::int[])', [weekendIds])
    await query('delete from fantasy_round_entries where weekend_id = any($1::int[])', [weekendIds])
    await query("update race_sessions set status = 'cancelled' where weekend_id = any($1::int[])", [weekendIds])

    console.log(JSON.stringify({ season, rounds, weekendIds, sessionIds, cleaned: true }, null, 2))
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
