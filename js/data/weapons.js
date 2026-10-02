// Arsenal: armas con su dibujo ASCII (se muestra en el tooltip)
// wtype: melee | pistol | smg | shotgun | rifle | sniper | mg | flame | launcher | energy
// Campos: dmg [min,max], acc %, range, mag, burst, ammo, crit %, noise, pierce, chain, blast (lanzadores), fire
const W = (o) => ({ cat: 'weapon', glyph: o.glyph || (o.wtype === 'melee' ? '†' : o.wtype === 'launcher' ? '¶' : o.wtype === 'energy' ? '¥' : '/'), stack: 1, burst: 1, crit: 5, noise: 0, ...o });
const A = (s) => s.replace(/^\n/, '').replace(/\n\s*$/, '');

export const WEAPONS = {
  // ======================================================== CUERPO A CUERPO
  knife: W({ name: 'Cuchillo NR-40', wtype: 'melee', tier: 0, dmg: [3, 6], acc: 90, range: 1, crit: 12, noise: 1, value: 30, desc: 'Cuchillo de explorador. Silencioso y fiable.', art: A(String.raw`
  ______________   ______
 <______________|=[______]=`) }),
  shovel: W({ name: 'Pala de zapador MPL-50', wtype: 'melee', tier: 0, dmg: [4, 8], acc: 84, range: 1, crit: 8, noise: 2, value: 35, desc: 'Cava trincheras. Parte cráneos de chebylita.', art: A(String.raw`
                       _______
 o=====================|      \
                       |_______/`) }),
  crowbar: W({ name: 'Palanca de bombero', wtype: 'melee', tier: 0, dmg: [4, 7], acc: 86, range: 1, crit: 6, noise: 2, value: 25, desc: 'Abre puertas, taquillas y caparazones.', art: A(String.raw`
  __
 (  \___________________________
  \_____________________________>`) }),
  wrench: W({ name: 'Llave de tubo de 600 mm', wtype: 'melee', tier: 0, dmg: [5, 8], acc: 80, range: 1, crit: 5, noise: 2, value: 30, desc: 'Herramienta de la sala de bombas. Pesa como un yunque.', art: A(String.raw`
  ____
 | __ |__________________________
 ||__||__________________________)
  \__/`) }),
  axe: W({ name: 'Hacha de bombero', wtype: 'melee', tier: 1, dmg: [6, 12], acc: 78, range: 1, crit: 10, noise: 2, value: 70, desc: 'Pintada de rojo. Recuerdo del 26 de abril.', art: A(String.raw`
   _____
  /     \___________________________
 |       |__________________________)
  \_____/`) }),
  bayonet: W({ name: 'Bayoneta 6Kh4', wtype: 'melee', tier: 1, dmg: [5, 9], acc: 88, range: 1, crit: 14, noise: 1, value: 60, desc: 'Bayoneta de AK con funda cortaalambres.', art: A(String.raw`
  ____________________  ______
 <____________________|=[_||__]o`) }),
  machete: W({ name: 'Machete de taiga', wtype: 'melee', tier: 1, dmg: [6, 10], acc: 84, range: 1, crit: 10, noise: 1, value: 65, desc: 'Abre camino entre musgo errante.', art: A(String.raw`
   ___________________________
  /___________________________|=[####]`) }),
  kizlyar: W({ name: 'Cuchillo «Kizlyar»', wtype: 'melee', tier: 2, dmg: [6, 11], acc: 92, range: 1, crit: 25, noise: 1, value: 160, desc: 'Acero de Daguestán. Busca las juntas del caparazón.', art: A(String.raw`
    _____________________
   <_____________________/|=[%%%%%]>`) }),
  shashka: W({ name: 'Sable de cosaco «Shashka»', wtype: 'melee', tier: 2, dmg: [8, 14], acc: 82, range: 1, crit: 15, noise: 1, value: 200, desc: 'Sable de caballería del abuelo de alguien.', art: A(String.raw`
                              ___
     ____....------''''''  __|  o)
 <--'_____....------''''''''  ''`) }),
  sledge: W({ name: 'Mazo de demolición', wtype: 'melee', tier: 3, dmg: [12, 22], acc: 70, range: 1, crit: 8, noise: 4, pierce: 2, value: 280, desc: 'Lento, pero atraviesa el grafito.', art: A(String.raw`
  ________
 |        |==============================o
 |________|`) }),
  graphclub: W({ name: 'Garrote de grafito', wtype: 'melee', tier: 3, dmg: [10, 18], acc: 76, range: 1, crit: 10, noise: 3, value: 300, desc: 'Un bloque del moderador atado a un tubo. Todavía templado.', art: A(String.raw`
   _______
  /#######\
 |#########|===========================o
  \#######/`) }),
  druzhba: W({ name: 'Motosierra «Druzhba»', wtype: 'melee', tier: 4, dmg: [9, 15], acc: 80, range: 1, burst: 2, crit: 6, noise: 14, value: 700, desc: 'Dos golpes por turno. Despierta a media central.', art: A(String.raw`
  ___________________________
 /=o=o=o=o=o=o=o=o=o=o=o=o=o=\____
 \___________________________/|[]|==o
                               \__/`) }),
  zarnitsa: W({ name: 'Hoja de esencia «Zarnitsa»', wtype: 'melee', tier: 5, dmg: [16, 26], acc: 92, range: 1, crit: 20, noise: 1, pierce: 99, value: 2200, glyph: '¥', desc: 'Hoja de esencia condensada. Ignora cualquier blindaje.', art: A(String.raw`
   ✦ · ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
  <≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈|=[≡≡≡≡]
   · ✦ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~`) }),

  // ======================================================== PISTOLAS
  makarov: W({ name: 'Pistola Makarov PM', wtype: 'pistol', tier: 0, dmg: [5, 8], acc: 76, range: 6, mag: 8, ammo: 'a_9x18', noise: 9, value: 80, desc: 'La pistola reglamentaria. Ocho balas de esperanza.', art: A(String.raw`
  ___________
 |_===_______|>
    \(_)/ |
         |_|`) }),
  tt33: W({ name: 'Pistola Tokarev TT-33', wtype: 'pistol', tier: 0, dmg: [5, 9], acc: 74, range: 7, mag: 8, ammo: 'a_9x18', noise: 10, crit: 7, value: 90, desc: 'Veterana de la Gran Guerra Patria, recalibrada a 9×18.', art: A(String.raw`
  ____________
 |_=_=_=______|>
    \(_)/ ||
         |__|`) }),
  nagant: W({ name: 'Revólver Nagant M1895', wtype: 'pistol', tier: 0, dmg: [6, 9], acc: 78, range: 6, mag: 7, ammo: 'a_9x18', noise: 7, crit: 8, value: 85, desc: 'Su tambor sellado lo hace sorprendentemente silencioso.', art: A(String.raw`
  ______________,
 |_______(ooo)__|=
         \ \__|
          |___|`) }),
  pb: W({ name: 'Pistola silenciada PB', wtype: 'pistol', tier: 1, dmg: [4, 7], acc: 76, range: 6, mag: 8, ammo: 'a_9x18', noise: 2, value: 160, desc: 'Silenciador integrado del KGB.', art: A(String.raw`
  _________________________
 |_===_____|##############|
    \(_)/ |
         |_|`) }),
  stechkin: W({ name: 'Pistola Stechkin APS', wtype: 'pistol', tier: 1, dmg: [3, 6], acc: 66, range: 6, mag: 20, burst: 2, ammo: 'a_9x18', noise: 10, value: 150, desc: 'Automática. Ráfagas cortas de 9×18.', art: A(String.raw`
  _____________
 |_===_=_______|>
    \(_)/ |  |
         |____|`) }),
  gsh18: W({ name: 'Pistola GSh-18', wtype: 'pistol', tier: 2, dmg: [6, 10], acc: 80, range: 7, mag: 18, ammo: 'a_9x18', noise: 9, value: 260, desc: 'Prototipo de Tula. Ligera y precisa.', art: A(String.raw`
  ____________
 [____________|>
    \(_)/ ||
         [__]`) }),
  sr1: W({ name: 'Pistola SR-1 «Gyurza»', wtype: 'pistol', tier: 3, dmg: [8, 12], acc: 80, range: 7, mag: 18, ammo: 'a_9x18', noise: 9, pierce: 2, value: 480, desc: 'Munición perforante para chalecos... y caparazones.', art: A(String.raw`
  _____________
 |_===_________|>>
    \(_)/  |/
          |__|`) }),
  ots38: W({ name: 'Revólver OTs-38', wtype: 'pistol', tier: 3, dmg: [9, 13], acc: 82, range: 6, mag: 5, ammo: 'a_9x18', noise: 2, crit: 15, value: 520, desc: 'Revólver silencioso de las fuerzas especiales.', art: A(String.raw`
  _______________
 |____(OOOOO)____|=
         \ \_/
          |__|`) }),
  iskra: W({ name: 'Pistola de esencia «Iskra»', wtype: 'energy', tier: 4, dmg: [10, 16], acc: 86, range: 7, mag: 10, ammo: 'a_cell', noise: 3, chain: 1, value: 1100, desc: 'Chispa de esencia que salta a un segundo objetivo.', art: A(String.raw`
   ✦ __________
  <=|≈≈≈≈≈≈≈≈≈≈|=·✦
     \(_)/ |
          |_|`) }),

  // ======================================================== SUBFUSILES
  ppsh: W({ name: 'Subfusil PPSh-41', wtype: 'smg', tier: 1, dmg: [3, 6], acc: 58, range: 5, mag: 71, burst: 3, ammo: 'a_9x18', noise: 12, value: 220, desc: 'El «Papasha». Cargador de tambor de 71 balas.', art: A(String.raw`
  ________________________________
 |____|||||||||||||_______________|=
  \___    ( O )  /\_|
      \__________/  |__|`) }),
  pps43: W({ name: 'Subfusil PPS-43', wtype: 'smg', tier: 1, dmg: [3, 6], acc: 62, range: 5, mag: 35, burst: 2, ammo: 'a_9x18', noise: 11, value: 180, desc: 'Fabricado en el sitio de Leningrado. Sencillo y fiable.', art: A(String.raw`
     _____________________________
 |==|___|___________|::::::::::::|=
       \|  /  \  |
            \__\ |__|`) }),
  kedr: W({ name: 'Subfusil PP-91 «Kedr»', wtype: 'smg', tier: 2, dmg: [4, 7], acc: 66, range: 5, mag: 30, burst: 3, ammo: 'a_9x18', noise: 10, value: 300, desc: 'Compacto, para tripulaciones y policía.', art: A(String.raw`
   ___________________
  |_====______________|=
 [__] \(_)/ |  |
           |____|`) }),
  bizon: W({ name: 'Subfusil PP-19 «Bizon»', wtype: 'smg', tier: 2, dmg: [4, 7], acc: 66, range: 6, mag: 64, burst: 3, ammo: 'a_9x18', noise: 11, value: 380, desc: 'Cargador helicoidal de 64 balas bajo el cañón.', art: A(String.raw`
  ________________________________
 |__/=====|______________________|=
     \|  (@@@@@@@@@@@@@@@@@@@)
      |__|`) }),
  aks74u: W({ name: 'AKS-74U «Krinkov»', wtype: 'smg', tier: 2, dmg: [5, 8], acc: 66, range: 6, mag: 30, burst: 2, ammo: 'a_545', noise: 12, value: 320, desc: 'Carabina compacta para espacios cerrados.', art: A(String.raw`
   ______________________
  /__|_===_=_==|_________|=[]
 [__]   \(_)  ) ||
         \__\/  |__|`) }),
  vityaz: W({ name: 'Subfusil PP-19-01 «Vityaz»', wtype: 'smg', tier: 3, dmg: [6, 9], acc: 72, range: 6, mag: 30, burst: 3, ammo: 'a_9x18', noise: 11, value: 560, desc: 'Basado en el AK. Para tropas de asalto del MVD.', art: A(String.raw`
   _________________________
  /__|_===_=_===|___________|=
 [___]   \(_)  ) ||
          \__\/  ||
                 |_|`) }),
  sr2: W({ name: 'Subfusil SR-2 «Veresk»', wtype: 'smg', tier: 4, dmg: [8, 12], acc: 74, range: 6, mag: 30, burst: 2, ammo: 'a_9x39', noise: 10, pierce: 2, value: 900, desc: 'Munición 9×39 perforante. Compacto y letal.', art: A(String.raw`
   ____________________
  [_====_______________|=>
 |_|  \(_)/ |  ||
           |___||`) }),

  // ======================================================== ESCOPETAS
  sawnoff: W({ name: 'Escopeta recortada IZh-43', wtype: 'shotgun', tier: 0, dmg: [10, 16], acc: 76, range: 2, mag: 2, ammo: 'a_12', noise: 13, value: 110, desc: 'Cañones serrados. Solo sirve a quemarropa, y ahí sirve mucho.', art: A(String.raw`
  ________________
 (_____|==========)
   \(_)/ \
        \_\ `) }),
  toz: W({ name: 'Escopeta TOZ-34', wtype: 'shotgun', tier: 1, dmg: [9, 15], acc: 80, range: 3, mag: 2, ammo: 'a_12', noise: 12, value: 160, desc: 'Escopeta de caza de dos cañones. Devastadora a corta distancia.', art: A(String.raw`
  ______    _____________________________
 \      \__|_=_|_________________________|
  \_____/    \(_)
              \_\ `) }),
  izh81: W({ name: 'Escopeta de corredera IZh-81', wtype: 'shotgun', tier: 1, dmg: [8, 13], acc: 78, range: 3, mag: 5, ammo: 'a_12', noise: 12, value: 190, desc: 'Corredera de bombeo. Cinco cartuchos.', art: A(String.raw`
  _____     ______________________________
 \     \___|__|____________________________|
  \____/     \(_)  [||||||||||]
              \_\ `) }),
  mp133: W({ name: 'Escopeta MP-133', wtype: 'shotgun', tier: 2, dmg: [9, 15], acc: 78, range: 3, mag: 6, ammo: 'a_12', noise: 12, value: 300, desc: 'La escopeta de bombeo de Izhevsk, robusta y barata.', art: A(String.raw`
  _____     _______________________________
 \     \___|__|_____________________________|
  \____/     \(_)  [|||||||||||||]
              \_\ `) }),
  saiga: W({ name: 'Escopeta Saiga-12', wtype: 'shotgun', tier: 2, dmg: [8, 14], acc: 74, range: 4, mag: 8, ammo: 'a_12', noise: 13, value: 400, desc: 'Escopeta semiautomática con cargador.', art: A(String.raw`
   _____________________________
  /__|_=_=_===|_________________|=
 [___]   \(_)  ) |
          \__\/  [==]`) }),
  rmb93: W({ name: 'Escopeta RMB-93', wtype: 'shotgun', tier: 3, dmg: [11, 18], acc: 78, range: 4, mag: 6, ammo: 'a_12', noise: 13, value: 560, desc: 'Escopeta de bombeo hacia delante, con culata plegable.', art: A(String.raw`
   ____________________________
  /____________________________|==
 [_]  \(_)/   [||||||]
         \_\ `) }),
  ks23: W({ name: 'Escopeta KS-23', wtype: 'shotgun', tier: 3, dmg: [14, 24], acc: 76, range: 4, mag: 3, ammo: 'a_12', noise: 15, value: 620, desc: 'Escopeta antidisturbios de calibre 23 mm.', art: A(String.raw`
  _____     _______________________________
 \     \___|__|_____________________________|==
  \____/     \(_)  [##########]
              \_\ `) }),
  vepr: W({ name: 'Escopeta Vepr-12 «Molot»', wtype: 'shotgun', tier: 4, dmg: [12, 20], acc: 78, range: 4, mag: 10, ammo: 'a_12', noise: 14, value: 1000, desc: 'Semiautomática de Vyatskiye Polyany. Tambor de diez cartuchos.', art: A(String.raw`
   _______________________________
  /__|_=_=_====|__________________|=[]
 [___]   \(_)  ) |
          \__\/  (@@@)`) }),
  grom: W({ name: 'Escopeta de esencia «Grom»', wtype: 'shotgun', tier: 5, dmg: [18, 30], acc: 82, range: 5, mag: 6, ammo: 'a_cell', noise: 10, pierce: 3, value: 2300, glyph: '¥', desc: 'Dispara una nube de esquirlas de esencia.', art: A(String.raw`
   ___________________________ ✦ ·
  /__|≈≈≈≈≈≈≈≈|_______________|≈≈ ✦
 [___]   \(_)  ) |            · ✦
          \__\/  [✦✦]`) }),

  // ======================================================== FUSILES
  mosin: W({ name: 'Fusil Mosin-Nagant 1891/30', wtype: 'rifle', tier: 1, dmg: [10, 15], acc: 80, range: 10, mag: 5, ammo: 'a_762', noise: 14, crit: 10, value: 260, desc: 'Cerrojo y madera. Ha matado más que el frío.', art: A(String.raw`
  ________                    o
 \        \__,_______________/|__________
  \_______/ _|_[__]__________________|___|
              \(_)`) }),
  sks: W({ name: 'Carabina SKS', wtype: 'rifle', tier: 1, dmg: [7, 11], acc: 76, range: 9, mag: 10, ammo: 'a_762x39', noise: 13, value: 240, desc: 'Semiautomática con bayoneta plegable.', art: A(String.raw`
  ________      ___________________________
 \        \____|_=_|_______________________|==<
  \_______/      \(_)  |\
                   \_\ `) }),
  saigamk: W({ name: 'Carabina Saiga-MK', wtype: 'rifle', tier: 1, dmg: [6, 9], acc: 74, range: 8, mag: 10, ammo: 'a_545', noise: 12, value: 220, desc: 'Versión civil del AK: semiautomática.', art: A(String.raw`
  ______        ________________________
 \      \______|_=_=_|__________________|=
  \_____/        \(_)  )
                  \__\/`) }),
  akm: W({ name: 'Fusil AKM', wtype: 'rifle', tier: 1, dmg: [7, 12], acc: 68, range: 9, mag: 30, ammo: 'a_762x39', noise: 14, value: 300, desc: 'El AK clásico de 7,62. Pega fuerte, sube mucho.', art: A(String.raw`
  _______         _____________________
 \       \_______|_==_=_==|____________|==-
  \______/        \(_)  )   ||
                   \__\/    |_|`) }),
  ak74: W({ name: 'Fusil AK-74', wtype: 'rifle', tier: 2, dmg: [6, 10], acc: 72, range: 9, mag: 30, ammo: 'a_545', noise: 13, value: 380, desc: 'El fusil del pueblo soviético. No falla nunca.', art: A(String.raw`
  _______         ______________________
 \       \_______|_==_=_==|_____________|=[]
  \______/        \(_)  )   |\
                   \__\/    |_\ `) }),
  ak74m: W({ name: 'Fusil AK-74M', wtype: 'rifle', tier: 3, dmg: [7, 11], acc: 78, range: 10, mag: 30, ammo: 'a_545', noise: 13, value: 620, desc: 'Modernizado, con culata plegable de polímero.', art: A(String.raw`
  ______          ______________________
 [|____|\_______|_==_=_==|_____________|=[]
  [_____]        \(_)  )   |\
                  \__\/    |_\ `) }),
  asval: W({ name: 'Fusil AS «Val»', wtype: 'rifle', tier: 3, dmg: [8, 12], acc: 78, range: 8, mag: 20, burst: 2, ammo: 'a_9x39', noise: 3, pierce: 1, value: 780, desc: 'Fusil de asalto silenciado. Los nidos no despiertan.', art: A(String.raw`
  ______          __________________________________
 |__  __|________|_==_=__|##########################|
   |_|            \(_)  ) ||
                   \__\/  |_|`) }),
  groza: W({ name: 'Fusil OTs-14 «Groza»', wtype: 'rifle', tier: 4, dmg: [9, 13], acc: 76, range: 8, mag: 20, burst: 2, ammo: 'a_9x39', noise: 12, pierce: 1, value: 950, desc: 'Bullpup con lanzagranadas integrado... sin granadas.', art: A(String.raw`
   __________________________
  |____|==___|_______________|==
  |____|  || \(_)/
       |__||    \_\ `) }),
  an94: W({ name: 'Fusil AN-94 «Abakán»', wtype: 'rifle', tier: 4, dmg: [8, 12], acc: 84, range: 10, mag: 30, burst: 2, ammo: 'a_545', noise: 13, value: 1050, desc: 'Ráfaga de dos disparos tan rápida que suenan como uno.', art: A(String.raw`
  ______          _________________________
 [|____|\_______|_==_=_====|_______________|=[]=
  [_____]        \(_)  )    |\
                  \__\/     |_\ `) }),
  aek971: W({ name: 'Fusil AEK-971', wtype: 'rifle', tier: 4, dmg: [7, 11], acc: 78, range: 10, mag: 30, burst: 3, ammo: 'a_545', noise: 14, value: 1000, desc: 'Sistema de retroceso equilibrado. Ráfagas controlables.', art: A(String.raw`
  ______          ________________________
 [|____|\_______|_====_===|_______________|=#=
  [_____]        \(_)  )   |\
                  \__\/    |_\ `) }),
  molniya: W({ name: 'Fusil de esencia «Molniya»', wtype: 'energy', tier: 5, dmg: [10, 15], acc: 84, range: 11, mag: 24, burst: 3, ammo: 'a_cell', noise: 6, value: 2400, desc: 'Ráfagas de rayos de esencia.', art: A(String.raw`
  ______          ______________________ ·✦
 [|____|\_______|≈≈≈≈≈≈≈≈≈≈|____________|≈≈>
  [_____]        \(_)  )   |\          ✦·
                  \__\/    |_\ `) }),

  // ======================================================== TIRADOR
  mosinpu: W({ name: 'Mosin-Nagant con mira PU', wtype: 'sniper', tier: 2, dmg: [12, 18], acc: 84, range: 13, mag: 5, ammo: 'a_762', noise: 14, crit: 18, value: 420, desc: 'El fusil de Zaitsev y Pavlichenko.', art: A(String.raw`
                 [=====]
  ________      __||__________________o
 \        \__,_|_______________________|___
  \_______/ _|_[__]____________________|___|
              \(_)`) }),
  svd: W({ name: 'Fusil SVD Dragunov', wtype: 'sniper', tier: 3, dmg: [14, 22], acc: 86, range: 14, mag: 10, crit: 20, ammo: 'a_762', noise: 15, value: 700, desc: 'Fusil de tirador. Precisión a larga distancia.', art: A(String.raw`
                    [===()===]
  _____  ______     _||____||________________
 |     \/     /____|_=_=_==|________________|=>
 |_____/\____/      \(_)  ) |
                     \__\/  |_|`) }),
  svds: W({ name: 'Fusil SVDS plegable', wtype: 'sniper', tier: 3, dmg: [13, 20], acc: 88, range: 13, mag: 10, crit: 20, ammo: 'a_762', noise: 15, value: 760, desc: 'Versión de paracaidista del Dragunov.', art: A(String.raw`
                  [===()===]
  ______         _||____||______________
 [|____|\_______|_=_=_==|______________|=>
  [_____]        \(_)  ) |
                  \__\/  |_|`) }),
  vss: W({ name: 'Fusil VSS «Vintorez»', wtype: 'sniper', tier: 4, dmg: [11, 17], acc: 85, range: 11, mag: 10, crit: 18, ammo: 'a_9x39', noise: 3, pierce: 1, value: 1300, desc: 'Fusil de francotirador silenciado. Los chebylitas no lo oyen venir.', art: A(String.raw`
                  [==()==]
  ______         __||__||____________________________
 |__  __|_______|_==_=__|###########################|
   |_|           \(_)  ) ||
                  \__\/  |_|`) }),
  sv98: W({ name: 'Fusil de cerrojo SV-98', wtype: 'sniper', tier: 4, dmg: [20, 30], acc: 90, range: 15, mag: 10, crit: 25, ammo: 'a_762', noise: 15, value: 1400, desc: 'Precisión deportiva al servicio de la guerra.', art: A(String.raw`
                   [=====()=====]
  _______         __||_________||_______________
 |       \_______|__o__________________________|==
 |_______/  ||    \(_)   ||
            ||           /_\ `) }),
  ksvk: W({ name: 'Fusil antimaterial KSVK', wtype: 'sniper', tier: 5, dmg: [32, 48], acc: 84, range: 16, mag: 5, crit: 20, ammo: 'a_127', noise: 18, pierce: 4, value: 2400, desc: 'Calibre 12,7 mm. Atraviesa gólems de grafito.', art: A(String.raw`
              [=====()=====]
  ________   __||_________||____________________________
 |________|=|___________________________________________|=[]
    |_|      \(_)/   /\
                    /__\ `) }),
  gauss: W({ name: 'Rifle Gauss «Topolev-M»', wtype: 'energy', tier: 5, dmg: [24, 38], acc: 90, range: 16, mag: 5, crit: 15, ammo: 'a_cell', noise: 6, pierce: 99, value: 2600, desc: 'Prototipo del Dr. Topolev. Atraviesa a todo lo que encuentre en su línea.', art: A(String.raw`
                 [≡≡≡()≡≡≡]
  ______    ______||____||___________________________
 |______|==|_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_o_|=≈≈≈✦
    |_|      \(_)/  [✦✦✦]`) }),

  // ======================================================== AMETRALLADORAS
  dp27: W({ name: 'Ametralladora DP-27', wtype: 'mg', tier: 2, dmg: [8, 13], acc: 60, range: 10, mag: 47, burst: 3, ammo: 'a_762', noise: 16, value: 600, desc: 'El «tocadiscos»: cargador de plato encima del cajón.', art: A(String.raw`
                 _(@@@@@@@@)_
  _______       |____________|_________________
 \       \______|____________|__________________|==
  \______/       \(_)    /\
                        /  \ `) }),
  rpd: W({ name: 'Ametralladora RPD', wtype: 'mg', tier: 2, dmg: [6, 10], acc: 60, range: 9, mag: 100, burst: 3, ammo: 'a_762x39', noise: 15, value: 560, desc: 'Cinta de cien cartuchos en un tambor.', art: A(String.raw`
  _______        __________________________
 \       \______|_=_=_=_=|_________________|==
  \______/       \(_)(@@@)    /\
                             /  \ `) }),
  rpk: W({ name: 'Ametralladora RPK-74', wtype: 'mg', tier: 3, dmg: [5, 9], acc: 62, range: 9, mag: 45, burst: 3, ammo: 'a_545', noise: 15, value: 650, desc: 'Ametralladora ligera. Muro de plomo.', art: A(String.raw`
  _______         _____________________________
 \       \_______|_==_=_==|____________________|=
  \______/        \(_)  )         /\
                   \___\         /  \ `) }),
  pkm: W({ name: 'Ametralladora PKM', wtype: 'mg', tier: 4, dmg: [9, 14], acc: 58, range: 10, mag: 100, burst: 4, ammo: 'a_762', noise: 18, value: 1200, desc: 'La reina del frente. Pesada y furiosa.', art: A(String.raw`
  ________        _______________________________
 |   __   |______|_[=====]_|_____________________|==
 |__|  |__|       \(_) [####]       /\
                     [____]        /  \ `) }),
  pecheneg: W({ name: 'Ametralladora «Pecheneg»', wtype: 'mg', tier: 5, dmg: [10, 15], acc: 66, range: 11, mag: 100, burst: 4, ammo: 'a_762', noise: 18, value: 2000, desc: 'PKM con cañón refrigerado por aire forzado.', art: A(String.raw`
  ________        _______________________________
 |   __   |______|_[=====]_|#####################|==
 |__|  |__|       \(_) [####]       /\
                     [____]        /  \ `) }),
  nsv: W({ name: 'Ametralladora pesada NSV «Utyos»', wtype: 'mg', tier: 5, dmg: [16, 24], acc: 54, range: 12, mag: 50, burst: 3, ammo: 'a_127', noise: 20, pierce: 3, value: 2500, desc: 'Arrancada de un vehículo blindado. Calibre 12,7.', art: A(String.raw`
     ______________________________________
 ||=|___[======]_|_________________________|=[]=
 ||    \(_)  [######]       /|\
            [______]       / | \ `) }),

  // ======================================================== LANZALLAMAS / LANZADORES / ESENCIA
  flamer: W({ name: 'Lanzallamas improvisado', wtype: 'flame', tier: 2, dmg: [6, 10], acc: 95, range: 3, mag: 3, ammo: 'a_fuel', noise: 7, value: 450, desc: 'Un extintor, una manguera y mucha fe.', art: A(String.raw`
   ______
  (______)=~~~~~~~=[====]>  ^^^
  |      |                 ^^^^^
  |______|`) }),
  lpo: W({ name: 'Lanzallamas LPO-50', wtype: 'flame', tier: 4, dmg: [10, 16], acc: 95, range: 5, mag: 3, ammo: 'a_fuel', noise: 8, value: 1100, desc: 'Abrasa todo en línea recta. Prende fuego al suelo.', art: A(String.raw`
  ___ ___ ___
 (___|___|___)====\    _____________________
              \\    \==|_=__|_____________|=> ^^^
                      \(_)                  ^^^^^`) }),
  gp25: W({ name: 'Lanzagranadas GP-25', wtype: 'launcher', tier: 3, dmg: [14, 22], acc: 80, range: 8, mag: 1, ammo: 'a_40', noise: 14, blast: 1, value: 700, desc: 'Lanzagranadas de 40 mm con empuñadura propia.', art: A(String.raw`
    _____________________
   |_______[ o ]_________|=
       \(_)/ |
            |_|  VOG-25`) }),
  rg6: W({ name: 'Lanzagranadas RG-6', wtype: 'launcher', tier: 4, dmg: [14, 22], acc: 78, range: 8, mag: 6, ammo: 'a_40', noise: 15, blast: 1, value: 1400, desc: 'Revólver de granadas de seis tiros.', art: A(String.raw`
  ________     _______________________
 [___|____|___(O O O O O O)_____________|=
       |__|   \(_)  |
              \__\  |_|`) }),
  rpg7: W({ name: 'Lanzacohetes RPG-7', wtype: 'launcher', tier: 4, dmg: [30, 45], acc: 76, range: 10, mag: 1, ammo: 'a_rpg', noise: 18, blast: 2, value: 1600, desc: 'Cohete PG-7. Explosión de radio 2: cuidado con los tuyos.', art: A(String.raw`
                               __
  ___________________________ /  \
 <___|=====|______[]_________|    >===<>
       \(_)/  \(_)/          \__/`) }),
  shmel: W({ name: 'Lanzador termobárico RPO «Shmel»', wtype: 'launcher', tier: 5, dmg: [34, 50], acc: 78, range: 9, mag: 1, ammo: 'a_rpg', noise: 18, blast: 2, fire: 1, value: 2200, desc: 'Lanzador de un solo uso recargable con cohetes. Incendia la zona.', art: A(String.raw`
  ____________________________________
 [____|____________________________|__]=>  )))
       \(_)/          [####]`) }),
  prometeo: W({ name: 'Proyector de esencia «Prometeo»', wtype: 'energy', tier: 5, dmg: [12, 20], acc: 88, range: 8, mag: 12, ammo: 'a_cell', noise: 5, chain: 2, value: 2400, desc: 'Arco de esencia que salta entre chebylitas cercanos.', art: A(String.raw`
     .--.       ___________________   ✦
  __/ ✦  \_____|≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈|~~~~~✦
 |__|    |      \(_)/  [✦✦✦]        ✦
     '--'`) }),
  kurchatov: W({ name: 'Arco de Tesla «Kurchátov»', wtype: 'energy', tier: 5, dmg: [9, 15], acc: 90, range: 5, mag: 16, ammo: 'a_cell', noise: 6, chain: 4, value: 2300, desc: 'Arco eléctrico que salta hasta cuatro veces.', art: A(String.raw`
   _[o]_[o]_[o]_
  |_____________|=====( )~ϟ~ϟ~
     \(_)/  ||         ϟ  ~ϟ
            |_|`) }),
};

export const NEW_AMMO = {
  a_762x39: { cat: 'ammo', name: 'Munición 7,62×39 mm', glyph: '"', tier: 1, stack: 150, value: 2, pack: 30, desc: 'Para AKM, SKS y RPD.' },
  a_9x39: { cat: 'ammo', name: 'Munición 9×39 mm SP-6', glyph: '"', tier: 3, stack: 100, value: 5, pack: 20, desc: 'Subsónica y perforante. Para VSS, AS Val, Groza y Veresk.' },
  a_127: { cat: 'ammo', name: 'Munición 12,7×108 mm', glyph: '"', tier: 4, stack: 60, value: 10, pack: 10, desc: 'Para el KSVK y la NSV. Cada bala pesa como un pájaro.' },
  a_40: { cat: 'ammo', name: 'Granada VOG-25 de 40 mm', glyph: '"', tier: 3, stack: 20, value: 25, pack: 4, desc: 'Para lanzagranadas GP-25 y RG-6.' },
  a_rpg: { cat: 'ammo', name: 'Cohete PG-7', glyph: '"', tier: 4, stack: 6, value: 70, pack: 2, desc: 'Para RPG-7 y RPO «Shmel».' },
};
