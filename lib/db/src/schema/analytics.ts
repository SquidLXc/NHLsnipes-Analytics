import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  date,
  integer,
  jsonb,
  index,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const teamsTable = pgTable(
  "teams",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    city: text("city"),
    abbreviation: text("abbreviation").notNull(),
    conference: text("conference"),
    division: text("division"),
    logoUrl: text("logo_url"),
    primaryColor: text("primary_color"),
    secondaryColor: text("secondary_color"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("teams_abbreviation_idx").on(table.abbreviation)],
);

export const playersTable = pgTable(
  "players",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull(),
    fullName: text("full_name").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    position: text("position").notNull(),
    jerseyNumber: integer("jersey_number"),
    headshotUrl: text("headshot_url"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("players_team_idx").on(table.teamId),
    index("players_name_idx").on(table.fullName),
  ],
);

export const gamesTable = pgTable(
  "games",
  {
    id: text("id").primaryKey(),
    gameDate: timestamp("game_date", { withTimezone: true }).notNull(),
    awayTeamId: text("away_team_id").notNull(),
    homeTeamId: text("home_team_id").notNull(),
    venue: text("venue"),
    status: text("status").notNull(),
    statusDetail: text("status_detail"),
    finalAwayScore: integer("final_away_score"),
    finalHomeScore: integer("final_home_score"),
    rawPayload: jsonb("raw_payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("games_date_idx").on(table.gameDate),
    index("games_away_team_idx").on(table.awayTeamId),
    index("games_home_team_idx").on(table.homeTeamId),
  ],
);

export const playerGameStatsTable = pgTable(
  "player_game_stats",
  {
    id: text("id").primaryKey(),
    gameId: text("game_id").notNull(),
    playerId: text("player_id").notNull(),
    goals: integer("goals"),
    assists: integer("assists"),
    points: integer("points"),
    shotsOnGoal: integer("shots_on_goal"),
    hits: integer("hits"),
    blocks: integer("blocks"),
    toiSeconds: integer("toi_seconds"),
    ppToiSeconds: integer("pp_toi_seconds"),
    rawPayload: jsonb("raw_payload"),
  },
  (table) => [
    index("player_game_stats_game_idx").on(table.gameId),
    index("player_game_stats_player_idx").on(table.playerId),
  ],
);

export const goalieGameStatsTable = pgTable(
  "goalie_game_stats",
  {
    id: text("id").primaryKey(),
    gameId: text("game_id").notNull(),
    playerId: text("player_id").notNull(),
    shotsAgainst: integer("shots_against"),
    saves: integer("saves"),
    goalsAgainst: integer("goals_against"),
    savePercentage: real("save_percentage"),
    rawPayload: jsonb("raw_payload"),
  },
  (table) => [
    index("goalie_game_stats_game_idx").on(table.gameId),
    index("goalie_game_stats_player_idx").on(table.playerId),
  ],
);

export const propsTable = pgTable(
  "props",
  {
    id: text("id").primaryKey(),
    gameId: text("game_id").notNull(),
    playerId: text("player_id").notNull(),
    market: text("market").notNull(),
    line: real("line"),
    source: text("source"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    rawPayload: jsonb("raw_payload"),
  },
  (table) => [
    index("props_game_idx").on(table.gameId),
    index("props_player_idx").on(table.playerId),
    index("props_market_idx").on(table.market),
  ],
);

export const modelVersionsTable = pgTable("model_versions", {
  version: text("version").primaryKey(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const predictionsTable = pgTable(
  "predictions",
  {
    id: text("id").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    gameId: text("game_id").notNull(),
    playerId: text("player_id"),
    market: text("market").notNull(),
    line: real("line"),
    modelProjection: real("model_projection"),
    probability: real("probability"),
    confidence: text("confidence"),
    modelVersion: text("model_version").notNull(),
    inputsSnapshot: jsonb("inputs_snapshot").notNull(),
  },
  (table) => [
    index("predictions_game_idx").on(table.gameId),
    index("predictions_player_idx").on(table.playerId),
    index("predictions_market_idx").on(table.market),
    index("predictions_created_at_idx").on(table.createdAt),
  ],
);

export const predictionResultsTable = pgTable(
  "prediction_results",
  {
    predictionId: text("prediction_id").primaryKey(),
    gameResult: jsonb("game_result").notNull(),
    actual: real("actual"),
    predictionResult: text("prediction_result").notNull(),
    gradedAt: timestamp("graded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("prediction_results_graded_at_idx").on(table.gradedAt)],
);

export const insertTeamSchema = createInsertSchema(teamsTable);
export const insertPlayerSchema = createInsertSchema(playersTable);
export const insertGameSchema = createInsertSchema(gamesTable);
export const insertPredictionSchema = createInsertSchema(predictionsTable);
export type Team = typeof teamsTable.$inferSelect;
export type Player = typeof playersTable.$inferSelect;
export type Game = typeof gamesTable.$inferSelect;
export type Prediction = typeof predictionsTable.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type InsertGame = z.infer<typeof insertGameSchema>;
export type InsertPrediction = z.infer<typeof insertPredictionSchema>;