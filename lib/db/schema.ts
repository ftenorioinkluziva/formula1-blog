import { boolean, index, integer, jsonb, pgTable, real, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const circuits = pgTable(
  "circuits",
  {
    id: serial("id").primaryKey(),
    circuitId: text("circuit_id").notNull().unique(),
    name: text("name").notNull(),
    locality: text("locality"),
    country: text("country"),
    lat: real("lat"),
    lng: real("lng"),
    wikiUrl: text("wiki_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
)

export const raceWeekends = pgTable(
  "race_weekends",
  {
    id: serial("id").primaryKey(),
    season: integer("season").notNull(),
    round: integer("round").notNull(),
    grandPrixName: text("grand_prix_name").notNull(),
    circuit: text("circuit").notNull(),
    country: text("country").notNull(),
    location: text("location").notNull(),
    circuitRef: text("circuit_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (table) => ({
    seasonRoundUniqueIdx: uniqueIndex("race_weekends_season_round_unique_idx").on(table.season, table.round),
  }),
)

export const raceSessions = pgTable(
  "race_sessions",
  {
    id: serial("id").primaryKey(),
    weekendId: integer("weekend_id")
      .notNull()
      .references(() => raceWeekends.id, { onDelete: "cascade" }),
    sessionType: text("session_type").notNull(),
    sessionCode: text("session_code").notNull(),
    part: integer("part"),
    status: text("status").notNull().default("scheduled"),
    source: text("source").notNull().default("seed"),
    isSprintWeekend: boolean("is_sprint_weekend").notNull().default(false),
    startTimeUtc: timestamp("start_time_utc", { withTimezone: true }).notNull(),
    endTimeUtc: timestamp("end_time_utc", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (table) => ({
    statusStartIdx: index("race_sessions_status_start_idx").on(table.status, table.startTimeUtc),
    weekendSessionCodeUniqueIdx: uniqueIndex("race_sessions_weekend_session_code_unique_idx").on(
      table.weekendId,
      table.sessionCode,
    ),
    weekendStartIdx: index("race_sessions_weekend_start_idx").on(table.weekendId, table.startTimeUtc),
    weekendIdx: index("race_sessions_weekend_idx").on(table.weekendId),
  }),
)

export const sessionStatusEvents = pgTable(
  "session_status_events",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => raceSessions.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    statusReason: text("status_reason"),
    occurredAtUtc: timestamp("occurred_at_utc", { withTimezone: true }).notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionOccurredIdx: index("session_status_events_session_occurred_idx").on(table.sessionId, table.occurredAtUtc),
    dedupeIdx: uniqueIndex("session_status_events_dedupe_idx").on(table.sessionId, table.status, table.occurredAtUtc),
  }),
)

export const raceControlMessages = pgTable(
  "race_control_messages",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => raceSessions.id, { onDelete: "cascade" }),
    messageType: text("message_type").notNull().default("Other"),
    flag: text("flag").notNull().default(""),
    lap: integer("lap").notNull().default(-1),
    messageText: text("message_text").notNull(),
    racingNumber: text("racing_number").notNull().default(""),
    occurredAtUtc: timestamp("occurred_at_utc", { withTimezone: true }).notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionOccurredIdx: index("race_control_messages_session_occurred_idx").on(table.sessionId, table.occurredAtUtc),
    dedupeIdx: uniqueIndex("race_control_messages_dedupe_idx").on(
      table.sessionId,
      table.occurredAtUtc,
      table.messageType,
      table.flag,
      table.lap,
      table.messageText,
      table.racingNumber,
    ),
  }),
)

export const lapSummaries = pgTable(
  "lap_summaries",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => raceSessions.id, { onDelete: "cascade" }),
    driverId: integer("driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "cascade" }),
    lapNumber: integer("lap_number").notNull(),
    lapTime: text("lap_time"),
    sector1: text("sector_1"),
    sector2: text("sector_2"),
    sector3: text("sector_3"),
    pitIn: boolean("pit_in").notNull().default(false),
    pitOut: boolean("pit_out").notNull().default(false),
    i1Speed: integer("i1_speed"),
    i2Speed: integer("i2_speed"),
    stSpeed: integer("st_speed"),
    compound: text("compound"),
    occurredAtUtc: timestamp("occurred_at_utc", { withTimezone: true }).notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionDriverLapUniqueIdx: uniqueIndex("lap_summaries_session_driver_lap_unique_idx").on(
      table.sessionId,
      table.driverId,
      table.lapNumber,
    ),
    sessionDriverLapIdx: index("lap_summaries_session_driver_lap_idx").on(table.sessionId, table.driverId, table.lapNumber),
    sessionOccurredIdx: index("lap_summaries_session_occurred_idx").on(table.sessionId, table.occurredAtUtc),
  }),
)

export const pitStops = pgTable(
  "pit_stops",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => raceSessions.id, { onDelete: "cascade" }),
    driverId: integer("driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "cascade" }),
    lap: integer("lap").notNull(),
    stopNumber: integer("stop_number").notNull(),
    duration: text("duration"),
    timeOfDay: text("time_of_day"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionDriverStopUniqueIdx: uniqueIndex("pit_stops_session_driver_stop_unique_idx").on(
      table.sessionId,
      table.driverId,
      table.stopNumber,
    ),
    sessionIdx: index("pit_stops_session_idx").on(table.sessionId),
  }),
)

export const drivers = pgTable(
  "drivers",
  {
    id: serial("id").primaryKey(),
    driverNumber: integer("driver_number").notNull(),
    shortName: text("short_name").notNull(),
    code: text("code").notNull(),
    fullName: text("full_name").notNull(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    nationality: text("nationality").notNull(),
    flag: text("flag").notNull(),
    country: text("country").notNull(),
    points: integer("points").notNull().default(0),
    position: integer("position").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    podiums: integer("podiums").notNull().default(0),
    poles: integer("poles").notNull().default(0),
    championships: integer("championships").notNull().default(0),
    dob: text("dob").notNull(),
    pob: text("pob").notNull(),
    gpEntered: integer("gp_entered").notNull().default(0),
    careerPoints: text("career_points").notNull().default("0"),
    bestFinish: text("best_finish").notNull().default("—"),
    bestGrid: text("best_grid").notNull().default("—"),
    dnfs: integer("dnfs").notNull().default(0),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (table) => ({
    codeUniqueIdx: uniqueIndex("drivers_code_unique_idx").on(table.code),
    numberUniqueIdx: uniqueIndex("drivers_number_unique_idx").on(table.driverNumber),
    shortNameUniqueIdx: uniqueIndex("drivers_short_name_unique_idx").on(table.shortName),
    teamIdx: index("drivers_team_idx").on(table.teamId),
  }),
)

export const sessionResults = pgTable(
  "session_results",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => raceSessions.id, { onDelete: "cascade" }),
    driverId: integer("driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    bestLapTime: text("best_lap_time"),
    gapToLeader: text("gap_to_leader"),
    points: integer("points").notNull().default(0),
    status: text("status").notNull().default("finished"),
    q1Time: text("q1_time"),
    q2Time: text("q2_time"),
    q3Time: text("q3_time"),
    gridPosition: integer("grid_position"),
    lapsCompleted: integer("laps_completed"),
    fastestLapRank: integer("fastest_lap_rank"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (table) => ({
    sessionDriverUniqueIdx: uniqueIndex("session_results_session_driver_unique_idx").on(table.sessionId, table.driverId),
    sessionPositionUniqueIdx: uniqueIndex("session_results_session_position_unique_idx").on(table.sessionId, table.position),
    sessionPositionIdx: index("session_results_session_position_idx").on(table.sessionId, table.position),
  }),
)

export const teams = pgTable(
  "teams",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    color: text("color").notNull(),
    points: integer("points").notNull().default(0),
    position: integer("position").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    podiums: integer("podiums").notNull().default(0),
    base: text("base").notNull(),
    fullName: text("full_name").notNull(),
    teamChief: text("team_chief").notNull(),
    technicalChief: text("technical_chief").notNull(),
    chassis: text("chassis").notNull(),
    powerUnit: text("power_unit").notNull(),
    firstEntry: text("first_entry").notNull(),
    championships: integer("championships").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (table) => ({
    nameUniqueIdx: uniqueIndex("teams_name_unique_idx").on(table.name),
    positionIdx: index("teams_position_idx").on(table.position),
  }),
)

export const mediaGalleries = pgTable(
  "media_galleries",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    imageCount: integer("image_count").notNull(),
    category: text("category").notNull(),
    coverImageUrl: text("cover_image_url"),
    folderKey: text("folder_key"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (table) => ({
    sortOrderIdx: index("media_galleries_sort_order_idx").on(table.sortOrder),
    folderKeyUniqueIdx: uniqueIndex("media_galleries_folder_key_unique_idx").on(table.folderKey),
  }),
)

export const galleryImages = pgTable(
  "gallery_images",
  {
    id: serial("id").primaryKey(),
    galleryId: integer("gallery_id")
      .notNull()
      .references(() => mediaGalleries.id, { onDelete: "cascade" }),
    imageUrl: text("image_url").notNull(),
    caption: text("caption"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    galleryIdIdx: index("gallery_images_gallery_id_idx").on(table.galleryId),
    sortOrderIdx: index("gallery_images_sort_order_idx").on(table.sortOrder),
  }),
)

export const mediaPodcasts = pgTable(
  "media_podcasts",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    episode: text("episode").notNull(),
    duration: text("duration").notNull(),
    guest: text("guest").notNull(),
    description: text("description"),
    audioUrl: text("audio_url"),
    raceWeekendId: integer("race_weekend_id").references(() => raceWeekends.id),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    scriptText: text("script_text"),
    language: text("language").notNull().default("pt"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (table) => ({
    sortOrderIdx: index("media_podcasts_sort_order_idx").on(table.sortOrder),
    raceWeekendIdx: index("media_podcasts_race_weekend_idx").on(table.raceWeekendId),
  }),
)

export const newsArticles = pgTable(
  "news_articles",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull(),
    category: text("category").notNull(),
    readTime: text("read_time").notNull(),
    publishedDate: timestamp("published_date", { withTimezone: true }).notNull().defaultNow(),
    comments: integer("comments"),
    author: text("author").notNull(),
    body: text("body").array().notNull(),
    imageUrl: text("image_url"),
    isFeatured: boolean("is_featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    locale: text("locale").notNull().default("pt"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (table) => ({
    featuredIdx: index("news_articles_featured_idx").on(table.isFeatured),
    sortOrderIdx: index("news_articles_sort_order_idx").on(table.sortOrder),
    localeIdx: index("news_articles_locale_idx").on(table.locale),
  }),
)

export const pendingArticles = pgTable(
  "pending_articles",
  {
    id: serial("id").primaryKey(),
    filename: text("filename").notNull(),
    template: text("template").notNull(),
    source: text("source").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull(),
    category: text("category").notNull(),
    readTime: text("read_time").notNull(),
    date: text("date").notNull(),
    author: text("author").notNull(),
    image: text("image"),
    body: text("body").array().notNull(),
    status: text("status").notNull().default("pending"),
    assignmentType: text("assignment_type"),
    editorialDesk: text("editorial_desk"),
    season: integer("season"),
    round: integer("round"),
    sessionId: integer("session_id"),
    reviewStatus: text("review_status"),
    confidenceScore: real("confidence_score"),
    sourcePacketId: integer("source_packet_id"),
    newsArticleId: integer("news_article_id"),
    locale: text("locale").notNull().default("pt"),
    overrideReason: text("override_reason"),
    overrideAt: timestamp("override_at", { withTimezone: true }),
    overrideBy: text("override_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (table) => ({
    statusIdx: index("pending_articles_status_idx").on(table.status),
    filenameUniqueIdx: uniqueIndex("pending_articles_filename_unique_idx").on(table.filename),
    localeIdx: index("pending_articles_locale_idx").on(table.locale),
    assignmentIdx: index("pending_articles_assignment_idx").on(table.sessionId, table.assignmentType),
  }),
)

export const tireStints = pgTable(
  "tire_stints",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => raceSessions.id, { onDelete: "cascade" }),
    driverId: integer("driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "cascade" }),
    stintNumber: integer("stint_number").notNull(),
    compound: text("compound").notNull(),
    lapStart: integer("lap_start").notNull(),
    lapEnd: integer("lap_end").notNull(),
    tyreAgeAtStart: integer("tyre_age_at_start").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionDriverStintUniqueIdx: uniqueIndex("tire_stints_session_driver_stint_unique_idx").on(
      table.sessionId,
      table.driverId,
      table.stintNumber,
    ),
    sessionIdx: index("tire_stints_session_idx").on(table.sessionId),
  }),
)

export const sessionWeather = pgTable(
  "session_weather",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => raceSessions.id, { onDelete: "cascade" }),
    airTemperature: real("air_temperature"),
    trackTemperature: real("track_temperature"),
    humidity: integer("humidity"),
    pressure: real("pressure"),
    rainfall: boolean("rainfall").notNull().default(false),
    windDirection: integer("wind_direction"),
    windSpeed: real("wind_speed"),
    recordedAtUtc: timestamp("recorded_at_utc", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionRecordedIdx: index("session_weather_session_recorded_idx").on(table.sessionId, table.recordedAtUtc),
    sessionIdx: index("session_weather_session_idx").on(table.sessionId),
  }),
)

export const raceIntervals = pgTable(
  "race_intervals",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => raceSessions.id, { onDelete: "cascade" }),
    driverId: integer("driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "cascade" }),
    lapNumber: integer("lap_number").notNull(),
    gapToLeader: real("gap_to_leader"),
    intervalToAhead: real("interval_to_ahead"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionDriverLapIdx: uniqueIndex("race_intervals_session_driver_lap_idx").on(
      table.sessionId,
      table.driverId,
      table.lapNumber,
    ),
    sessionIdx: index("race_intervals_session_idx").on(table.sessionId),
  }),
)

export type TireStint = typeof tireStints.$inferSelect
export type SessionWeather = typeof sessionWeather.$inferSelect
export type RaceSession = typeof raceSessions.$inferSelect
export type RaceWeekend = typeof raceWeekends.$inferSelect
export type Circuit = typeof circuits.$inferSelect
export type SessionStatusEvent = typeof sessionStatusEvents.$inferSelect
export type RaceControlMessage = typeof raceControlMessages.$inferSelect
export type LapSummary = typeof lapSummaries.$inferSelect
export type PitStop = typeof pitStops.$inferSelect
export type Driver = typeof drivers.$inferSelect
export type SessionResult = typeof sessionResults.$inferSelect
export type Team = typeof teams.$inferSelect
export type MediaGallery = typeof mediaGalleries.$inferSelect
export type MediaPodcast = typeof mediaPodcasts.$inferSelect
export type NewsArticle = typeof newsArticles.$inferSelect
export type PendingArticle = typeof pendingArticles.$inferSelect
export const carTelemetry = pgTable(
  "car_telemetry",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => raceSessions.id, { onDelete: "cascade" }),
    driverId: integer("driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "cascade" }),
    lapNumber: integer("lap_number").notNull(),
    sampleIndex: integer("sample_index").notNull(),
    speed: integer("speed").notNull(),
    throttle: integer("throttle").notNull(),
    brake: integer("brake").notNull().default(0),
    rpm: integer("rpm").notNull(),
    gear: integer("gear").notNull(),
    drs: integer("drs").notNull().default(0),
    recordedAtUtc: timestamp("recorded_at_utc", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionDriverLapSampleIdx: uniqueIndex("car_telemetry_session_driver_lap_sample_idx").on(
      table.sessionId,
      table.driverId,
      table.lapNumber,
      table.sampleIndex,
    ),
    sessionDriverLapIdx: index("car_telemetry_session_driver_lap_idx").on(
      table.sessionId,
      table.driverId,
      table.lapNumber,
    ),
  }),
)

export const teamRadio = pgTable(
  "team_radio",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => raceSessions.id, { onDelete: "cascade" }),
    driverId: integer("driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "cascade" }),
    recordingUrl: text("recording_url").notNull(),
    lap: integer("lap"),
    occurredAtUtc: timestamp("occurred_at_utc", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionDriverUrlIdx: uniqueIndex("team_radio_session_driver_url_idx").on(
      table.sessionId,
      table.driverId,
      table.recordingUrl,
    ),
    sessionIdx: index("team_radio_session_idx").on(table.sessionId),
  }),
)

export const poleVideos = pgTable(
  "pole_videos",
  {
    id: serial("id").primaryKey(),
    season: integer("season").notNull(),
    round: integer("round").notNull(),
    cloudinaryUrl: text("cloudinary_url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    seasonRoundUniqueIdx: uniqueIndex("pole_videos_season_round_unique").on(table.season, table.round),
  }),
)

export const f1tvSyncPoints = pgTable(
  "f1tv_sync_points",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => raceSessions.id, { onDelete: "cascade" }),
    contentId: integer("content_id").notNull(),
    channelId: integer("channel_id"),
    streamStartUtc: timestamp("stream_start_utc", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionContentChannelIdx: index("f1tv_sync_points_session_idx").on(table.sessionId),
  }),
)

export const fantasySeasons = pgTable(
  "fantasy_seasons",
  {
    id: serial("id").primaryKey(),
    season: integer("season").notNull().unique(),
    name: text("name").notNull(),
    budgetCap: real("budget_cap").notNull().default(100),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (table) => ({
    activeIdx: index("fantasy_seasons_active_idx").on(table.isActive),
  }),
)

export const fantasyRulesets = pgTable(
  "fantasy_rulesets",
  {
    id: serial("id").primaryKey(),
    seasonId: integer("season_id")
      .notNull()
      .references(() => fantasySeasons.id, { onDelete: "cascade" }),
    lockPhase: text("lock_phase").notNull().default("qualifying_start"),
    freeDriverTransfers: integer("free_driver_transfers").notNull().default(2),
    freeEngineerTransfers: integer("free_engineer_transfers").notNull().default(1),
    extraDriverTransferPenalty: integer("extra_driver_transfer_penalty").notNull().default(10),
    extraEngineerTransferPenalty: integer("extra_engineer_transfer_penalty").notNull().default(10),
    teamMinHoldRounds: integer("team_min_hold_rounds").notNull().default(3),
    predictionsEnabled: boolean("predictions_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (table) => ({
    seasonUniqueIdx: uniqueIndex("fantasy_rulesets_season_unique_idx").on(table.seasonId),
  }),
)

export const fantasyProfiles = pgTable(
  "fantasy_profiles",
  {
    id: serial("id").primaryKey(),
    displayName: text("display_name").notNull(),
    sessionKey: text("session_key").notNull(),
    favoriteTeamId: integer("favorite_team_id").references(() => teams.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (table) => ({
    sessionKeyUniqueIdx: uniqueIndex("fantasy_profiles_session_key_unique_idx").on(table.sessionKey),
    favoriteTeamIdx: index("fantasy_profiles_favorite_team_idx").on(table.favoriteTeamId),
  }),
)

export const fantasyEngineers = pgTable(
  "fantasy_engineers",
  {
    id: serial("id").primaryKey(),
    season: integer("season").notNull(),
    engineerCode: text("engineer_code").notNull(),
    displayName: text("display_name").notNull(),
    shortName: text("short_name").notNull(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    activeFromRound: integer("active_from_round").notNull(),
    activeToRound: integer("active_to_round"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (table) => ({
    codeSeasonUniqueIdx: uniqueIndex("fantasy_engineers_code_season_unique_idx").on(table.season, table.engineerCode),
    seasonTeamRoundUniqueIdx: uniqueIndex("fantasy_engineers_season_team_round_unique_idx").on(
      table.season,
      table.teamId,
      table.activeFromRound,
    ),
    seasonTeamIdx: index("fantasy_engineers_season_team_idx").on(table.season, table.teamId),
  }),
)

export const fantasyAssets = pgTable(
  "fantasy_assets",
  {
    id: serial("id").primaryKey(),
    season: integer("season").notNull(),
    assetType: text("asset_type").notNull(),
    displayName: text("display_name").notNull(),
    slug: text("slug").notNull(),
    sourceDriverId: integer("source_driver_id").references(() => drivers.id, { onDelete: "cascade" }),
    sourceTeamId: integer("source_team_id").references(() => teams.id, { onDelete: "cascade" }),
    sourceEngineerId: integer("source_engineer_id").references(() => fantasyEngineers.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (table) => ({
    seasonSlugUniqueIdx: uniqueIndex("fantasy_assets_season_slug_unique_idx").on(table.season, table.slug),
    seasonTypeIdx: index("fantasy_assets_season_type_idx").on(table.season, table.assetType),
    seasonDriverUniqueIdx: uniqueIndex("fantasy_assets_season_driver_unique_idx").on(table.season, table.sourceDriverId),
    seasonTeamUniqueIdx: uniqueIndex("fantasy_assets_season_team_unique_idx").on(table.season, table.sourceTeamId),
    seasonEngineerUniqueIdx: uniqueIndex("fantasy_assets_season_engineer_unique_idx").on(
      table.season,
      table.sourceEngineerId,
    ),
  }),
)

export const fantasyAssetPrices = pgTable(
  "fantasy_asset_prices",
  {
    id: serial("id").primaryKey(),
    assetId: integer("asset_id")
      .notNull()
      .references(() => fantasyAssets.id, { onDelete: "cascade" }),
    season: integer("season").notNull(),
    round: integer("round").notNull(),
    price: real("price").notNull(),
    priceDelta: real("price_delta").notNull().default(0),
    performanceIndex: real("performance_index").notNull().default(0),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    assetSeasonRoundUniqueIdx: uniqueIndex("fantasy_asset_prices_asset_season_round_unique_idx").on(
      table.assetId,
      table.season,
      table.round,
    ),
    seasonRoundIdx: index("fantasy_asset_prices_season_round_idx").on(table.season, table.round),
  }),
)

export const fantasyRoundEntries = pgTable(
  "fantasy_round_entries",
  {
    id: serial("id").primaryKey(),
    profileId: integer("profile_id")
      .notNull()
      .references(() => fantasyProfiles.id, { onDelete: "cascade" }),
    seasonId: integer("season_id")
      .notNull()
      .references(() => fantasySeasons.id, { onDelete: "cascade" }),
    weekendId: integer("weekend_id")
      .notNull()
      .references(() => raceWeekends.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("draft"),
    budgetTotal: real("budget_total").notNull(),
    budgetSpent: real("budget_spent").notNull().default(0),
    freeDriverTransfersLeft: integer("free_driver_transfers_left").notNull().default(2),
    freeEngineerTransfersLeft: integer("free_engineer_transfers_left").notNull().default(1),
    teamLockedUntilRound: integer("team_locked_until_round"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (table) => ({
    profileSeasonWeekendUniqueIdx: uniqueIndex("fantasy_round_entries_profile_season_weekend_unique_idx").on(
      table.profileId,
      table.seasonId,
      table.weekendId,
    ),
    seasonWeekendStatusIdx: index("fantasy_round_entries_season_weekend_status_idx").on(
      table.seasonId,
      table.weekendId,
      table.status,
    ),
  }),
)

export const fantasyRoundHoldings = pgTable(
  "fantasy_round_holdings",
  {
    id: serial("id").primaryKey(),
    entryId: integer("entry_id")
      .notNull()
      .references(() => fantasyRoundEntries.id, { onDelete: "cascade" }),
    slotType: text("slot_type").notNull(),
    assetId: integer("asset_id")
      .notNull()
      .references(() => fantasyAssets.id, { onDelete: "restrict" }),
    lockedPrice: real("locked_price").notNull(),
    acquiredRound: integer("acquired_round").notNull(),
    isLocked: boolean("is_locked").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    entrySlotUniqueIdx: uniqueIndex("fantasy_round_holdings_entry_slot_unique_idx").on(table.entryId, table.slotType),
    entryAssetUniqueIdx: uniqueIndex("fantasy_round_holdings_entry_asset_unique_idx").on(table.entryId, table.assetId),
    entryIdx: index("fantasy_round_holdings_entry_idx").on(table.entryId),
  }),
)

export const fantasyTransfers = pgTable(
  "fantasy_transfers",
  {
    id: serial("id").primaryKey(),
    entryId: integer("entry_id")
      .notNull()
      .references(() => fantasyRoundEntries.id, { onDelete: "cascade" }),
    seasonId: integer("season_id")
      .notNull()
      .references(() => fantasySeasons.id, { onDelete: "cascade" }),
    weekendId: integer("weekend_id")
      .notNull()
      .references(() => raceWeekends.id, { onDelete: "cascade" }),
    transferKind: text("transfer_kind").notNull(),
    slotType: text("slot_type").notNull(),
    outgoingAssetId: integer("outgoing_asset_id").references(() => fantasyAssets.id, { onDelete: "set null" }),
    incomingAssetId: integer("incoming_asset_id")
      .notNull()
      .references(() => fantasyAssets.id, { onDelete: "restrict" }),
    penaltyPoints: integer("penalty_points").notNull().default(0),
    usedFreeTransfer: boolean("used_free_transfer").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    entryCreatedIdx: index("fantasy_transfers_entry_created_idx").on(table.entryId, table.createdAt),
    seasonWeekendIdx: index("fantasy_transfers_season_weekend_idx").on(table.seasonId, table.weekendId),
  }),
)

export const fantasyPredictions = pgTable(
  "fantasy_predictions",
  {
    id: serial("id").primaryKey(),
    entryId: integer("entry_id")
      .notNull()
      .references(() => fantasyRoundEntries.id, { onDelete: "cascade" }),
    seasonId: integer("season_id")
      .notNull()
      .references(() => fantasySeasons.id, { onDelete: "cascade" }),
    weekendId: integer("weekend_id")
      .notNull()
      .references(() => raceWeekends.id, { onDelete: "cascade" }),
    poleDriverId: integer("pole_driver_id").references(() => drivers.id, { onDelete: "set null" }),
    raceWinnerDriverId: integer("race_winner_driver_id").references(() => drivers.id, { onDelete: "set null" }),
    podiumP1DriverId: integer("podium_p1_driver_id").references(() => drivers.id, { onDelete: "set null" }),
    podiumP2DriverId: integer("podium_p2_driver_id").references(() => drivers.id, { onDelete: "set null" }),
    podiumP3DriverId: integer("podium_p3_driver_id").references(() => drivers.id, { onDelete: "set null" }),
    fastestLapDriverId: integer("fastest_lap_driver_id").references(() => drivers.id, { onDelete: "set null" }),
    fastestPitTeamId: integer("fastest_pit_team_id").references(() => teams.id, { onDelete: "set null" }),
    safetyCarBand: text("safety_car_band"),
    hasRedFlag: boolean("has_red_flag"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (table) => ({
    entryUniqueIdx: uniqueIndex("fantasy_predictions_entry_unique_idx").on(table.entryId),
    seasonWeekendIdx: index("fantasy_predictions_season_weekend_idx").on(table.seasonId, table.weekendId),
  }),
)

export const fantasyRoundScores = pgTable(
  "fantasy_round_scores",
  {
    id: serial("id").primaryKey(),
    entryId: integer("entry_id")
      .notNull()
      .references(() => fantasyRoundEntries.id, { onDelete: "cascade" }),
    seasonId: integer("season_id")
      .notNull()
      .references(() => fantasySeasons.id, { onDelete: "cascade" }),
    weekendId: integer("weekend_id")
      .notNull()
      .references(() => raceWeekends.id, { onDelete: "cascade" }),
    driversScore: integer("drivers_score").notNull().default(0),
    teamScore: integer("team_score").notNull().default(0),
    engineerScore: integer("engineer_score").notNull().default(0),
    predictionsScore: integer("predictions_score").notNull().default(0),
    totalScore: integer("total_score").notNull().default(0),
    isOfficial: boolean("is_official").notNull().default(false),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (table) => ({
    entryUniqueIdx: uniqueIndex("fantasy_round_scores_entry_unique_idx").on(table.entryId),
    seasonWeekendOfficialIdx: index("fantasy_round_scores_season_weekend_official_idx").on(
      table.seasonId,
      table.weekendId,
      table.isOfficial,
    ),
  }),
)

export const fantasyScoreItems = pgTable(
  "fantasy_score_items",
  {
    id: serial("id").primaryKey(),
    roundScoreId: integer("round_score_id")
      .notNull()
      .references(() => fantasyRoundScores.id, { onDelete: "cascade" }),
    assetId: integer("asset_id").references(() => fantasyAssets.id, { onDelete: "set null" }),
    scoreBlock: text("score_block").notNull(),
    scoreType: text("score_type").notNull(),
    points: integer("points").notNull(),
    sourceTable: text("source_table").notNull(),
    sourceRecordId: integer("source_record_id"),
    metaJson: jsonb("meta_json").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    roundScoreIdx: index("fantasy_score_items_round_score_idx").on(table.roundScoreId),
    assetIdx: index("fantasy_score_items_asset_idx").on(table.assetId),
    blockTypeIdx: index("fantasy_score_items_block_type_idx").on(table.scoreBlock, table.scoreType),
  }),
)
export const editorialAssignments = pgTable(
  "editorial_assignments",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(),
    rawInput: text("raw_input").notNull(),
    topicCanonical: text("topic_canonical").notNull(),
    assignmentType: text("assignment_type").notNull(),
    editorialDesk: text("editorial_desk").notNull(),
    season: integer("season"),
    round: integer("round"),
    sessionId: integer("session_id").references(() => raceSessions.id, { onDelete: "set null" }),
    status: text("status").notNull().default("new"),
    confidenceScore: real("confidence_score"),
    locale: text("locale").notNull().default("pt"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorLog: text("error_log"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    sourceEventKey: text("source_event_key"),
    newsArticleId: integer("news_article_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (table) => ({
    statusIdx: index("editorial_assignments_status_idx").on(table.status),
    nextAttemptIdx: index("editorial_assignments_next_attempt_idx").on(table.status, table.nextAttemptAt),
    sessionIdx: index("editorial_assignments_session_idx").on(table.sessionId),
  })
)

export const editorialSourcePackets = pgTable(
  "editorial_source_packets",
  {
    id: serial("id").primaryKey(),
    assignmentId: integer("assignment_id")
      .notNull()
      .references(() => editorialAssignments.id, { onDelete: "cascade" }),
    packetJson: jsonb("packet_json").$type<Record<string, unknown>>().notNull(),
    packetHash: text("packet_hash").notNull(),
    sourceSummary: text("source_summary").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    assignmentIdx: index("editorial_source_packets_assignment_idx").on(table.assignmentId),
  })
)

export const editorialReviews = pgTable(
  "editorial_reviews",
  {
    id: serial("id").primaryKey(),
    assignmentId: integer("assignment_id")
      .notNull()
      .references(() => editorialAssignments.id, { onDelete: "cascade" }),
    pendingArticleId: integer("pending_article_id").references(() => pendingArticles.id, { onDelete: "set null" }),
    reviewType: text("review_type").notNull(),
    status: text("status").notNull(),
    score: real("score"),
    issuesJson: jsonb("issues_json").$type<unknown[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    assignmentIdx: index("editorial_reviews_assignment_idx").on(table.assignmentId),
    pendingArticleIdx: index("editorial_reviews_pending_article_idx").on(table.pendingArticleId),
  })
)

export const articleSourceLinks = pgTable(
  "article_source_links",
  {
    id: serial("id").primaryKey(),
    pendingArticleId: integer("pending_article_id")
      .notNull()
      .references(() => pendingArticles.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(),
    sourceRef: text("source_ref").notNull(),
    sourceLabel: text("source_label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pendingArticleIdx: index("article_source_links_pending_article_idx").on(table.pendingArticleId),
  })
)

export type RaceInterval = typeof raceIntervals.$inferSelect
export type CarTelemetry = typeof carTelemetry.$inferSelect
export type TeamRadio = typeof teamRadio.$inferSelect
export type PoleVideo = typeof poleVideos.$inferSelect
export type FantasySeason = typeof fantasySeasons.$inferSelect
export type FantasyRuleset = typeof fantasyRulesets.$inferSelect
export type FantasyProfile = typeof fantasyProfiles.$inferSelect
export type FantasyEngineer = typeof fantasyEngineers.$inferSelect
export type FantasyAsset = typeof fantasyAssets.$inferSelect
export type FantasyAssetPrice = typeof fantasyAssetPrices.$inferSelect
export type FantasyRoundEntry = typeof fantasyRoundEntries.$inferSelect
export type FantasyRoundHolding = typeof fantasyRoundHoldings.$inferSelect
export type FantasyTransfer = typeof fantasyTransfers.$inferSelect
export type FantasyPrediction = typeof fantasyPredictions.$inferSelect
export type FantasyRoundScore = typeof fantasyRoundScores.$inferSelect
export type FantasyScoreItem = typeof fantasyScoreItems.$inferSelect
export type EditorialAssignment = typeof editorialAssignments.$inferSelect
export type EditorialSourcePacket = typeof editorialSourcePackets.$inferSelect
export type EditorialReview = typeof editorialReviews.$inferSelect
export type ArticleSourceLink = typeof articleSourceLinks.$inferSelect

