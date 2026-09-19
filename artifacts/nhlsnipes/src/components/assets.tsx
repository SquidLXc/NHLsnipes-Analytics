import { Shield, UserRound } from 'lucide-react';
import { useState } from 'react';
import type { Player, Team } from '@workspace/api-client-react';

type AssetSize = 'xs' | 'sm' | 'md' | 'lg' | 'hero';

const teamSizes: Record<AssetSize, string> = {
  xs: 'h-6 w-6 rounded-full text-[7px]',
  sm: 'h-8 w-8 rounded-full text-[8px]',
  md: 'h-10 w-10 rounded-full text-[9px]',
  lg: 'h-16 w-16 rounded-full text-[11px]',
  hero: 'h-28 w-28 rounded-full text-sm',
};

const playerSizes: Record<AssetSize, string> = {
  xs: 'h-7 w-7 rounded-md',
  sm: 'h-9 w-9 rounded-lg',
  md: 'h-11 w-11 rounded-xl',
  lg: 'h-16 w-16 rounded-2xl',
  hero: 'h-32 w-32 rounded-[1.75rem]',
};

function safeColor(color: string | null | undefined, fallback: string) {
  return color && /^#[0-9a-f]{3,8}$/i.test(color) ? color : fallback;
}

export function TeamCrest({ team, size = 'md', className = '' }: { team?: Team; size?: AssetSize; className?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const primary = safeColor(team?.primaryColor, '#b9ff46');
  const secondary = safeColor(team?.secondaryColor, '#23313b');
  const hasImage = Boolean(team?.logoUrl) && !failed;

  return (
    <span
      data-testid={`asset-team-${team?.id || 'unknown'}`}
      className={`asset-crest relative inline-flex shrink-0 items-center justify-center overflow-hidden border ${teamSizes[size]} ${className}`}
      style={{ borderColor: `${primary}99`, backgroundColor: `${secondary}cc`, color: primary }}
      title={team ? `${team.city ? `${team.city} ` : ''}${team.name}` : 'Team identity unavailable'}
    >
      {hasImage ? (
        <>
          {!loaded && <span className="asset-skeleton absolute inset-0" aria-hidden="true" />}
          <img
            src={team?.logoUrl || undefined}
            alt={team ? `${team.name} crest` : 'Team crest'}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => { setFailed(true); setLoaded(false); }}
            className={`relative z-[1] h-full w-full scale-[1.16] object-contain p-0 transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </>
      ) : (
        <span className="asset-crest-fallback relative z-[1] flex h-full w-full flex-col items-center justify-center gap-0.5" style={{ background: `linear-gradient(145deg, ${secondary}, ${primary}22)` }}>
          <Shield size={size === 'hero' ? 27 : size === 'lg' ? 19 : 13} strokeWidth={1.6} />
          <span className="font-mono font-medium tracking-[-.08em]">{team?.abbreviation || 'NHL'}</span>
        </span>
      )}
    </span>
  );
}

export function PlayerImage({ player, id, name, headshotUrl, size = 'md', className = '' }: { player?: Pick<Player, 'id' | 'fullName' | 'headshotUrl'>; id?: string; name?: string; headshotUrl?: string | null; size?: AssetSize; className?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const source = headshotUrl ?? player?.headshotUrl;
  const label = name ?? player?.fullName ?? 'Player identity unavailable';
  const hasImage = Boolean(source) && !failed;

  return (
    <span
      data-testid={`asset-player-${player?.id || id || 'unknown'}`}
      className={`asset-player relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-primary/20 bg-primary/[.06] ${playerSizes[size]} ${className}`}
      title={label}
    >
      {hasImage ? (
        <>
          {!loaded && <span className="asset-skeleton absolute inset-0" aria-hidden="true" />}
          <img
            src={source || undefined}
            alt={`${label} headshot`}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => { setFailed(true); setLoaded(false); }}
            className={`relative z-[1] h-full w-full object-cover transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </>
      ) : (
        <span className="asset-avatar-fallback relative z-[1] flex h-full w-full flex-col items-center justify-center gap-0.5 text-primary">
          <UserRound size={size === 'hero' ? 39 : size === 'lg' ? 23 : 16} strokeWidth={1.35} />
          <span className="font-mono text-[7px] uppercase tracking-[.16em]">NHLsnipes</span>
        </span>
      )}
    </span>
  );
}