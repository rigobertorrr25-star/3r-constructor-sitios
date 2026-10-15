import { ModuleOff } from '@/components/module-off';
import { atLeast, type CompanyRole } from '@/lib/companies';

/** Lo que se muestra si la empresa no tiene la tienda o la persona no la maneja (null = puede entrar). */
export function storeGate(company: { name: string; me: { role: CompanyRole }; modules: { key: string; enabled: boolean }[] }) {
  if (!company.modules.find((m) => m.key === 'store')?.enabled) {
    return (
      <ModuleOff
        companyName={company.name}
        name="Tienda online"
        text="Vende en línea con tu propio catálogo: carrito, cupones, domicilios y pedidos que te llegan también por WhatsApp."
      />
    );
  }
  if (!atLeast(company.me.role, 'supervisor')) {
    return (
      <p className="rounded-[28px] border border-white/[0.08] bg-card p-6 text-[15px] text-muted-foreground">
        La tienda la manejan los supervisores y administradores de la empresa.
      </p>
    );
  }
  return null;
}
