interface AvatarProps {
  name: string;
  className?: string;
  size?: number;
}

/**
 * Flat-color avatar with the person's initials. Hue is derived
 * deterministically from the name. No gradients.
 */
export function Avatar({ name, className = "", size = 40 }: AvatarProps) {
  const initials = getInitials(name);
  const hue = hashHue(name);
  const style: React.CSSProperties = {
    width: size,
    height: size,
    fontSize: Math.round(size * 0.36),
    borderRadius: Math.round(size * 0.25),
    backgroundColor: `hsl(${hue}, 55%, 42%)`,
  };
  return (
    <div className={`avatar-initials ${className}`} style={style} title={name}>
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
