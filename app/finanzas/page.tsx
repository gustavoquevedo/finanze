import { FINANZAS } from "@/components/nav-items";
import { SectionLinks } from "@/components/SectionHub";

export default function FinanzasPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Finanzas</h1>
      <SectionLinks section={FINANZAS} />
    </div>
  );
}
