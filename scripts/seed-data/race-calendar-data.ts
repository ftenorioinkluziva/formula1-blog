export type SessionDay =
  | "Sunday"
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"

export interface CalendarSession {
  session: string
  day: SessionDay
  time: string
}

export interface CalendarRace {
  round: number
  name: string
  circuit: string
  location: string
  date: string
  time: string
  sessions: CalendarSession[]
}

export const RACE_CALENDAR_SEASON = 2026

const monthMap: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
}

export function parseRaceStartUtc(dateLabel: string, timeLabel: string, season: number = RACE_CALENDAR_SEASON): Date {
  const [monthLabel, dayLabel] = dateLabel.split(" ")
  const [timePart] = timeLabel.split(" ")
  const [hourLabel, minuteLabel] = timePart.split(":")

  return new Date(
    Date.UTC(
      season,
      monthMap[monthLabel],
      Number(dayLabel),
      Number(hourLabel),
      Number(minuteLabel),
      0,
      0,
    ),
  )
}

export const raceCalendar: CalendarRace[] = [
  {
    round: 1,
    name: "Australian Grand Prix",
    circuit: "Albert Park Circuit",
    location: "Melbourne, Australia",
    date: "Mar 8",
    time: "04:00 GMT",
    sessions: [
      { session: "Practice 1", day: "Friday", time: "01:30 GMT" },
      { session: "Practice 2", day: "Friday", time: "05:00 GMT" },
      { session: "Practice 3", day: "Saturday", time: "01:30 GMT" },
      { session: "Qualifying", day: "Saturday", time: "05:00 GMT" },
      { session: "Race", day: "Sunday", time: "04:00 GMT" },
    ],
  },
  {
    round: 2,
    name: "Chinese Grand Prix",
    circuit: "Shanghai International Circuit",
    location: "Shanghai, China",
    date: "Mar 15",
    time: "07:00 GMT",
    sessions: [
      { session: "Practice 1", day: "Friday", time: "03:30 GMT" },
      { session: "Sprint Qualifying", day: "Friday", time: "07:30 GMT" },
      { session: "Sprint", day: "Saturday", time: "03:00 GMT" },
      { session: "Qualifying", day: "Saturday", time: "07:00 GMT" },
      { session: "Race", day: "Sunday", time: "07:00 GMT" },
    ],
  },
  {
    round: 3,
    name: "Japanese Grand Prix",
    circuit: "Suzuka International Racing Course",
    location: "Suzuka, Japan",
    date: "Mar 29",
    time: "05:00 GMT",
    sessions: [
      { session: "Practice 1", day: "Friday", time: "02:30 GMT" },
      { session: "Practice 2", day: "Friday", time: "06:00 GMT" },
      { session: "Practice 3", day: "Saturday", time: "02:30 GMT" },
      { session: "Qualifying", day: "Saturday", time: "06:00 GMT" },
      { session: "Race", day: "Sunday", time: "05:00 GMT" },
    ],
  },
  {
    round: 4,
    name: "Bahrain Grand Prix",
    circuit: "Bahrain International Circuit",
    location: "Sakhir, Bahrain",
    date: "Apr 12",
    time: "15:00 GMT",
    sessions: [
      { session: "Practice 1", day: "Friday", time: "11:30 GMT" },
      { session: "Practice 2", day: "Friday", time: "15:00 GMT" },
      { session: "Practice 3", day: "Saturday", time: "12:30 GMT" },
      { session: "Qualifying", day: "Saturday", time: "16:00 GMT" },
      { session: "Race", day: "Sunday", time: "15:00 GMT" },
    ],
  },
  {
    round: 5,
    name: "Saudi Arabian Grand Prix",
    circuit: "Jeddah Corniche Circuit",
    location: "Jeddah, Saudi Arabia",
    date: "Apr 19",
    time: "17:00 GMT",
    sessions: [
      { session: "Practice 1", day: "Friday", time: "13:30 GMT" },
      { session: "Practice 2", day: "Friday", time: "17:00 GMT" },
      { session: "Practice 3", day: "Saturday", time: "13:30 GMT" },
      { session: "Qualifying", day: "Saturday", time: "17:00 GMT" },
      { session: "Race", day: "Sunday", time: "17:00 GMT" },
    ],
  },
  {
    round: 6,
    name: "Miami Grand Prix",
    circuit: "Miami International Autodrome",
    location: "Miami Gardens, USA",
    date: "May 3",
    time: "20:00 GMT",
    sessions: [
      { session: "Practice 1", day: "Friday", time: "16:30 GMT" },
      { session: "Sprint Qualifying", day: "Friday", time: "20:30 GMT" },
      { session: "Sprint", day: "Saturday", time: "16:00 GMT" },
      { session: "Qualifying", day: "Saturday", time: "20:00 GMT" },
      { session: "Race", day: "Sunday", time: "20:00 GMT" },
    ],
  },
  {
    round: 7,
    name: "Canadian Grand Prix",
    circuit: "Circuit Gilles Villeneuve",
    location: "Montréal, Canada",
    date: "May 24",
    time: "20:00 GMT",
    sessions: [
      { session: "Practice 1", day: "Friday", time: "16:30 GMT" },
      { session: "Sprint Qualifying", day: "Friday", time: "20:30 GMT" },
      { session: "Sprint", day: "Saturday", time: "16:00 GMT" },
      { session: "Qualifying", day: "Saturday", time: "20:00 GMT" },
      { session: "Race", day: "Sunday", time: "20:00 GMT" },
    ],
  },
  {
    round: 8,
    name: "Monaco Grand Prix",
    circuit: "Circuit de Monaco",
    location: "Monte Carlo, Monaco",
    date: "Jun 7",
    time: "13:00 GMT",
    sessions: [
      { session: "Practice 1", day: "Friday", time: "11:30 GMT" },
      { session: "Practice 2", day: "Friday", time: "15:00 GMT" },
      { session: "Practice 3", day: "Saturday", time: "10:30 GMT" },
      { session: "Qualifying", day: "Saturday", time: "14:00 GMT" },
      { session: "Race", day: "Sunday", time: "13:00 GMT" },
    ],
  },
  {
    round: 9,
    name: "Barcelona-Catalunya Grand Prix",
    circuit: "Circuit de Barcelona-Catalunya",
    location: "Barcelona, Spain",
    date: "Jun 14",
    time: "13:00 GMT",
    sessions: [
      { session: "Practice 1", day: "Friday", time: "11:30 GMT" },
      { session: "Practice 2", day: "Friday", time: "15:00 GMT" },
      { session: "Practice 3", day: "Saturday", time: "10:30 GMT" },
      { session: "Qualifying", day: "Saturday", time: "14:00 GMT" },
      { session: "Race", day: "Sunday", time: "13:00 GMT" },
    ],
  },
  {
    round: 10,
    name: "Austrian Grand Prix",
    circuit: "Red Bull Ring",
    location: "Spielberg, Austria",
    date: "Jun 28",
    time: "13:00 GMT",
    sessions: [
      { session: "Practice 1", day: "Friday", time: "11:30 GMT" },
      { session: "Practice 2", day: "Friday", time: "15:00 GMT" },
      { session: "Practice 3", day: "Saturday", time: "10:30 GMT" },
      { session: "Qualifying", day: "Saturday", time: "14:00 GMT" },
      { session: "Race", day: "Sunday", time: "13:00 GMT" },
    ],
  },
  {
    round: 11,
    name: "British Grand Prix",
    circuit: "Silverstone Circuit",
    location: "Silverstone, Great Britain",
    date: "Jul 5",
    time: "14:00 GMT",
    sessions: [
      { session: "Practice 1", day: "Friday", time: "11:30 GMT" },
      { session: "Sprint Qualifying", day: "Friday", time: "15:30 GMT" },
      { session: "Sprint", day: "Saturday", time: "11:00 GMT" },
      { session: "Qualifying", day: "Saturday", time: "15:00 GMT" },
      { session: "Race", day: "Sunday", time: "14:00 GMT" },
    ],
  },
  {
    round: 12,
    name: "Belgian Grand Prix",
    circuit: "Circuit de Spa-Francorchamps",
    location: "Spa-Francorchamps, Belgium",
    date: "Jul 19",
    time: "13:00 GMT",
    sessions: [
      { session: "Practice 1", day: "Friday", time: "11:30 GMT" },
      { session: "Practice 2", day: "Friday", time: "15:00 GMT" },
      { session: "Practice 3", day: "Saturday", time: "10:30 GMT" },
      { session: "Qualifying", day: "Saturday", time: "14:00 GMT" },
      { session: "Race", day: "Sunday", time: "13:00 GMT" },
    ],
  },
  {
    round: 13,
    name: "Hungarian Grand Prix",
    circuit: "Hungaroring",
    location: "Budapest, Hungary",
    date: "Jul 26",
    time: "13:00 GMT",
    sessions: [
      { session: "Practice 1", day: "Friday", time: "11:30 GMT" },
      { session: "Practice 2", day: "Friday", time: "15:00 GMT" },
      { session: "Practice 3", day: "Saturday", time: "10:30 GMT" },
      { session: "Qualifying", day: "Saturday", time: "14:00 GMT" },
      { session: "Race", day: "Sunday", time: "13:00 GMT" },
    ],
  },
  {
    round: 14,
    name: "Dutch Grand Prix",
    circuit: "Circuit Zandvoort",
    location: "Zandvoort, Netherlands",
    date: "Aug 23",
    time: "13:00 GMT",
    sessions: [
      { session: "Practice 1", day: "Friday", time: "10:30 GMT" },
      { session: "Sprint Qualifying", day: "Friday", time: "14:30 GMT" },
      { session: "Sprint", day: "Saturday", time: "10:00 GMT" },
      { session: "Qualifying", day: "Saturday", time: "14:00 GMT" },
      { session: "Race", day: "Sunday", time: "13:00 GMT" },
    ],
  },
  {
    round: 15,
    name: "Italian Grand Prix",
    circuit: "Autodromo Nazionale Monza",
    location: "Monza, Italy",
    date: "Sep 6",
    time: "13:00 GMT",
    sessions: [
      { session: "Practice 1", day: "Friday", time: "10:30 GMT" },
      { session: "Practice 2", day: "Friday", time: "14:00 GMT" },
      { session: "Practice 3", day: "Saturday", time: "10:30 GMT" },
      { session: "Qualifying", day: "Saturday", time: "14:00 GMT" },
      { session: "Race", day: "Sunday", time: "13:00 GMT" },
    ],
  },
  {
    round: 16,
    name: "Spanish Grand Prix",
    circuit: "Circuito de Madrid Jarama",
    location: "Madrid, Spain",
    date: "Sep 13",
    time: "13:00 GMT",
    sessions: [
      { session: "Practice 1", day: "Friday", time: "11:30 GMT" },
      { session: "Practice 2", day: "Friday", time: "15:00 GMT" },
      { session: "Practice 3", day: "Saturday", time: "10:30 GMT" },
      { session: "Qualifying", day: "Saturday", time: "14:00 GMT" },
      { session: "Race", day: "Sunday", time: "13:00 GMT" },
    ],
  },
  {
    round: 17,
    name: "Azerbaijan Grand Prix",
    circuit: "Baku City Circuit",
    location: "Baku, Azerbaijan",
    date: "Sep 26",
    time: "11:00 GMT",
    sessions: [
      { session: "Practice 1", day: "Thursday", time: "08:30 GMT" },
      { session: "Practice 2", day: "Thursday", time: "12:00 GMT" },
      { session: "Practice 3", day: "Friday", time: "08:30 GMT" },
      { session: "Qualifying", day: "Friday", time: "12:00 GMT" },
      { session: "Race", day: "Saturday", time: "11:00 GMT" },
    ],
  },
  {
    round: 18,
    name: "Singapore Grand Prix",
    circuit: "Marina Bay Street Circuit",
    location: "Marina Bay, Singapore",
    date: "Oct 11",
    time: "12:00 GMT",
    sessions: [
      { session: "Practice 1", day: "Friday", time: "08:30 GMT" },
      { session: "Sprint Qualifying", day: "Friday", time: "12:30 GMT" },
      { session: "Sprint", day: "Saturday", time: "09:00 GMT" },
      { session: "Qualifying", day: "Saturday", time: "13:00 GMT" },
      { session: "Race", day: "Sunday", time: "12:00 GMT" },
    ],
  },
  {
    round: 19,
    name: "United States Grand Prix",
    circuit: "Circuit of the Americas",
    location: "Austin, USA",
    date: "Oct 25",
    time: "20:00 GMT",
    sessions: [
      { session: "Practice 1", day: "Friday", time: "17:30 GMT" },
      { session: "Practice 2", day: "Friday", time: "21:00 GMT" },
      { session: "Practice 3", day: "Saturday", time: "17:30 GMT" },
      { session: "Qualifying", day: "Saturday", time: "21:00 GMT" },
      { session: "Race", day: "Sunday", time: "20:00 GMT" },
    ],
  },
  {
    round: 20,
    name: "Mexico City Grand Prix",
    circuit: "Autodromo Hermanos Rodriguez",
    location: "Mexico City, Mexico",
    date: "Nov 1",
    time: "20:00 GMT",
    sessions: [
      { session: "Practice 1", day: "Friday", time: "18:30 GMT" },
      { session: "Practice 2", day: "Friday", time: "22:00 GMT" },
      { session: "Practice 3", day: "Saturday", time: "17:30 GMT" },
      { session: "Qualifying", day: "Saturday", time: "21:00 GMT" },
      { session: "Race", day: "Sunday", time: "20:00 GMT" },
    ],
  },
  {
    round: 21,
    name: "São Paulo Grand Prix",
    circuit: "Autodromo Jose Carlos Pace",
    location: "São Paulo, Brazil",
    date: "Nov 8",
    time: "17:00 GMT",
    sessions: [
      { session: "Practice 1", day: "Friday", time: "15:30 GMT" },
      { session: "Practice 2", day: "Friday", time: "19:00 GMT" },
      { session: "Practice 3", day: "Saturday", time: "14:30 GMT" },
      { session: "Qualifying", day: "Saturday", time: "18:00 GMT" },
      { session: "Race", day: "Sunday", time: "17:00 GMT" },
    ],
  },
  {
    round: 22,
    name: "Las Vegas Grand Prix",
    circuit: "Las Vegas Street Circuit",
    location: "Las Vegas, USA",
    date: "Nov 22",
    time: "04:00 GMT",
    sessions: [
      { session: "Practice 1", day: "Friday", time: "00:30 GMT" },
      { session: "Practice 2", day: "Friday", time: "04:00 GMT" },
      { session: "Practice 3", day: "Saturday", time: "00:30 GMT" },
      { session: "Qualifying", day: "Saturday", time: "04:00 GMT" },
      { session: "Race", day: "Sunday", time: "04:00 GMT" },
    ],
  },
  {
    round: 23,
    name: "Qatar Grand Prix",
    circuit: "Lusail International Circuit",
    location: "Lusail, Qatar",
    date: "Nov 29",
    time: "16:00 GMT",
    sessions: [
      { session: "Practice 1", day: "Friday", time: "13:30 GMT" },
      { session: "Practice 2", day: "Friday", time: "17:00 GMT" },
      { session: "Practice 3", day: "Saturday", time: "14:30 GMT" },
      { session: "Qualifying", day: "Saturday", time: "18:00 GMT" },
      { session: "Race", day: "Sunday", time: "16:00 GMT" },
    ],
  },
  {
    round: 24,
    name: "Abu Dhabi Grand Prix",
    circuit: "Yas Marina Circuit",
    location: "Yas Marina, Abu Dhabi",
    date: "Dec 6",
    time: "13:00 GMT",
    sessions: [
      { session: "Practice 1", day: "Friday", time: "09:30 GMT" },
      { session: "Practice 2", day: "Friday", time: "13:00 GMT" },
      { session: "Practice 3", day: "Saturday", time: "10:30 GMT" },
      { session: "Qualifying", day: "Saturday", time: "14:00 GMT" },
      { session: "Race", day: "Sunday", time: "13:00 GMT" },
    ],
  },
]
