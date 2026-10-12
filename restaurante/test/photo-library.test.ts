// Biblioteca de fotos de 3R: cada bebida de la carta encuentra su foto por el nombre, y solo se ponen donde no hay foto.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { libraryPhotoFor, photoKey } from '../lib/photo-library';

// Los 82 productos de la carta de DELIRIUM, tal como se cargaron.
const DELIRIUM = ["Smirnoff","Stella","Corona","Budweiser","Club Colombia","Águila Light","Águila Negra","Coronita","Margarita","Margarita Blue","Mojito","Gin Tonic","Caipiroska","Frutos Rojos","Vino Frontera","Vino Chandon","Crema de Whisky Baileys","Vino JP Chenet Rosé","Vino JP Chenet Blanco","JW Double Black 750ml","JW Black Label 700ml","JW Red Label 700ml","Buchanan's 18 Años 750ml","Buchanan's Malta 750ml","Buchanan's Two Souls","Buchanan's Master 750ml","Buchanan's Deluxe Litro","Buchanan's Deluxe 750ml","Buchanan's Deluxe 365","Black & White 700ml","Chivas Regal 18 Años 700ml","Chivas Regal 12 Años 700ml","Chivas Regal 13 Años 700ml","Old Parr Litro","Old Parr 750ml","Old Parr 500ml","Macallan 12 Años","Glenfiddich 18 Años 750ml","Glenfiddich 15 Años 750ml","Glenfiddich 12 Años 750ml","Zacapa 12 Años 750ml","Zacapa 23 Años 750ml","Ron Medellín 19 Años 750ml","Ron Medellín 12 Años 750ml","Ron Medellín 8 Años 750ml","Ron Medellín 5 Años 750ml","Ron Medellín 3 Años 750ml","Ron Medellín 3 Años 375ml","Ron Bacardí Limón 750ml","Ron Bacardí Mandarina 750ml","Ron Bacardí Añejo 750ml","Ron Bacardí Carta Blanca","Ron Viejo de Caldas 750ml","Aguardiente Amarillo 750ml","Aguardiente Antioqueño 750ml","Aguardiente Antioqueño 375ml","Don Julio 70","Don Julio Añejo","Don Julio Blanco","Don Julio Reposado","Tequila 1800 Añejo","Tequila 1800 Reposado","Tequila 1800 Blanco","Tequila Patrón Añejo","Tequila Patrón Reposado","Tequila Patrón Silver","José Cuervo Especial","José Cuervo Tradicional","Absolut Vodka","Smirnoff Rojo","Smirnoff Lulo","Hendrick's","Ginebra Gordon's","Gatorade","Red Bull","Electrolit","Gaseosa","Ginger","Soda","Agua","Rosquitas","Vaso Michelado"];

describe('biblioteca de fotos: nombres', () => {
  it('cada producto de la carta de DELIRIUM tiene foto, y el archivo existe', () => {
    for (const name of DELIRIUM) {
      const file = libraryPhotoFor(name);
      assert.ok(file, `sin foto: ${name}`);
      assert.ok(existsSync(path.join(process.cwd(), 'lib', 'biblioteca', `${file}.webp`)), `no existe el archivo de ${name}`);
    }
  });

  it('el tamaño y la forma de escribir no importan; lo que no conoce queda sin foto', () => {
    assert.equal(photoKey("Buchanan's Deluxe 750ml"), 'buchanans deluxe');
    assert.equal(libraryPhotoFor('OLD PARR LITRO'), 'old-parr');
    assert.equal(libraryPhotoFor('Aguardiente Antioqueño 375ml'), 'aguardiente-antioqueno');
    assert.equal(libraryPhotoFor('Coronita'), 'coronita');
    assert.equal(libraryPhotoFor('Corona'), 'corona');
    assert.equal(libraryPhotoFor('Smirnoff Lulo'), 'smirnoff-lulo');
    assert.equal(libraryPhotoFor('Picada de la casa'), null);
  });
});

const url = process.env.TEST_DATABASE_URL;

describe('biblioteca de fotos: en la carta', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let orders: typeof import('../lib/orders');
  let lib: typeof import('../lib/photo-library');
  let photos: typeof import('../lib/product-photos');
  let imp: typeof import('../lib/menu-import');
  let db: typeof import('../lib/db');
  type Actor = import('../lib/store').Actor;
  let owner: Actor;
  let slug: string;
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
    orders = await import('../lib/orders');
    lib = await import('../lib/photo-library');
    photos = await import('../lib/product-photos');
    imp = await import('../lib/menu-import');
    const a = await store.createBusiness({ name: `Prueba ${stamp} Fotos`, locationName: 'Centro', ownerName: 'Dueño', ownerPin: '2580' });
    slug = a.slug;
    const r = await store.loginStaff({ slug, code: '0001', pin: '2580' });
    if (r.kind !== 'ok') throw new Error('sin sesión');
    owner = (await store.getStaffSession(r.staffId, r.locationId, r.epoch))!;
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('pone las fotos que faltan y no toca las que el negocio ya subió', async () => {
    await imp.importMenu(owner, 'Cervezas\nCorona 12000\nClub Colombia 8000\nPicadas\nPicada de la casa 35000');
    const menu = await orders.getMenu(owner.businessId);
    const club = menu.products.find((p) => p.name === 'Club Colombia')!;
    const own = await (await import('node:fs/promises')).readFile(path.join(process.cwd(), 'lib', 'biblioteca', 'budweiser.webp'));
    await photos.saveProductPhoto(owner, club.id, own);
    const result = await lib.applyLibraryPhotos(owner);
    assert.deepEqual(result, { placed: 1, missing: ['Picada de la casa'] });
    const clubPhoto = await photos.getProductPhoto(club.id);
    assert.equal(clubPhoto!.image.length, own.length);
    const corona = (await orders.getMenu(owner.businessId)).products.find((p) => p.name === 'Corona')!;
    assert.ok(corona.photo);
  });
});
