# Restaurant Control (3R)

Sistema para restaurantes y bares: mesas, pedidos, cocina y barra, caja, inventario y el tablero del dueño. **Es un
sistema aparte** de la tienda 3R (3rpaginas.com) y de la asistencia QR: tiene su propia base de datos, su propia clave y
su propio despliegue. No comparte código ni datos con ellos; solo el estilo visual (colores, tipografías y el león).

Nace de los bocetos de los módulos 01 al 13 que trajo Rigoberto (ZIP "Restaurant Control"). De ellos se tomaron las reglas
de negocio (una sola cuenta abierta por mesa, nada se borra, todo deja rastro, cocina y barra separadas…) y se reescribió
todo con la misma tecnología de la asistencia, para varios negocios a la vez desde el primer día.

## Módulos

| # | Módulo | Estado |
|---|--------|--------|
| 01 | Núcleo: negocios, sedes, equipo con código + PIN, roles, auditoría, plano de mesas, abrir/mover/cerrar mesas | Listo |
| 02 | Carta y pedidos (POS): rondas partidas en cocina y barra, notas, agotados, anulaciones con motivo | Listo |
| 03 | Pantallas de cocina y barra | Pendiente |
| 04 | Caja y pagos | Pendiente |
| 05–06 | Inventario, recetas y control de botellas | Pendiente |
| 07 | Gastos y finanzas | Pendiente |
| 08 | Tablero del dueño y radar de fugas | Pendiente |
| 09 | Sin internet (reintentos sin cobros dobles) | Pendiente |
| 10 | Facturación electrónica DIAN | Pendiente (falta elegir proveedor) |
| 11 | Reservas y menú QR | Pendiente |
| 12 | Resumen diario con IA | Pendiente |
| 13 | Servicios y citas (barberías) | Pendiente |

## Cómo funciona (módulo 01)

- **3R** entra a `/admin` con `ADMIN_PASSWORD` y crea cada negocio con su primera sede y su dueño (código `0001` y el PIN
  que se le ponga). Puede suspender un negocio: nadie de su equipo entra hasta reactivarlo.
- **El equipo** entra en `/n/{negocio}` (por ejemplo `/n/bar-la-ola`) con su **código de empleado** y su **PIN** (4 a 6
  números; no se aceptan PIN obvios como 1111 o 1234). Teclado grande para tablet y celular; también sirve el teclado del
  computador. 5 PIN equivocados seguidos bloquean a esa persona 15 minutos (o hasta que le cambien el PIN). La sesión dura
  14 horas. La portada recuerda el último negocio usado en ese aparato.
- **Roles** (fijos, revisados siempre en el servidor):
  - Dueño: todo, incluidas las sedes. Ve la auditoría de todas las sedes.
  - Administrador: plano, equipo (menos dueños y administradores) y auditoría de su sede.
  - Cajero: mesas y cierre de mesas.
  - Mesero: abre mesas, cambia personas o nota, pide la cuenta y pasa la cuenta a otra mesa. No cierra mesas.
  - Cocina y Barra: su pantalla (llega con el módulo 03).
- **Sedes:** cada una con su plano. Quien tiene sede fija entra siempre a la suya; quien trabaja en "todas" elige al entrar.
- **Plano** (`/app/plano`): mesas cuadradas, redondas o largas por zonas (Salón, Terraza…). Se arrastran y se cambian de
  tamaño; "Guardar plano". Una mesa se puede bloquear o quitar del plano (no se borra: su historial queda; si se crea otra
  con el mismo número, se recupera).
- **Mesas** (`/app`): el plano con colores (libre, ocupada, pidió la cuenta, bloqueada) y el tiempo de cada mesa, que se
  calcula desde la hora de apertura guardada. Más de 90 minutos se marca en rojo. Se actualiza solo cada 10 segundos.
  Una mesa no se puede abrir dos veces, ni aunque dos meseros toquen "Abrir" al mismo tiempo (lo impide la base de datos).
  Cerrar una mesa que no ha pedido la cuenta exige un motivo.
- **Equipo** (`/app/equipo`): el código de cada persona sale solo (0002, 0003…). Nadie se borra: se desactiva. Cambiar el
  PIN, el rol o la sede, o desactivar a alguien, cierra su sesión abierta de inmediato.
- **Auditoría** (`/app/auditoria`): entradas, PIN equivocados y bloqueos, mesas abiertas, movidas y cerradas (con motivo),
  cambios del plano, del equipo y de las sedes. La base de datos **no deja cambiar ni borrar** estos registros.

## Cómo funciona (módulo 02: carta y pedidos)

- **Carta** (`/app/carta`): categorías (cada una va a cocina o a barra) y productos con precio en pesos enteros. Un
  producto puede ir a otra estación que su categoría (por ejemplo, el agua en la categoría Platos pero a barra). La carta
  es la misma en todas las sedes. Nada se borra: se saca de la carta. Los cambios de precio quedan en la auditoría.
- **Agotado:** meseros y cajeros también pueden marcar "Se acabó" (son los primeros en saberlo); ya no se puede pedir hasta
  "Volvió a haber".
- **Tomar pedido** (`/app/mesa/{cuenta}`): al abrir una mesa se llega aquí. Se tocan productos (con buscador y categorías),
  se ajustan cantidades y notas ("sin cebolla") y "Enviar a cocina y barra". Cada envío es una **ronda**; cada ronda se
  parte sola en una comanda para cocina y otra para barra. El carrito queda guardado en el aparato si se cambia de pantalla.
- **No hay pedidos dobles:** cada carrito lleva un identificador; si el mismo envío llega dos veces (doble toque, internet
  que se cae y reintenta), se guarda una sola vez.
- **El precio se congela** al pedir: si después cambia la carta, la cuenta no cambia.
- **Anular** algo ya enviado: solo dueño o administrador, siempre con motivo. No se borra: queda tachado, con el motivo, y
  en la auditoría (con aviso si ya estaba en preparación).
- Una mesa **con consumo no se puede cerrar** sin cobrar (eso lo hace la caja, módulo 04). Pedir más con la cuenta pedida
  vuelve a dejar la mesa abierta.

## Publicarla (una sola vez)

1. **Base de datos (Neon):** crea una base nueva, aparte de la tienda y de la asistencia (por ejemplo un proyecto o base
   `restaurante`). Copia su cadena de conexión.
2. **Vercel:** *Add New → Project*, este mismo repositorio, **Root Directory** `restaurante`. Variables:
   - `DATABASE_URL`: la cadena del paso 1.
   - `ADMIN_PASSWORD`: la clave de 3R para `/admin`. Cambiarla cierra las sesiones de 3R.
   - `SESSION_SECRET`: texto largo al azar (40 letras y números). Cambiarlo cierra todas las sesiones.
3. Despliega. Entra a `https://<dirección>/admin`, crea el negocio y pásale al dueño su enlace `/n/...`, su código `0001` y su PIN.

Las tablas se crean solas la primera vez que la app usa la base.

## Desarrollo

```bash
cd restaurante
npm install
cp .env.example .env     # y pon una base local en DATABASE_URL
npm run dev              # http://localhost:3200
npm test                 # con TEST_DATABASE_URL (una base vacía) corre el flujo completo contra PostgreSQL
```

Para una base local sin Docker: desde la raíz, `npm run dev:db -w api` levanta PostgreSQL en el puerto 54329; crea ahí una
base `restaurante_test` y usa `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:54329/restaurante_test`.

Tiene su propio `package-lock.json`: no es un workspace de la raíz.

### Notas técnicas

- `lib/db.ts`: esquema (SQL) y conexión. `lib/store.ts`: todas las reglas (cada función recibe a quien hace la acción y
  revisa permiso, negocio y sede). `lib/permissions.ts`: roles y permisos. `lib/auth.ts`: cookies firmadas.
- La sesión del equipo lleva un número (`session_epoch`) que sube al cambiar PIN, rol o sede: así una cookie vieja deja de valer.
- Plata (desde el módulo 02): pesos enteros, nunca decimales.
