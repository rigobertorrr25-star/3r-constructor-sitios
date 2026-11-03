// Adivina por el primer nombre si el empleado es hombre o mujer, solo para el dibujo del avatar. Si se equivoca,
// el administrador lo corrige en el panel ("Hombre" / "Mujer"). Este archivo lo usan también los componentes.

export type Gender = 'm' | 'f';

// Nombres frecuentes en Colombia que la regla de la última letra adivinaría mal o no sabría decir.
const FEMALE = new Set(
  `isabel raquel ruth esther carmen pilar luz rocio consuelo mercedes dolores beatriz ines soledad rosario
  socorro amparo nelly lili liliana yaneth janeth jenny yenny jennifer yennifer karen leidy leydi
  lady sharon michel michelle nicol nicole dayana yuly yuli sully nathaly nataly natali katherine kathleen
  shirley evelyn madeleine ingrid miriam abigail maribel marisol flor yolanda edith judith astrid gisel
  gissel yamile yamileth lisbeth elizabeth beth margot mabel rosalba doris iris maite
  noemi zoe chloe paz cruz belen lourdes nieves gladys sindy cindy wendy kelly heidy deisy daisy betty
  marlen marleny sorany esperanza estefany estefania stefany tatiana jazmin yasmin jasmin karol carol
  caroll emily emely ashley britany brittany nayeli lucero aracely sury rubi ruby milagros guadalupe`.split(/\s+/),
);
const MALE = new Set(
  `jhon john jhonny johnny yeison jeison brayan bryan brian kevin stiven steven estiven jhonatan jonathan
  yonatan maicol michael maikol deiby deivid david jose josue luca luka joshua nicola elias
  tomas matias nicolas jonas lucas jesus moises isaias ezequiel ismael rafael gabriel daniel samuel
  manuel miguel angel abel joel noel ariel uriel axel fidel isaac jacob ruben adan alan allan dylan
  dilan julian sebastian cristian christian fabian adrian ivan esteban juan joan yohan johan
  alejandro andres carlos luis jorge oscar victor hector cesar edgar wilmer wilson nelson edwin
  edison yeferson jeferson jefferson anderson harold harol arnold leonel marlon milton william
  wilian willian robinson duvan duban yair jair omar ricardo eduardo alberto alfredo arturo
  fernando hernando orlando rolando gonzalo camilo santiago diego mateo felipe pablo hugo mario
  sergio pedro jaime javier xavier alvaro gustavo raul saul francisco pacho chepe jhojan didier
  yesid yeisson freddy fredy henry harry jimmy jhony danny dany brandon branyer yorman norman`.split(/\s+/),
);
// Terminan en "a" pero son de hombre.
const MALE_A = new Set(['luca', 'luka', 'joshua', 'nicola', 'bautista']);

/** Primer nombre en minúsculas y sin tildes. Si el nombre viene "Apellido, Nombre", toma lo de después de la coma. */
export function firstName(full: string): string {
  const name = full.includes(',') ? full.split(',')[1] ?? full : full;
  return (name.trim().split(/\s+/)[0] ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-zñ]/g, '');
}

export function guessGender(full: string): Gender {
  const first = firstName(full);
  if (FEMALE.has(first)) return 'f';
  if (MALE.has(first) || MALE_A.has(first)) return 'm';
  // María José, María Fernanda… ya los cubre el primer nombre. Regla general: los terminados en "a" son de mujer.
  return first.endsWith('a') ? 'f' : 'm';
}
