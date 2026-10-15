import { whatsappLink } from './whatsapp-button';

/** Lo que ve una empresa que entra a un módulo que no tiene activo. */
export function ModuleOff({ companyName, name, text }: { companyName: string; name: string; text: string }) {
  return (
    <div className="max-w-xl rounded-[28px] border border-white/[0.08] bg-card p-6">
      <h2 className="font-display text-[20px] font-semibold text-foreground">Tu empresa no tiene activo el módulo {name}</h2>
      <p className="mt-2 text-[15px] text-muted-foreground">{text}</p>
      <a
        href={whatsappLink(`Hola, quiero activar el módulo ${name} para ${companyName}`)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex rounded-full bg-primary px-6 py-3 text-[14.875px] font-medium text-primary-foreground"
      >
        Activarlo por WhatsApp
      </a>
    </div>
  );
}
