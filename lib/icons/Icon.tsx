import {
  Baby, Banknote, Bike, Bitcoin, Book, Brush, Briefcase, Building2, Bus, Calculator, Car, ChartLine, ChartPie, Clapperboard,
  Coffee, Coins, Construction, CreditCard, Droplet, Dumbbell, Euro, Factory, FileSignature, FileText, Flame, Fuel, Gamepad2,
  Gem, Gift, Globe, GraduationCap, Hammer, HandCoins, Handshake, Heart, HeartPulse, Hotel, House, Key, Landmark, Laptop, Leaf,
  Lightbulb, Music, Package, PaintRoller, PartyPopper, PawPrint, Percent, PiggyBank, Pill, Plane, Plug, Receipt, Recycle,
  Scale, Scissors, Shield, ShieldCheck, Shirt, ShoppingBasket, ShoppingCart, ShowerHead, Smartphone, Sofa, Stethoscope, Store,
  Tag, Thermometer, Ticket, TrainFront, Trash2, TreePalm, TrendingDown, TrendingUp, Tv, Users, Utensils, Vault, Wallet, Wifi,
  Wine, Wrench, Zap, type LucideIcon,
} from "lucide-react";

/** Catalogue id → icon component. Every id in lib/icons/catalog.ts must be here (checked by a test). */
export const ICON_COMPONENTS: Record<string, LucideIcon> = {
  house: House, building: Building2, hotel: Hotel, key: Key, landmark: Landmark, "file-text": FileText,
  "file-signature": FileSignature, scale: Scale, shield: Shield, "shield-check": ShieldCheck, wrench: Wrench, hammer: Hammer,
  "paint-roller": PaintRoller, construction: Construction, sofa: Sofa, plug: Plug, zap: Zap, flame: Flame, droplet: Droplet,
  thermometer: Thermometer, "shower-head": ShowerHead, wifi: Wifi, smartphone: Smartphone, trash: Trash2, recycle: Recycle,
  lightbulb: Lightbulb, brush: Brush, wallet: Wallet, banknote: Banknote, coins: Coins, "piggy-bank": PiggyBank,
  "hand-coins": HandCoins, euro: Euro, "credit-card": CreditCard, receipt: Receipt, percent: Percent, calculator: Calculator,
  briefcase: Briefcase, handshake: Handshake, vault: Vault, "trending-up": TrendingUp, "trending-down": TrendingDown,
  "chart-line": ChartLine, "chart-pie": ChartPie, gem: Gem, bitcoin: Bitcoin, globe: Globe, factory: Factory, leaf: Leaf,
  "shopping-cart": ShoppingCart, "shopping-basket": ShoppingBasket, store: Store, utensils: Utensils, coffee: Coffee,
  wine: Wine, car: Car, fuel: Fuel, bus: Bus, "train-front": TrainFront, bike: Bike, plane: Plane, "tree-palm": TreePalm,
  "heart-pulse": HeartPulse, pill: Pill, stethoscope: Stethoscope, dumbbell: Dumbbell, shirt: Shirt, scissors: Scissors,
  gift: Gift, "party-popper": PartyPopper, ticket: Ticket, clapperboard: Clapperboard, tv: Tv, music: Music,
  gamepad: Gamepad2, book: Book, "graduation-cap": GraduationCap, baby: Baby, users: Users, "paw-print": PawPrint,
  laptop: Laptop, package: Package, tag: Tag, heart: Heart,
};

/**
 * Icon by catalogue id. Without an icon (or an unknown id) renders a neutral placeholder of the
 * same size, so lists stay aligned. Decorative: the name next to it carries the meaning.
 */
export function Icon({ name, className = "h-5 w-5" }: { name: string | null | undefined; className?: string }) {
  const Component = name ? ICON_COMPONENTS[name] : undefined;
  if (!Component) return <span aria-hidden className={`inline-block shrink-0 rounded-full bg-slate-100 ${className}`} />;
  return <Component aria-hidden className={`shrink-0 ${className}`} strokeWidth={1.75} />;
}
