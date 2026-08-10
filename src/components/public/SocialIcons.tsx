import { Instagram, Facebook, Youtube, Twitter, Music2, Globe, type LucideIcon } from 'lucide-react';
import { visibleSocials, type SocialKey } from '@/lib/brand';

const ICONS: Record<SocialKey, LucideIcon> = {
  instagram: Instagram,
  tiktok: Music2,
  facebook: Facebook,
  youtube: Youtube,
  x: Twitter,
  website: Globe,
};

const LABELS: Record<SocialKey, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  youtube: 'YouTube',
  x: 'X / Twitter',
  website: 'Website',
};

interface Props {
  variant?: 'pill' | 'icon';
  className?: string;
}

const SocialIcons = ({ variant = 'icon', className = '' }: Props) => {
  const items = visibleSocials();
  if (items.length === 0) return null;

  if (variant === 'pill') {
    return (
      <ul className={`flex flex-wrap gap-2 ${className}`}>
        {items.map(([key, link]) => {
          const Icon = ICONS[key];
          return (
            <li key={key}>
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/40 bg-surface/40 text-foreground/90 hover:border-primary/60 hover:text-primary transition-colors text-xs font-medium"
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{link.handle}</span>
              </a>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className={`flex items-center gap-2 ${className}`}>
      {items.map(([key, link]) => {
        const Icon = ICONS[key];
        return (
          <li key={key}>
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={`${LABELS[key]} — ${link.handle}`}
              title={`${LABELS[key]} · ${link.handle}`}
              className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-border/40 bg-surface/40 text-foreground/80 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
            >
              <Icon className="w-4 h-4" />
            </a>
          </li>
        );
      })}
    </ul>
  );
};

export default SocialIcons;
