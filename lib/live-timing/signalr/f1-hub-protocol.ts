import type { IHubProtocol, HubMessage, ILogger } from '@microsoft/signalr'

const RECORD_SEPARATOR = String.fromCharCode(0x1e)


function extractJsonObjects(input: string): string[] {
  const segments: string[] = []
  let depth = 0
  let inString = false
  let escaping = false
  let objectStart = -1

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]

    if (escaping) {
      escaping = false
      continue
    }

    if (char === '\\') {
      if (inString) {
        escaping = true
      }
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) {
      continue
    }

    if (char === '{') {
      if (depth === 0) {
        objectStart = index
      }
      depth += 1
      continue
    }

    if (char === '}') {
      if (depth === 0) {
        continue
      }

      depth -= 1
      if (depth === 0 && objectStart >= 0) {
        const segment = input.slice(objectStart, index + 1).trim()
        if (segment) {
          segments.push(segment)
        }
        objectStart = -1
      }
    }
  }

  if (segments.length > 0) {
    return segments
  }

  const fallbackSegments = input
    .split('\n')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)

  return fallbackSegments.length > 0 ? fallbackSegments : [input.trim()]
}

/**
 * Custom SignalR hub protocol for the F1 Live Timing server.
 *
 * The F1 server concatenates multiple JSON hub messages within a single
 * TextMessageFormat record, separated by '\n' instead of '\x1e'.
 * Standard @microsoft/signalr JsonHubProtocol calls JSON.parse on the
 * whole record and throws "Unexpected non-whitespace character" when it
 * sees the second object.  This protocol splits each record by '\n'
 * first, then delegates each individual object to the JSON parser.
 */
export class F1JsonHubProtocol implements IHubProtocol {
  readonly name = 'json'
  readonly version = 2
  readonly transferFormat = 1 // TransferFormat.Text

  parseMessages(input: string, logger: ILogger): HubMessage[] {
    if (typeof input !== 'string') {
      throw new Error('Invalid input for JSON hub protocol. Expected a string.')
    }
    if (!input) return []

    const records = input.endsWith(RECORD_SEPARATOR)
      ? input.slice(0, -1).split(RECORD_SEPARATOR)
      : input.split(RECORD_SEPARATOR)

    const hubMessages: HubMessage[] = []

    for (const record of records) {
      if (!record.trim()) continue

      for (const segment of extractJsonObjects(record)) {
        let parsed: HubMessage & { type?: number }
        try {
          parsed = JSON.parse(segment) as HubMessage & { type?: number }
        } catch (err) {
          logger.log(2 /* LogLevel.Warning */, `[f1-hub-protocol] Failed to parse segment: ${err}`)
          continue
        }

        if (typeof parsed.type !== 'number') {
          logger.log(2, '[f1-hub-protocol] Skipping segment without numeric type')
          continue
        }

        hubMessages.push(parsed)
      }
    }

    return hubMessages
  }

  writeMessage(message: HubMessage): string {
    return JSON.stringify(message) + RECORD_SEPARATOR
  }
}
