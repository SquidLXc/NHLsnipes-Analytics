import { useEffect, useMemo, useState } from 'react';
import { Link, Route, Router as WouterRouter, Switch, useLocation, useParams, useSearch } from 'wouter';
import {
  Activity, ArrowUpRight, BarChart3, Bell, BrainCircuit, CalendarDays, Check, ChevronRight,
  CircleAlert, Clock3, Database, ExternalLink, Gauge, Goal, Heart, Info, Menu, RefreshCw,
  Search, Shield, SlidersHorizontal, Sparkles, Star, Target, TrendingUp, Trophy, Users, X, Zap, Instagram
} from 'lucide-react';
import {
  getGetAuditQueryKey, getGetDashboardSummaryQueryKey, getGetFutureGamesQueryKey, getGetGameQueryKey, getGetGamesQueryKey, getGetMatchupQueryKey, getGetOddsQueryKey,
  getGetGoaliesQueryKey, getGetMatchupsQueryKey, getGetModelPerformanceQueryKey,
  getGetPlayerQueryKey, getGetPlayersQueryKey, getGetPropsByMarketQueryKey, getGetPropsQueryKey,
  getGetLiveAlertsQueryKey, getGetSnipesQueryKey, getGetTeamQueryKey, getGetTeamsQueryKey, getGetTodayGamesQueryKey,
  getHealthCheckQueryKey, useHealthCheck, useGetAudit, useGetDashboardSummary, useGetGame,
  useGetFutureGames, useGetGames, useGetGoalies, useGetLiveAlerts, useGetMatchup, useGetMatchups, useGetOdds, useGetPlayer, useGetPlayers, useGetProps,
  useGetPropsByMarket, useGetSnipes, useGetTeam, useGetTeams, useGetTodayGames,
  useGetModelPerformance
} from '@workspace/api-client-react';
import { useDataHealth } from '@/lib/api-hooks';
import type {
  AuditRecord, DashboardSummary, Game, Goalie, Matchup, MatchupDetail, MatchupPlayer, ModelPerformance, OddsFeed, OddsMarket, Player, PlayerDetail,
  LiveAlerts, Prop, Snipe, Team, TeamDetail
} from '@workspace/api-client-react';
import { PlayerImage, TeamCrest } from '@/components/assets';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import '@/index.css';

const markets = ['all', 'goals', 'sog', 'points', 'assists', 'saves', 'blocks', 'hits'] as const;
type Market = typeof markets[number];

const nav = [
  { href: '/', label: 'Overview', icon: Gauge },
  { href: '/snipes', label: 'Snipes', icon: Target, hot: true },
  { href: '/props', label: 'Prop board', icon: BarChart3 },
  { href: '/matchups', label: 'Matchups', icon: Trophy },
  { href: '/goalies', label: 'Goalie lab', icon: Shield },
  { href: '/players', label: 'Players', icon: Users },
  { href: '/teams', label: 'Teams', icon: Activity },
  { href: '/watchlist', label: 'Watchlist', icon: Star },
  { href: '/audit', label: 'Audit trail', icon: BrainCircuit },
];

function fmt(value: number | null | undefined, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(value % 1 === 0 ? 0 : 2)}${suffix}`;
}
function pct(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `${(value * 100).toFixed(1)}%`;
}
function shortDate(value: string | null | undefined) {
  if (!value) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(value));
}
function time(value: string | null | undefined) {
  if (!value) return 'TBD';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}
function DataState({ state, message, compact = false }: { state?: string; message?: string; compact?: boolean }) {
  const preseason = state === 'partial' && message?.includes('no verified games');
  const live = state === 'live' || preseason;
  const label = preseason ? 'preseason' : state || 'unknown';
  return (
    <div data-testid="status-data-state" className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-mono uppercase tracking-[.16em] ${live ? 'border-primary/30 bg-primary/10 text-primary' : 'border-accent/30 bg-accent/10 text-accent'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-primary shadow-[0_0_10px_hsl(var(--primary))]' : 'bg-accent'}`} />
      {label} {compact ? '' : `· ${message || 'Feed status'}`}
    </div>
  );
}

function EmptyState({ title = 'No signal yet', body = 'This feed returned no records. Nothing has been filled in by assumption.', icon: Icon = Database }: { title?: string; body?: string; icon?: typeof Database }) {
  return (
    <div data-testid="state-empty" className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
      <div className="mb-4 rounded-full border border-primary/20 bg-primary/5 p-3 text-primary"><Icon size={20} /></div>
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}

function QueryState({ loading, error, empty, children, onRetry }: { loading?: boolean; error?: boolean; empty?: boolean; children: React.ReactNode; onRetry?: () => void }) {
  if (loading) return <div data-testid="state-loading" className="grid gap-3 md:grid-cols-3">{[1, 2, 3].map((n) => <div key={n} className="h-32 animate-pulse rounded-xl border border-border bg-card/70" />)}</div>;
  if (error) return <div data-testid="state-error" className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-destructive/25 bg-destructive/5 text-center"><CircleAlert className="mb-3 text-destructive" size={22} /><p className="font-medium">Feed unavailable</p><p className="mt-1 text-sm text-muted-foreground">The provider did not answer. Try the connection again.</p><button data-testid="button-retry" onClick={onRetry} className="mt-4 rounded-lg border border-border px-4 py-2 text-xs font-semibold hover:border-primary/50">Retry connection</button></div>;
  if (empty) return <EmptyState />;
  return <>{children}</>;
}

function TeamMark({ team, size = 'md' }: { team?: Team; size?: 'sm' | 'md' | 'lg' }) {
  return <TeamCrest team={team} size={size} />;
}

function PageHeader({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="mb-2 font-mono text-[10px] uppercase tracking-[.22em] text-primary">{eyebrow}</p><h1 data-testid={`heading-${title.toLowerCase().replace(/\s/g, '-')}`} className="text-3xl font-extrabold tracking-[-.04em] text-foreground md:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{copy}</p></div>{action}</div>;
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const dataHealth = useDataHealth();
  const feedLabel = dataHealth.isLoading ? 'DATA FEED CHECKING' : dataHealth.data?.lastSuccessfulSync ? 'DATA CURRENT' : dataHealth.data?.connection === 'connected' ? 'SYNC REQUIRED' : 'DATA FEED OFFLINE';
  return <div className="min-h-[100dvh] bg-background">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[244px] flex-col border-r border-sidebar-border bg-sidebar transition-transform md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-[76px] items-center border-b border-sidebar-border px-6"><Link data-testid="link-brand" href="/" className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-primary text-primary-foreground"><Zap size={16} fill="currentColor" /></span><span><span className="block font-mono text-[14px] font-medium tracking-[-.04em] text-foreground">NHL<span className="text-primary">snipes</span></span><span className="mt-0.5 block font-mono text-[8px] tracking-[.08em] text-muted-foreground">build by SquidLxc</span></span></Link></div>
      <nav className="flex-1 space-y-1 px-3 py-5">{nav.map((item) => { const Icon = item.icon; const active = location === item.href || (item.href !== '/' && location.startsWith(item.href)); return <Link data-testid={`link-nav-${item.label.toLowerCase().replace(/\s/g, '-')}`} href={item.href} key={item.href} onClick={() => setOpen(false)} className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-semibold transition-colors ${active ? 'bg-primary/10 text-primary' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground'}`}><Icon size={16} strokeWidth={active ? 2.4 : 1.7} /><span>{item.label}</span>{item.hot && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_12px_hsl(var(--accent))]" />}</Link> })}</nav>
      <div className="border-t border-sidebar-border p-4">
        <div className="mb-4 space-y-2">
          <p className="px-3 text-[10px] font-mono uppercase tracking-[.12em] text-muted-foreground">Join Community</p>
          <a 
            href="/api/auth/discord/login" 
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 127.14 96.36" fill="currentColor">
              <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
            </svg>
            <span>Join Discord</span>
            <ExternalLink size={12} className="ml-auto opacity-50" />
          </a>
          <a 
            href="https://www.instagram.com/topcapperz/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <Instagram size={16} />
            <span>Daily Plays</span>
            <ExternalLink size={12} className="ml-auto opacity-50" />
          </a>
        </div>
        <Link data-testid="link-admin" href="/admin" className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs ${location === '/admin' ? 'bg-secondary/10 text-secondary' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`}><SlidersHorizontal size={15} /><span>Ops / data health</span></Link><div className="mt-5 flex items-center gap-2 px-3 text-[10px] font-mono uppercase tracking-[.12em] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-primary" />Terminal online</div></div>
    </aside>
    {open && <button data-testid="button-close-menu" aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-background/70 backdrop-blur-sm md:hidden"><X className="absolute right-5 top-5 text-muted-foreground" /></button>}
    <div className="md:pl-[244px]"><header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-border/80 bg-background/90 px-4 backdrop-blur-xl md:px-8"><button data-testid="button-open-menu" aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-lg border border-border p-2 text-muted-foreground md:hidden"><Menu size={18} /></button><div className="hidden items-center gap-2 text-[10px] font-mono uppercase tracking-[.16em] text-muted-foreground md:flex"><span className="text-primary">NHL /</span> Decision terminal <span className="mx-1 text-border">•</span> {shortDate(new Date().toISOString())}</div><div className="ml-auto flex items-center gap-2"><button data-testid="button-notifications" className="rounded-lg border border-border p-2 text-muted-foreground hover:border-primary/40 hover:text-primary"><Bell size={16} /></button><Link data-testid="link-admin-top" href="/admin" className="hidden items-center gap-2 rounded-lg border border-border px-3 py-2 text-[11px] font-semibold text-muted-foreground hover:border-primary/40 hover:text-foreground sm:flex"><span className={`h-2 w-2 rounded-full ${dataHealth.data?.lastSuccessfulSync ? 'bg-primary' : 'bg-accent'}`} />{feedLabel}</Link></div></header><main className="mx-auto max-w-[1440px] px-4 py-7 md:px-8 md:py-9">{children}</main><footer className="border-t border-border/80 px-4 py-6 text-[10px] leading-5 text-muted-foreground md:px-8"><p>NHLsnipes is an independent sports analytics platform and is not affiliated with or endorsed by the National Hockey League.</p><p>Analytics are informational and do not guarantee outcomes.</p></footer></div>
  </div>;
}

function StatCard({ label, value, note, accent = 'green', icon: Icon = Activity }: { label: string; value: string | number; note: string; accent?: 'green' | 'purple' | 'pink'; icon?: typeof Activity }) {
  const colors = { green: 'text-primary border-primary/20', purple: 'text-secondary border-secondary/20', pink: 'text-accent border-accent/20' };
  return <div className={`signal-shadow rounded-xl border bg-card/80 p-4 ${colors[accent]}`}><div className="mb-5 flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">{label}</span><Icon size={15} /></div><div data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`} className="text-2xl font-extrabold tracking-[-.04em] text-foreground">{value}</div><div className="mt-1 text-[11px] text-muted-foreground">{note}</div></div>;
}

function GameRow({ game }: { game: Game }) {
  return <Link data-testid={`card-game-${game.id}`} href={`/matchups?game=${game.id}`} className="group flex items-center gap-3 rounded-xl border border-border bg-card/70 p-3 transition-colors hover:border-primary/40 hover:bg-card md:gap-4"><div className="w-[52px] shrink-0 text-center"><div className="font-mono text-[11px] font-medium text-foreground">{time(game.gameDate)}</div><div className={`mt-1 text-[9px] uppercase tracking-wider ${game.status === 'live' ? 'text-accent' : 'text-muted-foreground'}`}>{game.status}</div></div><div className="flex min-w-0 flex-1 items-center gap-3"><TeamMark team={game.awayTeam} /><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{game.awayTeam.name}</div><div className="mt-1 text-[10px] text-muted-foreground">at {game.venue || 'venue unavailable'}</div></div><div className="font-mono text-[10px] text-muted-foreground">vs</div><div className="min-w-0 flex-1 text-right"><div className="truncate text-sm font-semibold">{game.homeTeam.name}</div><div className="mt-1 text-[10px] text-muted-foreground">home</div></div><TeamMark team={game.homeTeam} /></div><ChevronRight size={15} className="text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" /></Link>;
}

function SnipeRow({ snipe, watchlist, onWatch }: { snipe: Snipe; watchlist: string[]; onWatch: (id: string) => void }) {
  const saved = watchlist.includes(snipe.player.id);
  return <div data-testid={`row-snipe-${snipe.id}`} className="group grid gap-4 border-b border-border/80 py-4 first:pt-0 last:border-0 md:grid-cols-[1.6fr_1fr_1fr_1fr_auto] md:items-center"><div className="flex items-center gap-3"><button data-testid={`button-watch-${snipe.player.id}`} onClick={() => onWatch(snipe.player.id)} className={`rounded-lg border p-2 transition-colors ${saved ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-primary'}`}><Star size={14} fill={saved ? 'currentColor' : 'none'} /></button><PlayerImage player={snipe.player} size="sm" /><div><Link data-testid={`link-player-${snipe.player.id}`} href={`/players/${snipe.player.id}`} className="text-sm font-bold hover:text-primary">{snipe.player.fullName}</Link><div className="mt-0.5 text-[10px] text-muted-foreground">{snipe.player.team.abbreviation} · {snipe.player.position} · vs {snipe.opponent.abbreviation}</div></div></div><div><div className="text-sm font-semibold">{snipe.confidence}</div><div className="mt-1 h-1.5 w-24 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(snipe.score, 100)}%` }} /></div></div><div><div className="font-mono text-sm text-foreground">{fmt(snipe.modelProjection)}</div><div className="text-[10px] text-muted-foreground">model / {fmt(snipe.line)} line</div></div><div><div className="font-mono text-sm text-primary">{pct(snipe.edge)}</div><div className="text-[10px] text-muted-foreground">edge</div></div><div className="flex flex-wrap gap-1 md:justify-end">{snipe.factors.slice(0, 2).map((factor) => <span key={factor} className="rounded border border-secondary/25 bg-secondary/10 px-2 py-1 text-[9px] text-secondary">{factor}</span>)}</div></div>;
}

function LiveAlertsPanel() {
  const query = useGetLiveAlerts({
    query: {
      queryKey: getGetLiveAlertsQueryKey(),
      refetchInterval: 30_000,
    },
  });
  const feed = query.data as LiveAlerts | undefined;
  const alerts = feed?.alerts ?? [];
  const latestAlerts = alerts.slice(-6).reverse();
  const tickerAlerts = latestAlerts.length > 1 ? [...latestAlerts, ...latestAlerts] : latestAlerts;
  const statusLabel = query.isLoading ? 'CHECKING' : query.isError ? 'OFFLINE' : feed?.state === 'live' ? 'LIVE' : 'WAITING';

  return (
    <section data-testid="panel-live-alerts" className="scanline rounded-xl border border-accent/25 bg-accent/5 p-4 shadow-[0_0_28px_rgba(255,83,207,.06)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.16em] text-accent">Live goal alerts</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Confirmed scoring events from NHL game feeds</p>
        </div>
        <span className={`rounded-full border px-2 py-1 font-mono text-[9px] uppercase tracking-wider ${statusLabel === 'LIVE' ? 'border-primary/30 bg-primary/10 text-primary' : 'border-accent/30 text-accent'}`}>
          {statusLabel}
        </span>
      </div>
      <div aria-live="polite" className="relative h-[82px] overflow-hidden rounded-lg border border-border/80 bg-background/70 px-3">
        {query.isError ? (
          <div className="flex h-full items-center gap-2 text-[11px] text-muted-foreground">
            <CircleAlert size={14} className="text-destructive" />
            Live alert feed unavailable. No events were invented.
          </div>
        ) : tickerAlerts.length ? (
          <div className={`live-alert-marquee flex flex-col justify-center gap-2 py-2 ${tickerAlerts.length > latestAlerts.length ? 'live-alert-marquee-active' : ''}`}>
            {tickerAlerts.map((alert, index) => (
              <div data-testid={`live-alert-${alert.id}`} key={`${alert.id}-${index}`} className="flex min-w-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[.04em]">
                <span className="shrink-0 text-accent">GOAL</span>
                <span className="truncate text-foreground">#{alert.scorer.jerseyNumber ?? '—'} {alert.scorer.fullName}</span>
                <span className="shrink-0 text-primary">{alert.scoringTeam.abbreviation}</span>
                <span className="shrink-0 text-muted-foreground">{alert.periodLabel} {alert.timeInPeriod}</span>
                <span className="ml-auto shrink-0 text-foreground">{alert.awayTeam.abbreviation} {alert.awayScore ?? '—'} — {alert.homeScore ?? '—'} {alert.homeTeam.abbreviation}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center text-[11px] text-muted-foreground">
            {feed?.state === 'live' ? 'Live games are in progress. Waiting for a confirmed goal.' : 'No games live. Confirmed goals will scroll here during play.'}
          </div>
        )}
      </div>
    </section>
  );
}

function HomeWithLiveAlerts() {
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));
  const discordStatus = searchParams.get('discord');
  const summary = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const today = useGetTodayGames({ query: { queryKey: getGetTodayGamesQueryKey() } });
  const future = useGetFutureGames({ query: { queryKey: getGetFutureGamesQueryKey() } });
  const odds = useGetOdds({ query: { queryKey: getGetOddsQueryKey() } });
  const snipes = useGetSnipes(undefined, { query: { queryKey: getGetSnipesQueryKey() } });
  const [watchlist, setWatchlist] = useWatchlist();
  const data = summary.data as DashboardSummary | undefined;
  const oddsFeed = odds.data as OddsFeed | undefined;
  const topSnipes = (snipes.data as Snipe[] | undefined)?.slice(0, 5) || [];
  const todayGames = (today.data as Game[] | undefined) || [];
  const futureGames = (future.data as Game[] | undefined) || [];
  const modelLabel = oddsFeed?.configured ? 'Odds feed connected' : data?.modelVersion === 'data-only' ? 'Data-only mode' : data?.modelVersion || 'Awaiting feed';

  return <>
    <div className="terminal-grid relative mb-8 overflow-hidden rounded-2xl border border-border px-5 py-7 md:px-8 md:py-9">
      <div className="absolute right-[-4%] top-[-60%] h-[420px] w-[420px] rounded-full bg-secondary/10 blur-3xl" />
      <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <div className="mb-3 flex items-center gap-3"><span className="font-mono text-[10px] uppercase tracking-[.22em] text-primary">Session / 01</span><DataState state={data?.dataStatus?.state} message={data?.dataStatus?.message} compact /></div>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-[.95] tracking-[-.065em] text-foreground md:text-6xl">Find the edge.<br /><span className="text-primary">Respect the noise.</span></h1>
          <p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground">A compact read on tonight&apos;s NHL markets. High-conviction signals stay loud; missing inputs stay visible.</p>
        </div>
        <div className="flex w-full flex-col gap-3 md:max-w-[390px]">
          <LiveAlertsPanel />
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[.16em] text-primary">Model build</p>
            <p className="mt-2 text-xl font-bold">{modelLabel}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{oddsFeed?.configured ? 'Sportsbook odds connected; model feed not configured' : 'Sportsbook odds and model feed not configured'}</p>
          </div>
        </div>
      </div>
    </div>
    <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Games on slate" value={data?.games ?? '—'} note="Today, scheduled" icon={CalendarDays} />
      <StatCard label="Live snipes" value={data?.snipes ?? '—'} note="Ranked player edges" accent="purple" icon={Target} />
      <StatCard label="Players scanned" value={data?.playersAnalyzed ?? '—'} note="Across active markets" accent="pink" icon={Users} />
      <StatCard label="Top confidence" value={data?.topConfidence || '—'} note="Best current signal" icon={Sparkles} />
    </div>
    <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
      <section className="signal-shadow rounded-xl border border-border bg-card/70 p-5 md:p-6">
        <div className="mb-5 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Market pulse</p><h2 className="mt-1 text-lg font-bold tracking-[-.03em]">Today&apos;s games</h2></div><Link data-testid="link-all-games" href="/matchups" className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary">Open lab <ArrowUpRight size={13} /></Link></div>
        <QueryState loading={today.isLoading} error={today.isError} empty={!today.isLoading && !today.isError && todayGames.length === 0} onRetry={() => today.refetch()}><div className="space-y-2">{todayGames.slice(0, 5).map((game) => <GameRow game={game} key={game.id} />)}</div></QueryState>
      </section>
      <section className="signal-shadow rounded-xl border border-border bg-card/70 p-5 md:p-6">
        <div className="mb-5 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-secondary">Next slate</p><h2 className="mt-1 text-lg font-bold tracking-[-.03em]">Future games</h2></div><span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{futureGames[0] ? shortDate(futureGames[0].gameDate) : 'Date pending'}</span></div>
        <QueryState loading={future.isLoading} error={future.isError} empty={!future.isLoading && !future.isError && futureGames.length === 0} onRetry={() => future.refetch()}><div className="space-y-2">{futureGames.slice(0, 5).map((game) => <GameRow game={game} key={game.id} />)}</div></QueryState>
      </section>
    </div>
    <section className="mt-6 rounded-xl border border-border bg-card/70 p-5 md:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-accent">Odds by book</p><h2 className="mt-1 text-lg font-bold tracking-[-.03em]">Sportsbook odds</h2></div><span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{oddsFeed?.configured ? 'The Odds API' : 'Not connected'}</span></div><OddsPanel feed={oddsFeed} loading={odds.isLoading} error={odds.isError} onRetry={() => odds.refetch()} /></section>
    <section className="mt-6 rounded-xl border border-border bg-card/70 p-5 md:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-accent">Performance</p><h2 className="mt-1 text-lg font-bold tracking-[-.03em]">Model ledger</h2></div><Link data-testid="link-audit" href="/audit" className="text-xs font-semibold text-muted-foreground hover:text-primary">View audit</Link></div>{data?.marketPerformance?.length ? <div className="space-y-3">{data.marketPerformance.slice(0, 5).map((metric) => <PerformanceRow key={metric.market} metric={metric} />)}</div> : <EmptyState title="Performance pending" body="Historical market performance will appear after scored records land." icon={BarChart3} />}</section>
    <section className="mt-6 rounded-xl border border-border bg-card/70 p-5 md:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-accent">Signal queue</p><h2 className="mt-1 text-lg font-bold tracking-[-.03em]">Highest conviction edges</h2></div><Link data-testid="link-snipes" href="/snipes" className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary">Rank all <ArrowUpRight size={13} /></Link></div><QueryState loading={snipes.isLoading} error={snipes.isError} empty={!snipes.isLoading && !snipes.isError && topSnipes.length === 0} onRetry={() => snipes.refetch()}><div>{topSnipes.map((snipe) => <SnipeRow key={snipe.id} snipe={snipe} watchlist={watchlist} onWatch={setWatchlist} />)}</div></QueryState></section>
  </>;
}

function Home() {
  const summary = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const today = useGetTodayGames({ query: { queryKey: getGetTodayGamesQueryKey() } });
  const future = useGetFutureGames({ query: { queryKey: getGetFutureGamesQueryKey() } });
  const snipes = useGetSnipes(undefined, { query: { queryKey: getGetSnipesQueryKey() } });
  const [watchlist, setWatchlist] = useWatchlist();
  const data = summary.data as DashboardSummary | undefined;
  const topSnipes = (snipes.data as Snipe[] | undefined)?.slice(0, 5) || [];
  const todayGames = (today.data as Game[] | undefined) || [];
  const futureGames = (future.data as Game[] | undefined) || [];
  const modelLabel = data?.modelVersion === 'data-only' ? 'Data-only mode' : data?.modelVersion || 'Awaiting feed';
  return <><div className="terminal-grid relative mb-8 overflow-hidden rounded-2xl border border-border px-5 py-7 md:px-8 md:py-9"><div className="absolute right-[-4%] top-[-60%] h-[420px] w-[420px] rounded-full bg-secondary/10 blur-3xl" /><div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><div className="mb-3 flex items-center gap-3"><span className="font-mono text-[10px] uppercase tracking-[.22em] text-primary">Session / 01</span><DataState state={data?.dataStatus?.state} message={data?.dataStatus?.message} compact /></div><h1 className="max-w-3xl text-4xl font-extrabold leading-[.95] tracking-[-.065em] text-foreground md:text-6xl">Find the edge.<br /><span className="text-primary">Respect the noise.</span></h1><p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground">A compact read on tonight's NHL markets. High-conviction signals stay loud; missing inputs stay visible.</p></div><div className="rounded-xl border border-primary/20 bg-primary/5 p-4 md:min-w-[220px]"><p className="font-mono text-[10px] uppercase tracking-[.16em] text-primary">Model build</p><p className="mt-2 text-xl font-bold">{modelLabel}</p><p className="mt-1 text-[11px] text-muted-foreground">{data?.modelVersion === 'data-only' ? 'Odds and model feed not configured' : data?.dataStatus?.lastUpdated ? `Updated ${time(data.dataStatus.lastUpdated)}` : 'No update timestamp'}</p></div></div></div><div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><StatCard label="Games on slate" value={data?.games ?? '—'} note="Today, scheduled" icon={CalendarDays} /><StatCard label="Live snipes" value={data?.snipes ?? '—'} note="Ranked player edges" accent="purple" icon={Target} /><StatCard label="Players scanned" value={data?.playersAnalyzed ?? '—'} note="Across active markets" accent="pink" icon={Users} /><StatCard label="Top confidence" value={data?.topConfidence || '—'} note="Best current signal" icon={Sparkles} /></div><div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]"><section className="signal-shadow rounded-xl border border-border bg-card/70 p-5 md:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Market pulse</p><h2 className="mt-1 text-lg font-bold tracking-[-.03em]">Today's games</h2></div><Link data-testid="link-all-games" href="/matchups" className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary">Open lab <ArrowUpRight size={13} /></Link></div><QueryState loading={today.isLoading} error={today.isError} empty={!today.isLoading && !today.isError && todayGames.length === 0} onRetry={() => today.refetch()}><div className="space-y-2">{todayGames.slice(0, 5).map((game) => <GameRow game={game} key={game.id} />)}</div></QueryState></section><section className="signal-shadow rounded-xl border border-border bg-card/70 p-5 md:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-secondary">Next slate</p><h2 className="mt-1 text-lg font-bold tracking-[-.03em]">Future games</h2></div><span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{futureGames[0] ? shortDate(futureGames[0].gameDate) : 'Date pending'}</span></div><QueryState loading={future.isLoading} error={future.isError} empty={!future.isLoading && !future.isError && futureGames.length === 0} onRetry={() => future.refetch()}><div className="space-y-2">{futureGames.slice(0, 5).map((game) => <GameRow game={game} key={game.id} />)}</div></QueryState></section></div><section className="mt-6 rounded-xl border border-border bg-card/70 p-5 md:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-accent">Performance</p><h2 className="mt-1 text-lg font-bold tracking-[-.03em]">Model ledger</h2></div><Link data-testid="link-audit" href="/audit" className="text-xs font-semibold text-muted-foreground hover:text-primary">View audit</Link></div>{data?.marketPerformance?.length ? <div className="space-y-3">{data.marketPerformance.slice(0, 5).map((metric) => <PerformanceRow key={metric.market} metric={metric} />)}</div> : <EmptyState title="Performance pending" body="Historical market performance will appear after scored records land." icon={BarChart3} />}</section><section className="mt-6 rounded-xl border border-border bg-card/70 p-5 md:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-accent">Signal queue</p><h2 className="mt-1 text-lg font-bold tracking-[-.03em]">Highest conviction edges</h2></div><Link data-testid="link-snipes" href="/snipes" className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary">Rank all <ArrowUpRight size={13} /></Link></div><QueryState loading={snipes.isLoading} error={snipes.isError} empty={!snipes.isLoading && !snipes.isError && topSnipes.length === 0} onRetry={() => snipes.refetch()}><div>{topSnipes.map((snipe) => <SnipeRow key={snipe.id} snipe={snipe} watchlist={watchlist} onWatch={setWatchlist} />)}</div></QueryState></section></>;
}

function oddsPrice(price: number, point: number | null) {
  const line = point === null ? '' : ` ${point > 0 ? '+' : ''}${point}`;
  return `${line} ${price > 0 ? '+' : ''}${price}`;
}

function OddsPanel({ feed, loading, error, onRetry }: { feed?: OddsFeed; loading: boolean; error: boolean; onRetry: () => void }) {
  if (loading) return <div className="mt-6 grid gap-3 md:grid-cols-2"><div className="h-40 animate-pulse rounded-xl border border-border bg-card/70" /><div className="h-40 animate-pulse rounded-xl border border-border bg-card/70" /></div>;
  if (error) return <div className="mt-6 rounded-xl border border-destructive/25 bg-destructive/5 p-6"><p className="font-semibold">Sportsbook odds unavailable</p><p className="mt-1 text-sm text-muted-foreground">The odds provider did not answer. No prices were filled in by assumption.</p><button onClick={onRetry} className="mt-4 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary/40">Retry odds feed</button></div>;
  if (!feed?.games.length) return <div className="mt-6 rounded-xl border border-dashed border-border bg-card/50 p-6"><p className="font-semibold">{feed?.configured ? 'No verified sportsbook prices yet' : 'Sportsbook odds not configured'}</p><p className="mt-1 text-sm text-muted-foreground">{feed?.configured ? 'The Odds API is connected, but it has not returned prices that match a verified NHL game on the current slate.' : 'Add a sportsbook odds provider to populate this section.'}</p></div>;
  return <div className="mt-6 grid gap-4 lg:grid-cols-2">{feed.games.map(({ game, sportsbooks }) => <div data-testid={`card-odds-game-${game.id}`} key={game.id} className="rounded-xl border border-border bg-card/70 p-5"><div className="mb-4 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-accent">Sportsbook market</p><h3 className="mt-1 text-base font-bold">{game.awayTeam.abbreviation} at {game.homeTeam.abbreviation}</h3><p className="mt-1 text-[10px] text-muted-foreground">{shortDate(game.gameDate)} · {time(game.gameDate)}</p></div><span className="font-mono text-[10px] uppercase text-muted-foreground">{sportsbooks.length} books</span></div><div className="space-y-3">{sportsbooks.map((book) => <div data-testid={`card-sportsbook-${book.key}`} key={book.key} className="rounded-lg border border-border/70 bg-muted/30 p-3"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold">{book.title}</span><span className="font-mono text-[9px] uppercase text-muted-foreground">{book.lastUpdate ? 'updated' : 'live feed'}</span></div><div className="space-y-2">{book.markets.map((market) => <div key={market.key} className="flex items-center justify-between gap-3"><span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{market.label}</span><div className="flex flex-wrap justify-end gap-2">{market.outcomes.map((outcome) => <span key={`${market.key}-${outcome.name}`} className="rounded border border-primary/20 bg-primary/5 px-2 py-1 text-[10px] text-foreground">{outcome.name} <b className="ml-1 text-primary">{oddsPrice(outcome.price, outcome.point)}</b></span>)}</div></div>)}</div></div>)}</div></div>)}</div>;
}

function HomeWithOdds() {
  const summary = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const today = useGetTodayGames({ query: { queryKey: getGetTodayGamesQueryKey() } });
  const future = useGetFutureGames({ query: { queryKey: getGetFutureGamesQueryKey() } });
  const odds = useGetOdds({ query: { queryKey: getGetOddsQueryKey() } });
  const snipes = useGetSnipes(undefined, { query: { queryKey: getGetSnipesQueryKey() } });
  const [watchlist, setWatchlist] = useWatchlist();
  const data = summary.data as DashboardSummary | undefined;
  const oddsFeed = odds.data as OddsFeed | undefined;
  const topSnipes = (snipes.data as Snipe[] | undefined)?.slice(0, 5) || [];
  const todayGames = (today.data as Game[] | undefined) || [];
  const futureGames = (future.data as Game[] | undefined) || [];
  const modelLabel = oddsFeed?.configured ? 'Odds feed connected' : data?.modelVersion === 'data-only' ? 'Data-only mode' : data?.modelVersion || 'Awaiting feed';
  return <><div className="terminal-grid relative mb-8 overflow-hidden rounded-2xl border border-border px-5 py-7 md:px-8 md:py-9"><div className="absolute right-[-4%] top-[-60%] h-[420px] w-[420px] rounded-full bg-secondary/10 blur-3xl" /><div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><div className="mb-3 flex items-center gap-3"><span className="font-mono text-[10px] uppercase tracking-[.22em] text-primary">Session / 01</span><DataState state={data?.dataStatus?.state} message={data?.dataStatus?.message} compact /></div><h1 className="max-w-3xl text-4xl font-extrabold leading-[.95] tracking-[-.065em] text-foreground md:text-6xl">Find the edge.<br /><span className="text-primary">Respect the noise.</span></h1><p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground">A compact read on tonight's NHL markets. High-conviction signals stay loud; missing inputs stay visible.</p></div><div className="rounded-xl border border-primary/20 bg-primary/5 p-4 md:min-w-[220px]"><p className="font-mono text-[10px] uppercase tracking-[.16em] text-primary">Model build</p><p className="mt-2 text-xl font-bold">{modelLabel}</p><p className="mt-1 text-[11px] text-muted-foreground">{oddsFeed?.configured ? 'Sportsbook odds connected; model feed not configured' : 'Sportsbook odds and model feed not configured'}</p></div></div></div><div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><StatCard label="Games on slate" value={data?.games ?? '—'} note="Today, scheduled" icon={CalendarDays} /><StatCard label="Live snipes" value={data?.snipes ?? '—'} note="Ranked player edges" accent="purple" icon={Target} /><StatCard label="Players scanned" value={data?.playersAnalyzed ?? '—'} note="Across active markets" accent="pink" icon={Users} /><StatCard label="Top confidence" value={data?.topConfidence || '—'} note="Best current signal" icon={Sparkles} /></div><div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]"><section className="signal-shadow rounded-xl border border-border bg-card/70 p-5 md:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Market pulse</p><h2 className="mt-1 text-lg font-bold tracking-[-.03em]">Today's games</h2></div><Link data-testid="link-all-games" href="/matchups" className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary">Open lab <ArrowUpRight size={13} /></Link></div><QueryState loading={today.isLoading} error={today.isError} empty={!today.isLoading && !today.isError && todayGames.length === 0} onRetry={() => today.refetch()}><div className="space-y-2">{todayGames.slice(0, 5).map((game) => <GameRow game={game} key={game.id} />)}</div></QueryState></section><section className="signal-shadow rounded-xl border border-border bg-card/70 p-5 md:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-secondary">Next slate</p><h2 className="mt-1 text-lg font-bold tracking-[-.03em]">Future games</h2></div><span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{futureGames[0] ? shortDate(futureGames[0].gameDate) : 'Date pending'}</span></div><QueryState loading={future.isLoading} error={future.isError} empty={!future.isLoading && !future.isError && futureGames.length === 0} onRetry={() => future.refetch()}><div className="space-y-2">{futureGames.slice(0, 5).map((game) => <GameRow game={game} key={game.id} />)}</div></QueryState></section></div><section className="mt-6 rounded-xl border border-border bg-card/70 p-5 md:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-accent">Odds by book</p><h2 className="mt-1 text-lg font-bold tracking-[-.03em]">Sportsbook odds</h2></div><span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{oddsFeed?.configured ? 'The Odds API' : 'Not connected'}</span></div><OddsPanel feed={oddsFeed} loading={odds.isLoading} error={odds.isError} onRetry={() => odds.refetch()} /></section><section className="mt-6 rounded-xl border border-border bg-card/70 p-5 md:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-accent">Performance</p><h2 className="mt-1 text-lg font-bold tracking-[-.03em]">Model ledger</h2></div><Link data-testid="link-audit" href="/audit" className="text-xs font-semibold text-muted-foreground hover:text-primary">View audit</Link></div>{data?.marketPerformance?.length ? <div className="space-y-3">{data.marketPerformance.slice(0, 5).map((metric) => <PerformanceRow key={metric.market} metric={metric} />)}</div> : <EmptyState title="Performance pending" body="Historical market performance will appear after scored records land." icon={BarChart3} />}</section><section className="mt-6 rounded-xl border border-border bg-card/70 p-5 md:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-accent">Signal queue</p><h2 className="mt-1 text-lg font-bold tracking-[-.03em]">Highest conviction edges</h2></div><Link data-testid="link-snipes" href="/snipes" className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary">Rank all <ArrowUpRight size={13} /></Link></div><QueryState loading={snipes.isLoading} error={snipes.isError} empty={!snipes.isLoading && !snipes.isError && topSnipes.length === 0} onRetry={() => snipes.refetch()}><div>{topSnipes.map((snipe) => <SnipeRow key={snipe.id} snipe={snipe} watchlist={watchlist} onWatch={setWatchlist} />)}</div></QueryState></section></>;
}

function PerformanceRow({ metric }: { metric: ModelPerformance }) {
  return <div data-testid={`row-performance-${metric.market}`} className="flex items-center gap-3"><div className="w-20 text-xs font-semibold capitalize">{metric.market}</div><div className="h-2 flex-1 rounded-full bg-muted"><div className="h-full rounded-full bg-secondary" style={{ width: `${Math.min((metric.hitRate || 0) * 100, 100)}%` }} /></div><div className="w-12 text-right font-mono text-xs text-secondary">{pct(metric.hitRate)}</div><div className="w-16 text-right text-[10px] text-muted-foreground">{metric.sampleSize} n</div></div>;
}

function useWatchlist(): [string[], (id: string) => void] {
  const [items, setItems] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('nhlsnipes-watchlist') || '[]'); } catch { return []; } });
  const toggle = (id: string) => setItems((current) => { const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id]; localStorage.setItem('nhlsnipes-watchlist', JSON.stringify(next)); return next; });
  return [items, toggle];
}

function SnipesPage() {
  const query = useGetSnipes(undefined, { query: { queryKey: getGetSnipesQueryKey() } });
  const [market, setMarket] = useState<Market>('all');
  const [watchlist, setWatchlist] = useWatchlist();
  const rows = ((query.data as Snipe[] | undefined) || []).filter((snipe) => market === 'all' || (market === 'goals' && snipe.goalProbability !== null) || (market === 'sog' && snipe.sogProjection !== null) || (market === 'points' && snipe.pointProbability !== null));
  return <><PageHeader eyebrow="Ranked signal / live board" title="Snipes" copy="A ranked queue of player edges. Each row carries the model's reasoning instead of hiding behind a single score." action={<button data-testid="button-refresh-snipes" onClick={() => query.refetch()} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary/40 hover:text-primary"><RefreshCw size={14} />Refresh</button>} /><div className="mb-5 flex gap-2 overflow-x-auto pb-1">{markets.map((item) => <button data-testid={`button-market-${item}`} key={item} onClick={() => setMarket(item)} className={`whitespace-nowrap rounded-lg border px-3 py-2 text-[11px] font-semibold capitalize transition-colors ${market === item ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>{item === 'all' ? 'All signals' : item}</button>)}</div><div className="rounded-xl border border-border bg-card/70 p-5 md:p-6"><div className="mb-4 hidden grid-cols-[1.6fr_1fr_1fr_1fr_auto] gap-4 border-b border-border pb-3 font-mono text-[9px] uppercase tracking-[.15em] text-muted-foreground md:grid"><span>Player / matchup</span><span>Confidence</span><span>Projection</span><span>Model edge</span><span>Context</span></div><QueryState loading={query.isLoading} error={query.isError} empty={!query.isLoading && !query.isError && rows.length === 0} onRetry={() => query.refetch()}><div>{rows.map((snipe) => <SnipeRow key={snipe.id} snipe={snipe} watchlist={watchlist} onWatch={setWatchlist} />)}</div></QueryState></div></>;
}

function PropsPage() {
  const all = useGetProps(undefined, { query: { queryKey: getGetPropsQueryKey() } });
  const rows = (all.data as Prop[] | undefined) || [];
  const topEdges = rows.filter(p => p.edge && p.edge > 0.05).slice(0, 10);
  
  return <>
    <PageHeader 
      eyebrow="Today's Top Edges / AI Predictions" 
      title="Player Props" 
      copy="AI-generated goal probabilities matched with live DraftKings odds. Edge = Model Probability - Implied Odds Probability." 
      action={<Link data-testid="link-snipes-from-props" href="/snipes" className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">All Snipes <ArrowUpRight size={14} /></Link>} 
    />
    
    {topEdges.length > 0 && (
      <div className="mb-8 rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-secondary/5 p-6">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp size={20} className="text-primary" />
          <h2 className="text-xl font-bold">Top 10 Edges Today</h2>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">
          Players with the highest calculated edge based on AI probability vs sportsbook odds
        </p>
        <div className="space-y-3">
          {topEdges.map((prop, index) => <TopEdgeCard key={prop.id} prop={prop} rank={index + 1} />)}
        </div>
      </div>
    )}

    <div className="mb-6 flex items-center gap-2 text-[11px] text-muted-foreground">
      <Info size={14} className="text-secondary" />
      Showing {rows.length} player predictions. {rows.filter(p => p.lineStatus === 'available').length} have live odds.
    </div>
    
    <QueryState loading={all.isLoading} error={all.isError} empty={!all.isLoading && !all.isError && rows.length === 0} onRetry={() => all.refetch()}>
      <div className="space-y-2">{rows.map((prop) => <PropCard key={prop.id} prop={prop} />)}</div>
    </QueryState>
  </>;
}

function TopEdgeCard({ prop, rank }: { prop: Prop; rank: number }) {
  const available = prop.lineStatus === 'available';
  const americanOdds = prop.line !== null ? (prop.line > 0 ? `+${Math.round(prop.line)}` : Math.round(prop.line).toString()) : '—';
  
  return (
    <div data-testid={`card-top-edge-${prop.id}`} className="grid gap-4 rounded-lg border-2 border-primary/20 bg-card p-4 transition-all hover:border-primary/40 hover:shadow-lg md:grid-cols-[auto_1.5fr_1fr_1fr_1fr_auto] md:items-center">
      <div className="flex items-center justify-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 font-bold text-primary">
          #{rank}
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <PlayerImage player={prop.player} size="md" />
        <div>
          <Link data-testid={`link-prop-player-${prop.player.id}`} href={`/players/${prop.player.id}`} className="text-base font-bold hover:text-primary">
            {prop.player.fullName}
          </Link>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {prop.player.team.abbreviation} vs {prop.opponent.abbreviation}
          </p>
        </div>
      </div>
      
      <div>
        <p className="font-mono text-[10px] uppercase text-muted-foreground">AI Probability</p>
        <p className="mt-1 text-xl font-bold text-primary">{pct(prop.overProbability)}</p>
        <p className="text-[9px] text-muted-foreground">to score a goal</p>
      </div>
      
      <div>
        <p className="font-mono text-[10px] uppercase text-muted-foreground">DraftKings Odds</p>
        <p className={`mt-1 text-xl font-bold ${available ? 'text-foreground' : 'text-muted-foreground'}`}>
          {available ? americanOdds : 'N/A'}
        </p>
        <p className="text-[9px] text-muted-foreground">{available ? prop.source || 'sportsbook' : 'not available'}</p>
      </div>
      
      <div>
        <p className="font-mono text-[10px] uppercase text-muted-foreground">Edge</p>
        <p className="mt-1 text-2xl font-bold text-accent">{pct(prop.edge)}</p>
        <p className="text-[9px] text-muted-foreground">model advantage</p>
      </div>
      
      <div className="flex flex-col gap-2 md:items-end">
        <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
          prop.confidence === 'ELITE' ? 'border-accent/40 bg-accent/10 text-accent' :
          prop.confidence === 'STRONG' ? 'border-primary/40 bg-primary/10 text-primary' :
          prop.confidence === 'MODERATE' ? 'border-secondary/40 bg-secondary/10 text-secondary' :
          'border-border text-muted-foreground'
        }`}>
          {prop.confidence || 'WATCH'}
        </span>
      </div>
    </div>
  );
}

function PropCard({ prop }: { prop: Prop }) {
  const available = prop.lineStatus === 'available';
  const americanOdds = prop.line !== null ? (prop.line > 0 ? `+${Math.round(prop.line)}` : Math.round(prop.line).toString()) : '—';
  
  return <div data-testid={`card-prop-${prop.id}`} className="grid gap-4 rounded-xl border border-border bg-card/70 p-4 transition-colors hover:border-secondary/40 md:grid-cols-[1.5fr_.9fr_.9fr_.8fr_auto] md:items-center"><div className="flex items-center gap-3"><PlayerImage player={prop.player} size="md" /><div><Link data-testid={`link-prop-player-${prop.player.id}`} href={`/players/${prop.player.id}`} className="text-sm font-bold hover:text-primary">{prop.player.fullName}</Link><p className="mt-1 text-[10px] text-muted-foreground">{prop.player.team.abbreviation} vs {prop.opponent.abbreviation} · {prop.market}</p></div></div><div><p className="font-mono text-[10px] uppercase text-muted-foreground">AI Probability</p><p className="mt-1 text-lg font-bold text-primary">{pct(prop.overProbability)}</p></div><div><p className="font-mono text-[10px] uppercase text-muted-foreground">DK Odds</p><p className={`mt-1 text-lg font-bold ${available ? 'text-foreground' : 'text-muted-foreground'}`}>{available ? americanOdds : 'N/A'}</p></div><div><p className="font-mono text-[10px] uppercase text-muted-foreground">Edge</p><p className={`mt-1 text-lg font-bold ${prop.edge && prop.edge > 0 ? 'text-accent' : 'text-muted-foreground'}`}>{pct(prop.edge)}</p></div><div className="flex items-center gap-2 md:justify-end"><span className={`rounded-full border px-2 py-1 text-[9px] uppercase tracking-wider ${available ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>{available ? 'live' : 'no odds'}</span><span className={`rounded-full px-2 py-1 text-[9px] uppercase ${prop.confidence === 'ELITE' || prop.confidence === 'STRONG' ? 'bg-accent/10 text-accent' : 'bg-secondary/10 text-secondary'}`}>{prop.confidence || 'watch'}</span></div></div>;
}

function MatchupsPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const selectedGameId = params.get('game') || '';
  const query = useGetMatchups({ query: { queryKey: getGetMatchupsQueryKey() } });
  const gamesQuery = useGetGames(undefined, { query: { queryKey: getGetGamesQueryKey() } });
  const selectedQuery = useGetMatchup(selectedGameId, {
    query: { enabled: Boolean(selectedGameId), queryKey: getGetMatchupQueryKey(selectedGameId) },
  });
  const rows = (query.data as Matchup[] | undefined) || [];
  const selected = selectedQuery.data as MatchupDetail | undefined;
  if (selectedGameId) {
    return <><PageHeader eyebrow="Matchup lab / player context" title={selected ? `${selected.game.awayTeam.abbreviation} at ${selected.game.homeTeam.abbreviation}` : 'Selected matchup'} copy="Both rosters are loaded for this game. Season stats stay attached to the players that are available from the NHL feed." action={<Link href="/matchups" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary/40 hover:text-primary">All matchups</Link>} /><QueryState loading={selectedQuery.isLoading} error={selectedQuery.isError} empty={!selectedQuery.isLoading && !selectedQuery.isError && !selected} onRetry={() => selectedQuery.refetch()}>{selected && <SelectedMatchup matchup={selected} />}</QueryState></>;
  }
  return <><PageHeader eyebrow="Matchup lab / environment" title="Matchups" copy="Read the game environment before you read the player market: pace, special teams, goaltending and shot creation." action={<span data-testid="text-games-indexed" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{gamesQuery.data ? `${(gamesQuery.data as Game[]).length} games indexed` : 'Index pending'}</span>} /><QueryState loading={query.isLoading} error={query.isError} empty={!query.isLoading && !query.isError && rows.length === 0} onRetry={() => query.refetch()}><div className="grid gap-4 lg:grid-cols-2">{rows.map((matchup) => <MatchupCard key={matchup.game.id} matchup={matchup} />)}</div></QueryState></>;
}

function SelectedMatchup({ matchup }: { matchup: MatchupDetail }) {
  const { game, away, home } = matchup;
  return <div className="space-y-6">
    <section className="signal-shadow rounded-xl border border-border bg-card/70 p-5 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">{shortDate(game.gameDate)} · {time(game.gameDate)}</span>
        <span className={`rounded-full px-2 py-1 text-[9px] uppercase ${game.status === 'live' ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'}`}>{game.status}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-1 flex-col items-center gap-2"><TeamMark team={away.team} size="lg" /><p className="text-sm font-bold">{away.team.name}</p><p className="font-mono text-xs text-muted-foreground">away</p></div>
        <div className="text-center">
          {game.status === 'live' || game.status === 'final' ? (
            <>
              <div className="flex items-center gap-4">
                <div className="font-mono text-4xl font-bold">{game.awayScore ?? 0}</div>
                <div className="text-muted-foreground">-</div>
                <div className="font-mono text-4xl font-bold">{game.homeScore ?? 0}</div>
              </div>
              {game.status === 'live' && (
                <div className="mt-2 text-[10px] uppercase tracking-widest text-accent">
                  {game.period} {game.clock ? `· ${game.clock}` : ''}
                </div>
              )}
            </>
          ) : (
            <div className="font-mono text-2xl font-medium text-secondary">{fmt(game.matchupScore)}</div>
          )}
          <div className="mt-1 text-[9px] uppercase tracking-widest text-muted-foreground">{game.status === 'live' || game.status === 'final' ? 'score' : 'matchup score'}</div>
        </div>
        <div className="flex flex-1 flex-col items-center gap-2"><TeamMark team={home.team} size="lg" /><p className="text-sm font-bold">{home.team.name}</p><p className="font-mono text-xs text-muted-foreground">home</p></div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-2 border-t border-border pt-4 md:grid-cols-4">{[['Goal env.', game.goalEnvironment], ['Shot env.', game.shotEnvironment], ['PP edge', game.powerPlayEdge], ['Goalie', game.goaltendingEdge]].map(([label, value]) => <div key={String(label)} className="text-center"><p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-sm font-bold">{fmt(value as number | null)}</p></div>)}</div>
    </section>
    <div className="grid gap-6 xl:grid-cols-2">
      <RosterStats team={away.team} players={away.players} side="Away" />
      <RosterStats team={home.team} players={home.players} side="Home" />
    </div>
  </div>;
}

function RosterStats({ team, players, side }: { team: Team; players: MatchupPlayer[]; side: string }) {
  return <section data-testid={`section-roster-${team.abbreviation}`} className="rounded-xl border border-border bg-card/70 p-5 md:p-6">
    <div className="mb-5 flex items-center justify-between"><div className="flex items-center gap-3"><TeamMark team={team} size="md" /><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-primary">{side} roster</p><h2 className="mt-1 text-lg font-bold">{team.name}</h2></div></div><span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{players.length} players</span></div>
    {players.length ? <div className="space-y-2">{players.map((player) => <MatchupPlayerCard key={player.id} player={player} />)}</div> : <EmptyState title="Roster unavailable" body="No players were returned for this team." icon={Users} />}
  </section>;
}

function MatchupPlayerCard({ player }: { player: MatchupPlayer }) {
  const stats = player.seasonStats;
  return <div data-testid={`card-matchup-player-${player.id}`} className="grid gap-3 rounded-lg border border-border/70 bg-muted/30 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
    <div className="flex min-w-0 items-center gap-3"><PlayerImage player={player} size="sm" /><div className="min-w-0"><Link href={`/players/${player.id}`} className="truncate text-sm font-bold hover:text-primary">{player.fullName}</Link><p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{player.position} · #{player.jerseyNumber ?? '—'}</p></div></div>
    {stats ? <div className="grid grid-cols-5 gap-3 text-center"><div><p className="font-mono text-[9px] text-muted-foreground">GP</p><p className="mt-1 text-xs font-bold">{stats.games}</p></div><div><p className="font-mono text-[9px] text-muted-foreground">G</p><p className="mt-1 text-xs font-bold">{stats.goals}</p></div><div><p className="font-mono text-[9px] text-muted-foreground">A</p><p className="mt-1 text-xs font-bold">{stats.assists}</p></div><div><p className="font-mono text-[9px] text-muted-foreground">PTS</p><p className="mt-1 text-xs font-bold text-primary">{stats.points}</p></div><div><p className="font-mono text-[9px] text-muted-foreground">SOG</p><p className="mt-1 text-xs font-bold">{stats.sog}</p></div></div> : <span className="text-right text-[10px] text-muted-foreground">Stats unavailable</span>}
  </div>;
}

function MatchupCard({ matchup }: { matchup: Matchup }) {
  const { game, away, home } = matchup;
  const showLiveScore = game.status === 'live' || game.status === 'final';
  return <Link data-testid={`card-matchup-${game.id}`} href={`/matchups?game=${game.id}`} className="group rounded-xl border border-border bg-card/70 p-5 hover:border-secondary/40"><div className="mb-5 flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">{shortDate(game.gameDate)} · {time(game.gameDate)}</span><span className={`rounded-full px-2 py-1 text-[9px] uppercase ${game.status === 'live' ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'}`}>{game.status}</span></div><div className="flex items-center justify-between gap-4"><div className="flex flex-1 flex-col items-center gap-2"><TeamMark team={away.team} size="lg" /><p className="text-sm font-bold">{away.team.name}</p><p className="font-mono text-xs text-muted-foreground">away</p></div><div className="text-center">{showLiveScore ? (<><div className="flex items-center gap-3"><div className="font-mono text-3xl font-bold">{game.awayScore ?? 0}</div><div className="text-muted-foreground">-</div><div className="font-mono text-3xl font-bold">{game.homeScore ?? 0}</div></div>{game.status === 'live' && game.period && (<div className="mt-1 text-[9px] uppercase text-accent">{game.period} {game.clock ? `· ${game.clock}` : ''}</div>)}</>) : (<><div className="font-mono text-2xl font-medium text-secondary">{fmt(game.matchupScore)}</div><div className="mt-1 text-[9px] uppercase tracking-widest text-muted-foreground">matchup score</div></>)}</div><div className="flex flex-1 flex-col items-center gap-2"><TeamMark team={home.team} size="lg" /><p className="text-sm font-bold">{home.team.name}</p><p className="font-mono text-xs text-muted-foreground">home</p></div></div><div className="mt-6 grid grid-cols-4 gap-2 border-t border-border pt-4">{[['Goal env.', game.goalEnvironment], ['Shot env.', game.shotEnvironment], ['PP edge', game.powerPlayEdge], ['Goalie', game.goaltendingEdge]].map(([label, value]) => <div key={String(label)} className="text-center"><p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-sm font-bold">{fmt(value as number | null)}</p></div>)}</div></Link>;
}

function GoaliesPage() {
  const query = useGetGoalies({ query: { queryKey: getGetGoaliesQueryKey() } });
  const rows = (query.data as Goalie[] | undefined) || [];
  return <><PageHeader eyebrow="Goalie lab / confirmation first" title="Goalies" copy="Projected save environments with confirmation status front and center. Unknown is a state, not a projection." action={<button data-testid="button-refresh-goalies" onClick={() => query.refetch()} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary/40 hover:text-primary"><RefreshCw size={14} />Refresh</button>} /><QueryState loading={query.isLoading} error={query.isError} empty={!query.isLoading && !query.isError && rows.length === 0} onRetry={() => query.refetch()}><div className="grid gap-3 lg:grid-cols-2">{rows.map((goalie) => <GoalieCard key={goalie.id} goalie={goalie} />)}</div></QueryState></>;
}
function GoalieCard({ goalie }: { goalie: Goalie }) {
  const opponent = goalie.opponent ?? undefined;
  return <div data-testid={`card-goalie-${goalie.id}`} className="rounded-xl border border-border bg-card/70 p-5"><div className="flex items-start justify-between"><div className="flex items-center gap-3"><PlayerImage id={goalie.id} name={goalie.fullName} headshotUrl={goalie.headshotUrl} size="md" /><div><h3 className="font-bold">{goalie.fullName}</h3><p className="mt-1 text-[10px] text-muted-foreground">{goalie.team.abbreviation} vs {opponent?.abbreviation || 'TBD'}</p></div></div><span className={`rounded-full border px-2 py-1 text-[9px] uppercase tracking-wider ${goalie.status === 'confirmed' ? 'border-primary/30 bg-primary/10 text-primary' : 'border-secondary/30 bg-secondary/10 text-secondary'}`}>{goalie.status}</span></div><div className="mt-5 flex items-center gap-3 border-t border-border/70 pt-4"><TeamCrest team={goalie.team} size="sm" /><span className="text-[10px] uppercase tracking-wider text-muted-foreground">projected starter</span><TeamCrest team={opponent} size="sm" className="ml-auto" /><span className="text-[10px] uppercase tracking-wider text-muted-foreground">{opponent ? 'opponent' : 'opponent TBD'}</span></div><div className="mt-5 grid grid-cols-3 gap-3">{[['Proj saves', fmt(goalie.projectedSaves)], ['Shots against', fmt(goalie.projectedShotsAgainst)], ['SV%', pct(goalie.savePercentage)]].map(([label, value]) => <div key={label} className="rounded-lg bg-muted/70 p-3"><p className="font-mono text-[9px] uppercase text-muted-foreground">{label}</p><p className="mt-1 text-base font-bold">{value}</p></div>)}</div><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-muted-foreground"><span>Win probability <b className="ml-1 text-foreground">{pct(goalie.winProbability)}</b></span><span>30+ saves <b className="ml-1 text-foreground">{pct(goalie.saves30Plus)}</b></span><span>Shutout <b className="ml-1 text-foreground">{pct(goalie.shutoutProbability)}</b></span></div></div>;
}

function PlayersPage() {
  const [search, setSearch] = useState('');
  const playerParams = search ? { search } : undefined;
  const query = useGetPlayers(playerParams, { query: { queryKey: getGetPlayersQueryKey(playerParams) } });
  const rows = (query.data as Player[] | undefined) || [];
  return <><PageHeader eyebrow="Player index / searchable" title="Players" copy="Move from a market edge to the underlying player record. Search stays server-backed and exact." action={<div className="relative"><Search size={15} className="absolute left-3 top-2.5 text-muted-foreground" /><input data-testid="input-player-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search player" className="w-52 rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-xs outline-none placeholder:text-muted-foreground focus:border-primary/60" /></div>} /><QueryState loading={query.isLoading} error={query.isError} empty={!query.isLoading && !query.isError && rows.length === 0} onRetry={() => query.refetch()}><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{rows.map((player) => <PlayerCard key={player.id} player={player} />)}</div></QueryState></>;
}
function PlayerCard({ player }: { player: Player }) {
  return <Link data-testid={`card-player-${player.id}`} href={`/players/${player.id}`} className="group flex items-center gap-3 rounded-xl border border-border bg-card/70 p-4 hover:border-primary/40"><PlayerImage player={player} size="md" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold group-hover:text-primary">{player.fullName}</p><p className="mt-1 text-[10px] text-muted-foreground">{player.team.name} · {player.position}{player.jerseyNumber ? ` · #${player.jerseyNumber}` : ''}</p></div><TeamCrest team={player.team} size="xs" /><ChevronRight size={15} className="text-muted-foreground group-hover:text-primary" /></Link>;
}

function PlayerDetailPage() {
  const params = useParams<{ playerId: string }>();
  const query = useGetPlayer(params.playerId || '', { query: { enabled: !!params.playerId, queryKey: getGetPlayerQueryKey(params.playerId || '') } });
  const player = query.data as PlayerDetail | undefined;
  return <><PageHeader eyebrow="Player detail / evidence" title={player?.fullName || 'Player detail'} copy={player ? `${player.team.name} · ${player.position}. Season context, recent form and model-visible splits.` : 'Loading the player record without filling missing fields.'} action={player ? <Link data-testid="link-player-team" href={`/teams/${player.team.id}`} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary/40">Open team <ArrowUpRight size={14} /></Link> : undefined} /><QueryState loading={query.isLoading} error={query.isError} empty={!query.isLoading && !query.isError && !player} onRetry={() => query.refetch()}>{player && <div className="space-y-6"><div className="relative overflow-hidden rounded-xl border border-primary/25 bg-card/70 p-5 md:p-7"><div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-primary/[.08] to-transparent" /><div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center"><PlayerImage player={player} size="hero" /><div className="min-w-0"><div className="mb-2 flex items-center gap-2"><TeamCrest team={player.team} size="xs" /><p className="font-mono text-[10px] uppercase tracking-[.16em] text-primary">{player.team.abbreviation} / {player.position}</p></div><h2 className="text-3xl font-bold tracking-[-.04em]">{player.fullName}</h2><p className="mt-2 text-xs text-muted-foreground">#{player.jerseyNumber || '—'} · provider headshot {player.headshotUrl ? 'verified' : 'not supplied'}</p></div></div></div><StatTable title="Season snapshot" lines={[player.seasonStats]} /><StatTable title="Recent form" lines={player.recentStats} /><StatTable title="Splits" lines={player.splits} /></div>}</QueryState></>;
}
function StatTable({ title, lines }: { title: string; lines: { label: string; games: number; goals: number; sog: number; points: number; assists: number; toi: number; ppToi: number }[] }) {
  return <section className="rounded-xl border border-border bg-card/70 p-5 md:p-6"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold">{title}</h2><span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{lines.length} rows</span></div>{lines.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground"><tr>{['Window', 'GP', 'G', 'SOG', 'PTS', 'A', 'TOI', 'PP TOI'].map((header) => <th key={header} className="border-b border-border px-3 py-3">{header}</th>)}</tr></thead><tbody>{lines.map((line, index) => <tr data-testid={`row-stat-${title}-${index}`} key={`${line.label}-${index}`} className="border-b border-border/60 last:border-0"><td className="px-3 py-3 font-semibold">{line.label}</td><td className="px-3 py-3 font-mono">{line.games}</td><td className="px-3 py-3 font-mono">{line.goals}</td><td className="px-3 py-3 font-mono">{line.sog}</td><td className="px-3 py-3 font-mono text-primary">{line.points}</td><td className="px-3 py-3 font-mono">{line.assists}</td><td className="px-3 py-3 font-mono">{fmt(line.toi)}</td><td className="px-3 py-3 font-mono">{fmt(line.ppToi)}</td></tr>)}</tbody></table></div> : <EmptyState title="No split data" body="The provider returned no records for this window." />}</section>;
}

function TeamsPage() {
  const query = useGetTeams({ query: { queryKey: getGetTeamsQueryKey() } });
  const rows = (query.data as Team[] | undefined) || [];
  return <><PageHeader eyebrow="Team index / vulnerability" title="Teams" copy="A quick map of team profiles, vulnerabilities and the environments that shape tonight's markets." /><QueryState loading={query.isLoading} error={query.isError} empty={!query.isLoading && !query.isError && rows.length === 0} onRetry={() => query.refetch()}><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{rows.map((team) => <Link data-testid={`card-team-${team.id}`} href={`/teams/${team.id}`} key={team.id} className="group rounded-xl border border-border bg-card/70 p-4 hover:border-accent/40"><div className="flex items-center gap-3"><TeamMark team={team} /><div className="min-w-0 flex-1"><p className="text-sm font-bold group-hover:text-primary">{team.name}</p><p className="mt-1 text-[10px] text-muted-foreground">{team.conference || 'Conference unavailable'} · {team.division || 'Division unavailable'}</p></div><ChevronRight size={15} className="text-muted-foreground group-hover:text-accent" /></div><div className="mt-4 flex items-center justify-between border-t border-border pt-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><span>{team.abbreviation}</span><span>{team.logoUrl ? 'identity ready' : 'identity partial'}</span></div></Link>)}</div></QueryState></>;
}

function TeamDetailPage() {
  const params = useParams<{ teamId: string }>();
  const query = useGetTeam(params.teamId || '', { query: { enabled: !!params.teamId, queryKey: getGetTeamQueryKey(params.teamId || '') } });
  const team = query.data as TeamDetail | undefined;
  const profile = team?.profile;
  return <><PageHeader eyebrow="Team detail / pressure map" title={team?.name || 'Team detail'} copy={team ? `${team.abbreviation} · ${team.conference || 'Conference unavailable'} · ${team.division || 'Division unavailable'}.` : 'Loading team profile.'} action={team ? <Link data-testid="link-team-roster" href="/players" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary/40">View player index</Link> : undefined} /><QueryState loading={query.isLoading} error={query.isError} empty={!query.isLoading && !query.isError && !team} onRetry={() => query.refetch()}>{team && <div className="space-y-6"><div className="relative overflow-hidden rounded-xl border border-border bg-card/70 p-5 md:p-7"><div className="absolute inset-y-0 right-0 w-2/3 opacity-30" style={{ background: `radial-gradient(circle at 70% 45%, ${team.primaryColor || '#b9ff46'}55, transparent 58%)` }} /><div className="relative flex flex-col gap-5 sm:flex-row sm:items-center"><TeamCrest team={team} size="hero" /><div><p className="font-mono text-[10px] uppercase tracking-wider text-primary">{team.abbreviation} / vulnerability map</p><h2 className="mt-2 text-3xl font-bold tracking-[-.04em]">{team.city ? `${team.city} ${team.name}` : team.name}</h2><p className="mt-2 text-xs text-muted-foreground">{team.conference || 'Conference unavailable'} · {team.division || 'Division unavailable'} · provider crest {team.logoUrl ? 'verified' : 'not supplied'}</p></div></div><div className="relative mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Offense', profile?.offense], ['Defense', profile?.defense], ['Goaltending', profile?.goaltending], ['Expected goals', profile?.expectedGoals], ['Power play', profile?.powerPlay], ['Penalty kill', profile?.penaltyKill], ['Shot generation', profile?.shotGeneration], ['Shot suppression', profile?.shotSuppression]].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-muted/60 p-3"><div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground"><span>{label}</span><span className="font-mono text-foreground">{fmt(value as number | null)}</span></div><div className="mt-3 h-1.5 rounded-full bg-background"><div className="h-full rounded-full bg-gradient-to-r from-secondary to-primary" style={{ width: `${Math.min(Number(value || 0), 100)}%` }} /></div></div>)}</div></div><section className="rounded-xl border border-border bg-card/70 p-5"><h2 className="mb-4 font-bold">Roster surface</h2><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{team.roster?.map((player) => <PlayerCard key={player.id} player={player} />)}</div></section></div>}</QueryState></>;
}

function WatchlistPage() {
  const [watchlist, setWatchlist] = useWatchlist();
  const query = useGetPlayers(undefined, { query: { queryKey: getGetPlayersQueryKey() } });
  const players = ((query.data as Player[] | undefined) || []).filter((player) => watchlist.includes(player.id));
  return <><PageHeader eyebrow="Browser local / personal board" title="Watchlist" copy="A private browser-persisted shortlist. Nothing syncs to the server, and removing a name is immediate." action={<button data-testid="button-clear-watchlist" onClick={() => watchlist.forEach((id) => setWatchlist(id))} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-destructive/40 hover:text-destructive"><X size={14} />Clear all</button>} /><QueryState loading={query.isLoading} error={query.isError} empty={!query.isLoading && !query.isError && players.length === 0} onRetry={() => query.refetch()}>{<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{players.map((player) => <div key={player.id} className="relative"><PlayerCard player={player} /><button data-testid={`button-remove-watch-${player.id}`} onClick={() => setWatchlist(player.id)} className="absolute right-3 top-3 rounded-md p-1 text-primary hover:bg-primary/10"><Star size={14} fill="currentColor" /></button></div>)}</div>}</QueryState></>;
}

function AuditPage() {
  const audit = useGetAudit({ query: { queryKey: getGetAuditQueryKey() } });
  const performance = useGetModelPerformance({ query: { queryKey: getGetModelPerformanceQueryKey() } });
  const rows = (audit.data as AuditRecord[] | undefined) || [];
  const metrics = (performance.data as ModelPerformance[] | undefined) || [];
  return <><PageHeader eyebrow="Transparent history / no hindsight" title="Audit trail" copy="Immutable prediction metadata, result state and aggregate model performance. The ledger is where confidence earns its keep." action={<Link data-testid="link-audit-health" href="/admin" className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary/40"><Database size={14} />Data health</Link>} /><div className="mb-6 grid gap-3 sm:grid-cols-3">{metrics.slice(0, 3).map((metric) => <StatCard key={metric.market} label={`${metric.market} hit rate`} value={pct(metric.hitRate)} note={`${metric.sampleSize} scored records`} accent="purple" icon={TrendingUp} />)}</div><section className="rounded-xl border border-border bg-card/70 p-5 md:p-6"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold">Prediction records</h2><span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{rows.length} visible</span></div><QueryState loading={audit.isLoading} error={audit.isError} empty={!audit.isLoading && !audit.isError && rows.length === 0} onRetry={() => audit.refetch()}><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground"><tr>{['Created', 'Player', 'Market', 'Projection', 'Probability', 'Model', 'Result'].map((header) => <th key={header} className="border-b border-border px-3 py-3">{header}</th>)}</tr></thead><tbody>{rows.map((record) => <tr data-testid={`row-audit-${record.id}`} key={record.id} className="border-b border-border/60 last:border-0"><td className="px-3 py-3 text-muted-foreground">{shortDate(record.createdAt)}</td><td className="px-3 py-3 font-semibold">{record.playerName}</td><td className="px-3 py-3 capitalize">{record.market} {record.line !== null ? <span className="font-mono text-muted-foreground">{record.line}</span> : null}</td><td className="px-3 py-3 font-mono">{fmt(record.projection)}</td><td className="px-3 py-3 font-mono">{pct(record.probability)}</td><td className="px-3 py-3 font-mono text-muted-foreground">{record.modelVersion}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[9px] uppercase ${record.result === 'hit' ? 'bg-primary/10 text-primary' : record.result === 'miss' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>{record.result}</span></td></tr>)}</tbody></table></div></QueryState></section></>;
}

function AdminPage() {
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey() } });
  const summary = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const dataHealth = useDataHealth();
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const status = health.data as { status: string } | undefined;
  const data = summary.data as DashboardSummary | undefined;
  const runSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const response = await fetch('/api/admin/sync', { method: 'POST', headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`Sync failed with HTTP ${response.status}`);
      const result = await response.json() as { teamsImported: number; gamesImported: number; playersImported: number };
      setSyncMessage(`Imported ${result.teamsImported} teams, ${result.gamesImported} games, and ${result.playersImported} players.`);
      await Promise.all([dataHealth.refetch(), summary.refetch(), health.refetch()]);
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };
  const runChecks = async () => {
    setChecking(true);
    setSyncMessage(null);
    try {
      await Promise.all([health.refetch(), summary.refetch(), dataHealth.refetch()]);
      setSyncMessage('Checks complete — the API is reachable. No import was run.');
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : 'Checks failed');
    } finally {
      setChecking(false);
    }
  };
  const imported = dataHealth.data;
  return <><PageHeader eyebrow="Operations / provider sync" title="Data health" copy="Run a real NHL synchronization, inspect the last successful import, and see which data layers are still unavailable." action={<div className="flex flex-wrap gap-2"><button data-testid="button-sync-nhl-data" onClick={runSync} disabled={syncing} className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-50"><RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />{syncing ? 'Syncing NHL data' : 'Sync NHL data'}</button><button data-testid="button-refresh-health" onClick={runChecks} disabled={checking} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary/40 hover:text-primary disabled:opacity-50"><RefreshCw size={14} className={checking ? 'animate-spin' : ''} />{checking ? 'Checking provider' : 'Run checks'}</button></div>} />{syncMessage && <div className="mb-5 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-xs text-primary">{syncMessage}</div>}<div className="grid gap-4 lg:grid-cols-2"><section className="rounded-xl border border-border bg-card/70 p-5 md:p-6"><div className="mb-6 flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><Activity size={17} /></div><div><h2 className="font-bold">API heartbeat</h2><p className="text-xs text-muted-foreground">Provider reachability</p></div><span className={`ml-auto rounded-full border px-2 py-1 text-[9px] uppercase ${health.isError ? 'border-destructive/30 text-destructive' : 'border-primary/30 text-primary'}`}>{health.isLoading ? 'checking' : health.isError ? 'error' : status?.status || 'ready'}</span></div><div className="space-y-3 text-sm"><div className="flex justify-between border-b border-border/70 pb-3"><span className="text-muted-foreground">Endpoint</span><span className="font-mono text-xs">/api/healthz</span></div><div className="flex justify-between border-b border-border/70 pb-3"><span className="text-muted-foreground">Last response</span><span className="font-mono text-xs">{health.data ? 'reachable' : '—'}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Failure policy</span><span className="text-xs text-secondary">missing inputs stay visible</span></div></div></section><section className="rounded-xl border border-border bg-card/70 p-5 md:p-6"><div className="mb-6 flex items-center gap-3"><div className="rounded-lg bg-secondary/10 p-2 text-secondary"><Database size={17} /></div><div><h2 className="font-bold">NHL Web API</h2><p className="text-xs text-muted-foreground">Official schedule and roster source</p></div><span className={`ml-auto rounded-full border px-2 py-1 text-[9px] uppercase ${imported?.connection === 'connected' ? 'border-destructive/30 text-primary' : 'border-destructive/30 text-destructive'}`}>{imported?.connection || 'checking'}</span></div><div className="space-y-3 text-sm"><div className="flex justify-between border-b border-border/70 pb-3"><span className="text-muted-foreground">Last successful sync</span><span className="font-mono text-xs">{imported?.lastSuccessfulSync ? time(imported.lastSuccessfulSync) : 'Never completed'}</span></div><div className="flex justify-between border-b border-border/70 pb-3"><span className="text-muted-foreground">Last attempted sync</span><span className="font-mono text-xs">{imported?.lastAttemptedSync ? time(imported.lastAttemptedSync) : 'No sync attempted'}</span></div><p className="rounded-lg bg-muted/70 p-3 text-xs leading-5">{data?.dataStatus.message || 'No provider message available.'}</p></div></section></div><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[['Teams', imported?.teamsImported], ['Games', imported?.gamesImported], ['Players', imported?.playersImported], ['Player stats', imported?.playerStatsImported], ['Goalie stats', imported?.goalieStatsImported]].map(([label, value]) => <StatCard key={String(label)} label={String(label)} value={value ?? '—'} note="Last sync import" accent={label === 'Player stats' || label === 'Goalie stats' ? 'purple' : 'green'} icon={Database} />)}</div><section className="mt-6 rounded-xl border border-border bg-card/70 p-5 md:p-6"><div className="mb-4 flex items-center gap-2"><Clock3 size={16} className="text-accent" /><h2 className="font-bold">Data boundaries</h2></div><div className="grid gap-3 md:grid-cols-3">{[['Available now', 'Schedule, standings, team identities, active rosters, headshots, and player landing statistics.'], ['Not provided', 'Sportsbook odds and model snipes remain unavailable until an authorized odds/model feed is connected.'], ['Traceability', 'Unknown fields remain unknown and every sync reports its imported counts.']].map(([label, text]) => <div key={label} className="rounded-lg border border-border/70 bg-muted/40 p-4"><p className="font-mono text-[10px] uppercase tracking-wider text-accent">{label}</p><p className="mt-2 text-sm leading-5 text-muted-foreground">{text}</p></div>)}</div></section></>;
}

function GameDetailRoute() {
  const params = useParams<{ gameId: string }>();
  const query = useGetGame(params.gameId || '', { query: { enabled: !!params.gameId, queryKey: getGetGameQueryKey(params.gameId || '') } });
  const game = query.data as Game | undefined;
  return <><PageHeader eyebrow="Game detail / environment" title={game ? `${game.awayTeam.abbreviation} at ${game.homeTeam.abbreviation}` : 'Game detail'} copy={game?.venue || 'Game-level notes and environment.'} /><QueryState loading={query.isLoading} error={query.isError} empty={!query.isLoading && !query.isError && !game} onRetry={() => query.refetch()}>{game && <div className="rounded-xl border border-border bg-card/70 p-6"><div className="flex items-start justify-center gap-5"><div className="flex flex-col items-center gap-2"><TeamMark team={game.awayTeam} size="lg" /><p className="text-center text-sm font-bold">{game.awayTeam.name}</p><p className="font-mono text-[10px] uppercase text-muted-foreground">away</p></div><span className="mt-7 font-mono text-muted-foreground">@</span><div className="flex flex-col items-center gap-2"><TeamMark team={game.homeTeam} size="lg" /><p className="text-center text-sm font-bold">{game.homeTeam.name}</p><p className="font-mono text-[10px] uppercase text-muted-foreground">home</p></div></div><div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">{[['Matchup', game.matchupScore], ['Goals', game.goalEnvironment], ['Shots', game.shotEnvironment], ['PP', game.powerPlayEdge], ['Goalie', game.goaltendingEdge]].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-muted/60 p-3 text-center"><p className="font-mono text-[9px] uppercase text-muted-foreground">{label}</p><p className="mt-1 text-lg font-bold">{fmt(value as number | null)}</p></div>)}</div></div>}</QueryState></>;
}

function Router() {
  return <ErrorBoundary><AppShell><Switch><Route path="/" component={HomeWithLiveAlerts} /><Route path="/snipes" component={SnipesPage} /><Route path="/props" component={PropsPage} /><Route path="/matchups" component={MatchupsPage} /><Route path="/goalies" component={GoaliesPage} /><Route path="/players" component={PlayersPage} /><Route path="/players/:playerId" component={PlayerDetailPage} /><Route path="/teams" component={TeamsPage} /><Route path="/teams/:teamId" component={TeamDetailPage} /><Route path="/watchlist" component={WatchlistPage} /><Route path="/audit" component={AuditPage} /><Route path="/admin" component={AdminPage} /><Route path="/games/:gameId" component={GameDetailRoute} /><Route component={NotFound} /></Switch></AppShell></ErrorBoundary>;
}

function App() {
  useEffect(() => { document.documentElement.classList.add('dark'); }, []);
  return <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter>;
}

export default App;