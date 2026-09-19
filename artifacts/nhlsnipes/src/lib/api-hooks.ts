import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AuditRecord,
  DashboardSummary,
  Game,
  GameDetail,
  Goalie,
  Matchup,
  ModelPerformance,
  Player,
  PlayerDetail,
  Prop,
  Snipe,
  Team,
  TeamDetail,
} from "@workspace/api-client-react";

type QueryOptions = {
  query?: {
    enabled?: boolean;
    queryKey?: readonly unknown[];
  };
};

type ApiQuery<T> = {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  queryKey: readonly unknown[];
};

function useApiQuery<T>(path: string, options?: QueryOptions): ApiQuery<T> {
  const enabled = options?.query?.enabled ?? true;
  const queryKey = options?.query?.queryKey ?? [path];
  const [data, setData] = useState<T>();
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(path, { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(`Request failed with HTTP ${response.status}`);
      setData((await response.json()) as T);
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error("Request failed"));
    } finally {
      setIsLoading(false);
    }
  }, [enabled, path]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return useMemo(
    () => ({ data, isLoading, isError: Boolean(error), error, refetch, queryKey }),
    [data, error, isLoading, queryKey, refetch],
  );
}

function withParams(path: string, params?: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export const getHealthCheckQueryKey = () => ["/api/healthz"] as const;
export const getGetDashboardSummaryQueryKey = () => ["/api/dashboard/summary"] as const;
export const getGetGamesQueryKey = (params?: { date?: Date }) => ["/api/games", params] as const;
export const getGetTodayGamesQueryKey = () => ["/api/games/today"] as const;
export const getGetGameQueryKey = (gameId: string) => ["/api/games", gameId] as const;
export const getGetPlayersQueryKey = (params?: { search?: string; team?: string }) => ["/api/players", params] as const;
export const getGetPlayerQueryKey = (playerId: string) => ["/api/players", playerId] as const;
export const getGetTeamsQueryKey = () => ["/api/teams"] as const;
export const getGetTeamQueryKey = (teamId: string) => ["/api/teams", teamId] as const;
export const getGetGoaliesQueryKey = () => ["/api/goalies"] as const;
export const getGetPropsQueryKey = (params?: { market?: string }) => ["/api/props", params] as const;
export const getGetPropsByMarketQueryKey = (market: string) => ["/api/props", market] as const;
export const getGetMatchupsQueryKey = () => ["/api/matchups"] as const;
export const getGetSnipesQueryKey = (params?: { market?: string }) => ["/api/snipes", params] as const;
export const getGetAuditQueryKey = () => ["/api/audit"] as const;
export const getGetModelPerformanceQueryKey = () => ["/api/model-performance"] as const;

export function useHealthCheck(options?: QueryOptions) {
  return useApiQuery<{ status: string }>("/api/healthz", options);
}

export function useGetDashboardSummary(options?: QueryOptions) {
  return useApiQuery<DashboardSummary>("/api/dashboard/summary", options);
}

export function useGetGames(params?: { date?: Date }, options?: QueryOptions) {
  return useApiQuery<Game[]>(
    withParams("/api/games", { date: params?.date?.toISOString().slice(0, 10) }),
    options,
  );
}

export function useGetTodayGames(options?: QueryOptions) {
  return useApiQuery<Game[]>("/api/games/today", options);
}

export function useGetGame(gameId: string, options?: QueryOptions) {
  return useApiQuery<GameDetail>(`/api/games/${encodeURIComponent(gameId)}`, options);
}

export function useGetPlayers(params?: { search?: string; team?: string }, options?: QueryOptions) {
  return useApiQuery<Player[]>(withParams("/api/players", params), options);
}

export function useGetPlayer(playerId: string, options?: QueryOptions) {
  return useApiQuery<PlayerDetail>(`/api/players/${encodeURIComponent(playerId)}`, options);
}

export function useGetTeams(options?: QueryOptions) {
  return useApiQuery<Team[]>("/api/teams", options);
}

export function useGetTeam(teamId: string, options?: QueryOptions) {
  return useApiQuery<TeamDetail>(`/api/teams/${encodeURIComponent(teamId)}`, options);
}

export function useGetGoalies(options?: QueryOptions) {
  return useApiQuery<Goalie[]>("/api/goalies", options);
}

export function useGetProps(params?: { market?: string }, options?: QueryOptions) {
  return useApiQuery<Prop[]>(withParams("/api/props", params), options);
}

export function useGetPropsByMarket(market: string, options?: QueryOptions) {
  return useApiQuery<Prop[]>(`/api/props/${encodeURIComponent(market)}`, options);
}

export function useGetMatchups(options?: QueryOptions) {
  return useApiQuery<Matchup[]>("/api/matchups", options);
}

export function useGetSnipes(params?: { market?: string }, options?: QueryOptions) {
  return useApiQuery<Snipe[]>(withParams("/api/snipes", params), options);
}

export function useGetAudit(options?: QueryOptions) {
  return useApiQuery<AuditRecord[]>("/api/audit", options);
}

export function useGetModelPerformance(options?: QueryOptions) {
  return useApiQuery<ModelPerformance[]>("/api/model-performance", options);
}

export type DataHealth = {
  provider: string;
  connection: "connected" | "error" | "not configured";
  lastSuccessfulSync: string | null;
  lastAttemptedSync: string | null;
  teamsImported: number;
  gamesImported: number;
  playersImported: number;
  playerStatsImported: number;
  goalieStatsImported: number;
  errors: string[];
};

export function useDataHealth(options?: QueryOptions) {
  return useApiQuery<DataHealth>("/api/admin/data-health", options);
}