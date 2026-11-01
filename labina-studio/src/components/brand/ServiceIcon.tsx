import {
  BookOpen,
  Cake,
  Camera,
  FaceSlightlySmiling,
  Heart,
  Moon,
  Package,
  Palette,
  Sparkles,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  camera: Camera,
  moon: Moon,
  smile: FaceSlightlySmiling,
  cake: Cake,
  users: Users,
  sparkles: Sparkles,
  package: Package,
  book: BookOpen,
  palette: Palette,
  heart: Heart,
  star: Star,
};

export function ServiceIcon({ name, className, strokeWidth = 1.6 }: { name: string; className?: string; strokeWidth?: number }) {
  const Icon = ICONS[name] ?? Camera;
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden />;
}
