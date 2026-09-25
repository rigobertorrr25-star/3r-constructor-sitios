import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

const COOKIE_CONSENT_KEY = 'cookie-consent';

export type CookiePreferences = {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
};

const defaultPreferences: CookiePreferences = {
  essential: true,
  analytics: false,
  marketing: false,
};

export function getCookiePreferences(): CookiePreferences | null {
  const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function setCookiePreferences(prefs: CookiePreferences) {
  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(prefs));
}

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const prefs = getCookiePreferences();
    if (!prefs) {
      const timer = setTimeout(() => setIsVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    setCookiePreferences({
      essential: true,
      analytics: true,
      marketing: true,
    });
    setIsVisible(false);
  };

  const handleDecline = () => {
    setCookiePreferences(defaultPreferences);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-xl border border-border bg-background p-4 shadow-lg animate-fade-in">
      <button
        onClick={handleDecline}
        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
        aria-label="Cerrar"
      >
        <X className="h-3 w-3" />
      </button>
      <p className="mb-4 pr-4 text-xs text-muted-foreground">
        Usamos cookies para mejorar tu experiencia.{' '}
        <Link to="/cookies" className="underline hover:text-foreground">
          Saber más
        </Link>
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleDecline} className="flex-1 text-[10px]">
          Solo esenciales
        </Button>
        <Button size="sm" onClick={handleAcceptAll} className="flex-1 text-[10px]">
          Aceptar todas
        </Button>
      </div>
    </div>
  );
}
