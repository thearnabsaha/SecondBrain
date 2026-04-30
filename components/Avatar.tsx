interface AvatarProps {
  name: string;
  className?: string;
  size?: number;
}

/**
 * Deterministic gradient avatar with the person's initials.
 * Pure component, server-safe.
 */
export function Avatar({ name, className = "", size }: AvatarProps) {
  const initials = getInitials(name);
  const hue = hashHue(name);
  const style: React.CSSProperties = {
    background: `linear-gradient(135deg, hsl(${hue}, 75%, 60%), hsl(${(hue + 60) % 360}, 80%, 55%))`,
    ...(size
      ? { width: size, height: size, fontSize: size * 0.36, borderRadius: size * 0.25 }
      : null),
  };
  return (
    <div className={`avatar ${className}`} style={style} title={name}>
      {initials}
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 360;
}
