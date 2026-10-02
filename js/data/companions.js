// Compañeros mecánicos (fase 19): perro robot «Laika-M», drones y módulos.
// Van en la ranura COMPAÑERO de cada agente; se compran, mejoran y reparan en el Garaje (garage: nivel necesario).
// No importa items.js: items.js los añade al catálogo.

export const COMPANION_ITEMS = {
  laika: {
    cat: 'companion', kind: 'dog', name: 'Perro robot «Laika-M»', glyph: '§', tier: 2, garage: 1, value: 1600,
    hp: 40, armor: 2, cargo: 4, modSlots: 3, dmg: [3, 6],
    desc: 'Chasis de cuatro patas de la Academia de Ciencias. Sigue a su dueño, lleva 4 objetos y admite 3 módulos. Si cae, deja un chasis que se repara en el Garaje.',
  },
  strizh: {
    cat: 'companion', kind: 'drone', drone: 'strizh', name: 'Dron de reconocimiento «Strizh»', glyph: 'ˇ', tier: 2, garage: 1, value: 950,
    hp: 8, battery: 40,
    desc: 'La «golondrina»: vuela muy rápido sobre todo el mapa, también sobre el agua; revela casillas y marca enemigos y puntos de interés. Batería de 40 turnos: vuelve solo. Los cuervos y los americanos lo derriban. Clic en el minimapa para mandarlo a un punto.',
  },
  mula: {
    cat: 'companion', kind: 'drone', drone: 'mula', name: 'Dron de carga «Mula»', glyph: 'ˇ', tier: 3, garage: 2, value: 1200,
    hp: 14, carry: 3,
    desc: 'Se lleva los 3 objetos más valiosos de la mochila a la extracción más cercana y los envía a la base, pase lo que pase con el escuadrón. Una vez por expedición.',
  },
  kamikadze: {
    cat: 'companion', kind: 'drone', drone: 'kamikadze', name: 'Dron de ataque «Kamikadze»', glyph: 'ˇ', tier: 3, garage: 3, value: 700,
    blast: 2, dmg: [22, 38], range: 14,
    desc: 'Se lanza contra un objetivo y explota en radio 2. De un solo uso.',
  },
  eco: {
    cat: 'companion', kind: 'drone', drone: 'eco', name: 'Dron señuelo «Eco»', glyph: 'ˇ', tier: 2, garage: 2, value: 750,
    hp: 6, battery: 15,
    desc: 'Vuela hasta el punto que elijas y emite ruido y luz durante 15 turnos: atrae a los chebylitas lejos del grupo. Al agotarse aterriza y se puede recoger.',
  },
  rele: {
    cat: 'companion', kind: 'drone', drone: 'rele', name: 'Dron repetidor «Relé»', glyph: 'ˇ', tier: 3, garage: 3, value: 850,
    desc: 'Mantiene el contacto con la base: con él, la tormenta electromagnética no deja sin radar al escuadrón y las extracciones temporales se anuncian antes. Funciona desde la ranura, sin lanzarlo.',
  },
  // módulos del perro (3 ranuras)
  dm_mg: { cat: 'dogmod', name: 'Módulo: ametralladora ligera', glyph: '¬', tier: 3, garage: 2, value: 700, dmg: [5, 9], range: 7, ammo: 'a_545', desc: 'Dispara ráfagas cortas a los hostiles a la vista. Gasta munición de 5,45 de su carga o de la mochila de su dueño.' },
  dm_flare: { cat: 'dogmod', name: 'Módulo: lanzabengalas', glyph: '¬', tier: 2, garage: 2, value: 350, desc: 'Cada 15 turnos lanza una bengala sobre el hostil más cercano que esté a oscuras.' },
  dm_detector: { cat: 'dogmod', name: 'Módulo: detector de chebylitas', glyph: '¬', tier: 2, garage: 2, value: 450, sense: 15, desc: 'Marca en el radar a los chebylitas que estén a 15 casillas del perro.' },
  dm_rad: { cat: 'dogmod', name: 'Módulo: sensor de radiación', glyph: '¬', tier: 1, garage: 1, value: 250, desc: 'Muestra los focos de radiación a 10 casillas del perro, aunque no se vean.' },
  dm_medkit: { cat: 'dogmod', name: 'Módulo: botiquín', glyph: '¬', tier: 2, garage: 2, value: 500, heal: 2, charges: 30, desc: 'Cura 2 de salud por turno a los agentes adyacentes (30 cargas por expedición).' },
  dm_jaw: { cat: 'dogmod', name: 'Módulo: mandíbula hidráulica', glyph: '¬', tier: 2, garage: 1, value: 400, dmgPct: 100, pierce: 2, desc: 'El doble de daño cuerpo a cuerpo y atraviesa 2 de blindaje.' },
  dm_lead: { cat: 'dogmod', name: 'Módulo: blindaje de plomo', glyph: '¬', tier: 1, garage: 1, value: 300, armor: 3, hp: 15, desc: '+3 de blindaje y +15 de salud.' },
};

// actores en el mapa (los añade data/actors.js); faction 'squad'
const C = (o) => ({ companion: 1, faction: 'squad', abil: [], range: 1, xp: 0, ess: [0, 0], minL: 1, maxL: 10, group: [1, 1], acc: 78, ev: 10, armor: 0, speed: 100, origin: 'Máquina', mech: 1, ...o });
export const COMPANION_ACTORS = {
  laika: C({ name: 'Laika-M', glyph: '§', color: '#5fd0ff', hp: 40, dmg: [3, 6], armor: 2, ev: 12, speed: 120, lore: 'Perro robot de la Academia de Ciencias. Lleva el nombre de la primera perra en órbita.' }),
  strizh: C({ name: 'Dron «Strizh»', glyph: 'ˇ', color: '#9fe8ff', hp: 8, dmg: [0, 0], ev: 35, speed: 250, abil: ['flying'], drone: 1, lore: 'Dron de reconocimiento.' }),
  mula: C({ name: 'Dron «Mula»', glyph: 'ˇ', color: '#e6c86a', hp: 14, dmg: [0, 0], ev: 20, speed: 150, abil: ['flying'], drone: 1, lore: 'Dron de carga.' }),
  eco: C({ name: 'Dron «Eco»', glyph: 'ˇ', color: '#ff6ad5', hp: 6, dmg: [0, 0], ev: 25, speed: 200, abil: ['flying'], drone: 1, lore: 'Dron señuelo.' }),
  gnomo: C({ name: 'Torreta «Gnomo»', glyph: 'Ŧ', color: '#ffb02e', hp: 24, dmg: [4, 7], armor: 3, ev: 0, abil: ['stationary'], turret: 1, range: 7, lore: 'Torreta desplegable con ametralladora y munición limitada.' }),
};
export const DOG_ORDERS = { seguir: 'SEGUIR', quedarse: 'QUEDARSE', buscar: 'BUSCAR', atacar: 'ATACAR' };
