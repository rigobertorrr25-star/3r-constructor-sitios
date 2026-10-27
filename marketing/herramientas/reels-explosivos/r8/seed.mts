process.env.DATABASE_URL = 'postgresql://postgres@localhost:54331/rc';
const store = await import('/home/user/3r-constructor-sitios/restaurante/lib/store.ts');
const menu = await import('/home/user/3r-constructor-sitios/restaurante/lib/menu-import.ts');
const db = await import('/home/user/3r-constructor-sitios/restaurante/lib/db.ts');
const b = await store.createBusiness({ name: 'Bar La Ola (demo)', locationName: 'Bocagrande', ownerName: 'Rigoberto', ownerPin: '2580' });
const login = await store.loginStaff({ slug: b.slug, code: b.ownerCode, pin: '2580' });
if (login.kind !== 'ok') throw new Error('login');
const owner = (await store.getStaffSession(login.staffId, login.locationId, login.epoch))!;
const w = await store.createStaff(owner, { name: 'Camilo', role: 'waiter', locationId: b.locationId, pin: '3691' });
await store.createStaff(owner, { name: 'Breiner', role: 'bar', locationId: b.locationId, pin: '4826' });
await store.createTables(owner, { zone: 'Salón', count: 8, capacity: 4, shape: 'square' });
await menu.importMenu(owner, `Cócteles
Mojito 28000
Piña Colada 32000
Margarita 30000
Cerveza
Águila 8000
Club Colombia 9000
Corona 12000
Para picar
Picada de la casa 45000
Patacones con hogao 18000`, 'bar');
console.log(JSON.stringify({ slug: b.slug, owner: b.ownerCode, waiter: w }));
await db.closePool();
