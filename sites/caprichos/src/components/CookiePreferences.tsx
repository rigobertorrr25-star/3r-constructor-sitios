import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { getCookiePreferences, setCookiePreferences, type CookiePreferences as CookiePrefs } from './CookieConsent';

interface CookiePreferencesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CookiePreferences({ open, onOpenChange }: CookiePreferencesProps) {
  const [preferences, setPreferences] = useState<CookiePrefs>({
    essential: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    if (open) {
      const stored = getCookiePreferences();
      if (stored) {
        setPreferences(stored);
      }
    }
  }, [open]);

  const handleSave = () => {
    setCookiePreferences(preferences);
    onOpenChange(false);
  };

  const cookieTypes = [
    {
      id: 'essential',
      name: 'Esenciales',
      description: 'Necesarias para que el sitio funcione. No se pueden desactivar.',
      disabled: true,
    },
    {
      id: 'analytics',
      name: 'Analíticas',
      description: 'Nos ayudan a entender cómo interactúan las visitantes con el sitio.',
      disabled: false,
    },
    {
      id: 'marketing',
      name: 'Marketing',
      description: 'Usadas para mostrar anuncios personalizados.',
      disabled: false,
    },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Preferencias de cookies</DialogTitle>
          <DialogDescription className="text-xs">
            Gestiona tus preferencias de cookies. Las esenciales no se pueden desactivar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {cookieTypes.map((cookie) => (
            <div key={cookie.id} className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs font-medium">{cookie.name}</p>
                <p className="text-[10px] text-muted-foreground">{cookie.description}</p>
              </div>
              <Switch
                checked={preferences[cookie.id]}
                onCheckedChange={(checked) =>
                  setPreferences((prev) => ({ ...prev, [cookie.id]: checked }))
                }
                disabled={cookie.disabled}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave}>
            Guardar preferencias
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
