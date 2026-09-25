# Caprichos — tienda virtual

Sitio de la tienda de moda femenina Caprichos (Cartagena). Catálogo local con pedidos por WhatsApp.

## Stack

- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui
- Zustand (carrito)

## Desarrollo

```sh
npm install
npm run dev
```

## Catálogo

Los productos viven en `src/data/products.ts`. Las fotos están en `public/products/` y el logo en `public/brand/logo.jpg`.

## Pedidos

No hay pasarela de pago ni checkout de Shopify: el carrito arma un mensaje de WhatsApp con el pedido (ver `src/lib/whatsapp.ts`) al número configurado en `WHATSAPP_NUMBER`.
