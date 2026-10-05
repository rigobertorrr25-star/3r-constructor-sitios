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
| 03 | Pantallas de cocina y barra (nueva → preparando → lista → entregada), aviso de listo para llevar | Listo |
| 04 | Caja: turnos, cobro en partes y con varios medios, propina, descuentos, precuenta, cuadre | Listo |
| 05–06 | Inventario por sede, recetas que descuentan solas, compras, mermas, conteos y control de botellas | Listo |
| 07 | Gastos y estado de resultados (ventas, costo, mermas, faltantes, gastos y utilidad) | Listo |
| 08 | Tablero del dueño ("Control total") y radar de fugas con datos reales | Listo |
| 09 | Sin internet: pedidos y cobros quedan en el aparato y se reintentan solos, sin duplicarse | Listo |
| 10 | Factura electrónica: datos fiscales, impuesto, una factura por venta, exportación | Listo sin envío a la DIAN (falta elegir proveedor) |
| 11 | Reservas (del equipo y en línea), mesas reservadas en el plano, carta pública y QR | Listo |
| 12 | Resumen del día con IA (Claude) en el tablero, con plantilla si no hay llave | Listo (falta la llave) |
| 13 | Servicios y citas (barberías, peluquerías, spas) con cobro en la caja y comisiones | Listo |

## Cómo funciona (módulo 01)

- **3R** entra a `/admin` con `ADMIN_PASSWORD` y crea cada negocio con su primera sede y su dueño (código `0001` y el PIN
  que se le ponga). Puede suspender un negocio: nadie de su equipo entra hasta reactivarlo.
- **El equipo** entra en la portada (`/`): escoge su restaurante en la lista (solo salen los activos), **toca su
  nombre** (salen las personas activas, con su rol) y pone su **PIN**. También sirve el enlace directo `/n/{negocio}`
  (por ejemplo `/n/bar-la-ola`). Dos personas activas del mismo negocio no pueden llamarse igual. Cada persona tiene además
  un **código de empleado** interno (0001, 0002…) que se ve en Equipo y en la auditoría. El **PIN** es de 4 a 6
  números (no se aceptan PIN obvios como 1111 o 1234). Teclado grande para tablet y celular; también sirve el teclado del
  computador. 5 PIN equivocados seguidos bloquean a esa persona 15 minutos (o hasta que le cambien el PIN). La sesión dura
  14 horas. La portada deja escogido el último restaurante usado en ese aparato; si alguien tiene la sesión abierta, sale
  el aviso «Sesión abierta · Seguir» y otra persona puede entrar sin que la anterior salga. «Salir» vuelve a la portada.
- **Roles** (fijos, revisados siempre en el servidor):
  - Dueño: todo, incluidas las sedes. Ve la auditoría de todas las sedes.
  - Administrador: plano, equipo (menos dueños y administradores) y auditoría de su sede.
  - Cajero: mesas, pedidos, caja y cobro; descuentos hasta el límite del negocio (10 % por defecto).
  - Mesero: abre mesas, cambia personas o nota, pide la cuenta y pasa la cuenta a otra mesa. No cierra mesas.
  - Cocina y Barra: solo su pantalla (`/app/cocina` o `/app/barra`); al entrar llegan directo ahí.
  - Profesional (barbero, estilista…): su agenda y sus comisiones (`/app/agenda`).
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

## Cómo funciona (módulo 03: cocina y barra)

- `/app/cocina` y `/app/barra`, pensadas para una tablet en la pared: columnas **Nuevas**, **Preparando** y **Listas para
  llevar**, con letra grande, la nota de cada plato resaltada y el tiempo desde que llegó (amarillo a los 15 min, rojo a
  los 25). Se actualizan solas cada 5 segundos. Botón "Activar sonido": pita cuando llega una comanda nueva.
- Cada comanda avanza de a un paso (Empezar → Lista → Entregada). "↶" la devuelve un paso si fue un toque equivocado
  (queda en la auditoría). Las entregadas de la última hora se pueden recuperar ("No se entregó").
- Si anulan algo después de enviado, la comanda lo muestra tachado y con "Anulado"; si se anuló todo, "Entendido" la descarta.
- El menú muestra cuántas comandas nuevas tiene cada estación. El cocinero solo ve cocina; el de barra, solo barra; dueño y
  administrador, las dos.
- En **Mesas**, el mesero ve "Listo para llevar" (mesa, estación y qué es) y la mesa tiene un punto verde; al llevarlo toca
  "Entregado". En la pantalla del pedido, cada producto muestra si está enviado, preparando, listo o entregado.
- Se guardan las horas reales de inicio y de "lista" de cada comanda: el tablero del dueño (módulo 08) las usará para
  medir tiempos de preparación.

## Cómo funciona (módulo 04: caja y pagos)

- **Caja** (`/app/caja`, dueño, administrador y cajero): se abre con la **base** en efectivo; sin caja abierta no se
  cobra. Una sola caja abierta por sede. Muestra ventas del turno por medio de pago, propinas, descuentos, el **efectivo
  que debería haber** y las cuentas por cobrar (primero las que pidieron la cuenta).
- **Cobrar una mesa** (`/app/caja/mesa/{cuenta}`, también con "Cobrar" desde el plano o el pedido): consumo, descuentos,
  pagos y lo que falta. Medios: efectivo (calcula las vueltas), tarjeta (número de voucher) y transferencia (referencia).
  **Propina voluntaria** con el % sugerido del negocio (10 % por defecto), que se puede cambiar o quitar.
  **Dividir la cuenta** en 2 a 6 partes: cada pago es una parte y la última paga lo que falte. Cuando la cuenta queda en
  cero, la mesa se cierra sola. Un doble toque no cobra dos veces.
- **Descuentos** en % o en pesos, siempre con motivo: el cajero llega hasta el límite del negocio (sumando todos los
  descuentos de la cuenta); más, el dueño o el administrador. Se pueden quitar mientras la mesa esté abierta. Todo queda en
  la auditoría.
- **Reversar un pago** (dueño o administrador, con motivo, mientras su caja siga abierta): si ese pago había cerrado la
  mesa, la mesa vuelve a quedar abierta con la cuenta pedida. Con la caja ya cerrada, la devolución se registra como salida.
- **Entradas y salidas de efectivo** que no son ventas (cambio, pago del hielo, retiro del dueño), con motivo. No deja
  sacar más de lo que debería haber.
- **Cerrar caja:** se cuenta el efectivo y queda la diferencia (cuadra, sobra o falta) en el **cuadre del turno**
  (`/app/caja/turno/{id}`) y en la auditoría.
- **Precuenta** (`/cuenta/{cuenta}`) para imprimir en impresora de tirilla o carta: consumo, descuentos, propina sugerida y
  total. Dice que la propina es voluntaria y que no es una factura (la factura electrónica llega con el módulo 10).
- Una mesa con saldo por pagar no se cierra a mano; con cortesía total (saldo cero) sí.

## Cómo funciona (módulos 05 y 06: inventario, recetas y botellas)

- **Insumos** (`/app/inventario`): se miden en gramos, mililitros o unidades. Un licor puede declararse **botella** (por
  ejemplo 750 ml) y entonces se cuenta en botellas. Cada insumo tiene un **mínimo**: por debajo aparece la alerta.
- La **existencia** de cada sede es la suma de sus movimientos: compras, ventas, devoluciones por anulación, mermas y
  conteos. **Ningún movimiento se puede cambiar ni borrar** (lo impide la base de datos); un error se corrige con un conteo.
- **Compra:** cantidad y valor pagado; el costo del insumo pasa a ser el promedio ponderado.
- **Receta** (desde la Carta, botón "Receta"): lo que gasta una unidad vendida (60 ml de ron + 8 g de hierbabuena). Muestra
  el costo de insumos y el **margen** del producto; la carta también muestra costo y margen de cada producto.
- **Cada venta descuenta sola** la receta al enviarse a cocina o barra. Si se anula antes de que la cocina lo empiece, los
  insumos vuelven; si ya se estaba preparando, se quedan gastados (es merma real).
- **Merma** (se cayó, se dañó, se venció), siempre con motivo: la pueden registrar también cocina y barra.
- **Conteo físico / control de botellas:** se escribe lo que hay de verdad (en botellas: 2,36 = dos llenas y 36 % de otra)
  y queda la diferencia contra lo que el sistema esperaba: lo que falta es la **fuga** (por ejemplo, "faltan 270 ml de
  whisky"), con su valor en pesos, en el historial del insumo y en la auditoría.
- Cocina y barra ven las existencias y registran mermas; dueño y administrador manejan todo y ven costos y valor del inventario.

## Cómo funciona (módulo 07: gastos y finanzas)

- **Finanzas** (`/app/finanzas`, dueño y administrador): periodo rápido (hoy, ayer, 7 días, este mes, mes pasado) o fechas
  a mano. El dueño elige una sede o todas; el administrador ve la suya.
- **Estado de resultados:** ventas cobradas (sin propinas: son del equipo) − costo de lo vendido (lo que descontaron las
  recetas) = utilidad bruta; − mermas − faltantes de los conteos + sobrantes − gastos = **utilidad operativa**. También:
  ticket promedio por mesa y por persona, cómo pagaron, lo más vendido, ventas por día (gráfica con vista de tabla) y, para
  informar, descuentos dados y lo anulado.
- **Gastos:** tipo (proveedores, nómina, arriendo, servicios, mantenimiento, publicidad, impuestos, otros), valor, fecha,
  proveedor. "Lo pagué con la plata de la caja" lo saca de la caja abierta (y revisa que alcance). Anular un gasto exige
  motivo; si había salido de la caja y esa caja sigue abierta, la plata vuelve a la caja.
- Las fechas son días del negocio en su zona horaria (Colombia), no del servidor.

## Cómo funciona (módulo 08: tablero del dueño y radar de fugas)

- **Control total** (`/app/tablero`, dueño y administrador; el dueño llega directo aquí al entrar): ventas, costo de
  productos, utilidad operativa y caja esperada, con mesas abiertas y lo que tienen por cobrar. Periodo: hoy, ayer, 7 días
  o el mes; el dueño elige sede o todas. Se actualiza cada minuto.
- **Radar de fugas:** un índice que empieza en 100 y baja con cada señal (cada una con su estado Normal / Revisar /
  Alerta, con ícono y palabra, y un enlace a la auditoría o a la pantalla donde se revisa):
  anulaciones (y cuántas ya se estaban preparando), descuentos sobre el límite del cajero, diferencias de inventario en los
  conteos (por ejemplo "Whisky: −270 ml"), mesas abiertas hace más de 90 minutos, pagos reversados, mesas cerradas sin
  cobrar, cajas con faltante, comandas de más de 25 minutos y bloqueos por PIN equivocado.
- También: lo más vendido de cocina y de barra, tiempo promedio de preparación por estación e insumos por comprar.

## Cómo funciona (módulo 09: cuando se cae el internet)

- Cada pedido y cada cobro lleva un **identificador único** que crea el aparato. El servidor lo guarda: si el mismo envío
  llega dos veces (doble toque, o la respuesta se perdió y el aparato reintenta), se registra **una sola vez**. Así no hay
  pedidos dobles en cocina ni cobros dobles.
- **Pedido sin conexión:** queda guardado en la tablet como "pendiente", con aviso ("No lo vuelvas a pedir"), el carrito
  se bloquea y se reintenta solo (cada vez más espaciado y en cuanto vuelve la conexión) con el mismo identificador.
- **Cobro sin conexión:** igual; el aviso dice que todavía no quedó registrado y se reintenta solo. "Cancelar reintento"
  pide revisar la lista de pagos antes de cobrar otra vez.
- Aviso fijo abajo de la pantalla mientras no hay conexión. La actualización automática de las pantallas no intenta
  recargar sin conexión (antes podía dejar la página en blanco). Los demás botones muestran "Sin conexión: no se guardó"
  en vez de romper la pantalla, y si algo falla aparece "Reintentar".
- Lo que no hace (todavía): abrir pantallas nuevas sin internet. La tablet necesita conexión para ver el plano y la carta
  actualizados; lo que ya está en pantalla sigue funcionando.

## Cómo funciona (módulo 11: reservas y menú QR)

- **Reservas** (`/app/reservas`, todo el equipo de sala): por día, con nombre, teléfono (enlace a WhatsApp), personas,
  mesa opcional, nota y abono. Una misma mesa no acepta dos reservas a menos de 2 horas. "Llegó: abrir mesa" abre la mesa
  (la asignada o la que se elija) con las personas y la nota de la reserva, y lleva al pedido. También: no llegó, cancelar.
- **Reservas en línea** (`/r/{negocio}`): el cliente elige sede, fecha, hora y personas (hasta 20) y deja nombre y
  teléfono. Llegan como "por confirmar" arriba de la pantalla de Reservas. Freno: 5 solicitudes cada 10 minutos por
  aparato y máximo 3 pendientes por teléfono.
- En el **plano**, una mesa con reserva confirmada aparece "Reservada" (borde morado punteado) desde 30 minutos antes hasta
  90 minutos después de la hora, con el nombre del cliente.
- **Carta pública** (`/m/{negocio}`): lo que está en la carta con precios y agotados al momento, botón para reservar y
  WhatsApp del restaurante. Con `?mesa=5` muestra el número de la mesa.
- **QR y enlaces** (`/app/qr`, dueño): QR de la carta, de las reservas y uno por mesa, listos para imprimir; WhatsApp
  público y el interruptor de reservas en línea.
- Los clientes quedan guardados por teléfono (se usarán también para las facturas).

## Cómo funciona (módulo 12: resumen del día con IA)

- Arriba del tablero, **"¿Qué pasó?"**: un párrafo para el dueño con lo que pasó en el día y, como máximo, tres cosas
  para revisar empezando por la señal más grave del radar. Lo escribe Claude (modelo `claude-opus-5-5`, esfuerzo bajo)
  con los **números reales** del tablero; se le pide no inventar cifras ni causas.
- A la IA solo se le mandan **cifras agregadas** del negocio (ventas, costos, señales del radar, lo más vendido): nada de
  nombres de clientes ni de empleados.
- Se guarda uno por día y sede; el de hoy se rehace solo si tiene más de una hora, o con "Escribir de nuevo" (máximo 10
  veces por hora). Mientras se escribe, el resto del tablero ya se ve.
- **Sin la variable `ANTHROPIC_API_KEY`** (o si la IA no responde) se arma el mismo resumen con una plantilla, y la
  tarjeta dice "Resumen automático". Para activarla: poner `ANTHROPIC_API_KEY` en las variables de Vercel del proyecto
  `restaurante` (puede ser la misma llave que ya está en Render para la plataforma de 3R).
- Si el modelo declinara la solicitud por sus políticas, la API reintenta sola con otro modelo (respaldo automático).

## Cómo funciona (módulo 13: servicios y citas)

- La misma app sirve para **barberías, peluquerías y spas**: en Equipo se agregan personas con el rol **Profesional**.
- **Servicios** (al final de `/app/agenda`, dueño y administrador): nombre, precio, duración y **comisión** del
  profesional en %. Precio y comisión se copian a la cita al agendar (si cambian después, la cita no cambia).
- **Agenda** (`/app/agenda`): un día, una columna por profesional. Dueño, administrador y cajero agendan (cliente y
  teléfono, servicio, profesional, fecha y hora); **no se cruzan** dos citas del mismo profesional, ni aunque se agenden
  al mismo tiempo. El profesional ve solo su columna y puede marcar su cita como atendida.
- **Cobrar** la cita en la misma caja (efectivo con vueltas, tarjeta o transferencia, propina opcional): entra a las
  ventas del turno, a Finanzas y al Tablero. Un doble toque no cobra dos veces. Reversar el pago (dueño o administrador,
  con motivo) deja la cita otra vez por cobrar.
- **Comisiones del mes:** por profesional, servicios, ventas, comisión y propinas. Cada profesional ve la suya.

## Cómo funciona (módulo 10: factura electrónica)

- **Datos de facturación** (`/app/facturas`, el dueño): razón social, NIT, impuesto (impuesto al consumo 8 % para
  restaurantes y bares, IVA 19 % o no responsable) y resolución. Los precios de la carta se toman **con el impuesto
  incluido**: $108.000 con impoconsumo = base $100.000 + $8.000.
- **Cada venta cobrada** (la cuenta de una mesa al quedar en cero, o una cita) crea su factura con número interno de venta,
  a nombre de **consumidor final** (CC 222222222222). La propina va aparte: no es ingreso del negocio y no lleva impuesto.
- **"Poner a nombre del cliente"** (en la pantalla de cobro o en Facturas): tipo y número de documento, nombre o razón
  social y correo, mientras no se haya enviado.
- Si se **reversa** el pago que cerró la venta, su factura se anula (queda de rastro) y al cobrar de nuevo sale otra. Si ya
  se había enviado a la DIAN, la auditoría avisa que hace falta una nota crédito.
- **Descargar para Excel:** las facturas del periodo con base, impuesto, total, propina, cliente y estado, para el
  contador o para subirlas al proveedor.
- **Lo que falta:** el envío a la DIAN. Se hace por un proveedor tecnológico (Alegra, Siigo u otro) con sus llaves; hay que
  elegirlo y conectar su API. Mientras tanto las facturas quedan "pendientes".

## Publicarla (una sola vez)

1. **Base de datos (Neon):** crea una base nueva, aparte de la tienda y de la asistencia (por ejemplo un proyecto o base
   `restaurante`). Copia su cadena de conexión.
2. **Vercel:** *Add New → Project*, este mismo repositorio, **Root Directory** `restaurante`. Variables:
   - `DATABASE_URL`: la cadena del paso 1.
   - `ADMIN_PASSWORD`: la clave de 3R para `/admin`. Cambiarla cierra las sesiones de 3R.
   - `SESSION_SECRET`: texto largo al azar (40 letras y números). Cambiarlo cierra todas las sesiones.
   - `ANTHROPIC_API_KEY` (opcional): para el resumen del día escrito con IA. Sin ella se usa una plantilla.
3. Despliega. Entra a `https://<dirección>/admin`, crea el negocio y pásale al dueño la dirección (escoge su restaurante en la lista), su código `0001` y su PIN.

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
