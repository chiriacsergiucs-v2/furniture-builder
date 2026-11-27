/**
 * The warnings the core makes, for the printed sheet (ADR-265, D18-F6). Key: the text key `t()` was called with (the
 * English text, with its `@@context` when it has one); value: the Romanian print text, a key of `PRINT_RU` and
 * `PRINT_EN` (ADR-157). `t()` records the message and params of each key listed here (`recordedMessage`), so the
 * sheet can print the warning again in the print language instead of the app language. A warning text added in the
 * core needs its line here: `tests/warning-print.test.ts` finds every warning text in `src/core` and fails for a
 * missing one. Wizard hints (src/core/wallfill.ts, roomfill.ts) never reach the sheet and are not listed. Pure data,
 * runtime imports: `i18n/index.ts` reads it.
 */
import type { PrintKey } from './print';

export const WARNING_RO = {
  'A divider in row {i} lines up with one in the row above.':
    'Un despărțitor din rândul {i} este aliniat cu unul din rândul de deasupra.',
  '{n|A part|# parts} with its own edge band no longer {n|exists|exist} (the piece changed); the band is not used. Clear it under Material → Part.':
    '{n|O piesă cu cant propriu nu mai există|# piese cu cant propriu nu mai există} (piesa s-a schimbat); cantul nu este folosit. Ștergeți-l la „Material” → „Part”.',
  'A part with its own board no longer exists (the piece changed); the board choice is not used. Clear it under Material → Part.':
    'O piesă cu placă proprie nu mai există (piesa s-a schimbat); placa aleasă nu este folosită. Ștergeți alegerea la „Material” → „Part”.',
  '{n} parts with their own board no longer exist (the piece changed); the board choice is not used. Clear it under Material → Part.':
    '{n} piese cu placă proprie nu mai există (piesa s-a schimbat); placa aleasă nu este folosită. Ștergeți alegerea la „Material” → „Part”.',
  '{part} is only {w} mm wide.': '{part} are doar {w} mm lățime.',
  '{board} is labelled kitchen worktop but is used for {part} (guidance).':
    '{board} este marcată ca blat de bucătărie, dar este folosită pentru {part} (orientativ).',
  '{board} is labelled kitchen worktop but is used for {n} parts that are not worktops (guidance).':
    '{board} este marcată ca blat de bucătărie, dar este folosită pentru {n} piese care nu sunt blaturi (orientativ).',
  '{s} mm handle does not fit on {part} ({along} mm).':
    'Mânerul de {s} mm nu încape pe {part} ({along} mm).',
  'A doubled top applies to a full top panel; the two top rails stay single.':
    'Un blat dublat se aplică unui panou de blat întreg; cele două traverse de sus rămân simple.',
  'A floor cabinet without a bottom has nothing to stand its contents on; this is meant for units over a cooker hood.':
    'Un corp de podea fără fund nu are pe ce să sprijine conținutul; este gândit pentru corpurile de deasupra unei hote.',
  'Hanging brackets usually need the back set in about 15–20 mm; check the bracket datasheet.':
    'Suporturile de agățare cer de obicei spatele retras cu aproximativ 15–20 mm; verificați fișa tehnică a suportului.',
  'Sliding doors run in front of the carcass; the inset front style does not apply to them.':
    'Ușile glisante merg în fața corpului; stilul de front încastrat nu li se aplică.',
  'Choose the lift-up system for this {w}×{h} mm front from its datasheet and name it here.':
    'Alegeți sistemul de ridicare pentru acest front de {w}×{h} mm din fișa lui tehnică și denumiți-l aici.',
  'Choose the flap stay for this {w}×{h} mm front from its datasheet and name it here.':
    'Alegeți brațul pentru clapă pentru acest front de {w}×{h} mm din fișa lui tehnică și denumiți-l aici.',
  'Only {h} mm of height for hanging.': 'Doar {h} mm de înălțime pentru agățare.',
  'Drawer heights add up to {asked} mm but there is {room} mm; the bottom drawer was adjusted. Make one drawer "Share" to absorb the difference.':
    'Înălțimile sertarelor însumează {asked} mm, dar sunt disponibili {room} mm; sertarul de jos a fost ajustat. Faceți un sertar „Share” ca să preia diferența.',
  'A fixed front needs a drawer front of its own; drawers behind doors have none, so the setting is ignored.':
    'Un front fix cere un front de sertar propriu; sertarele din spatele ușilor nu au, deci setarea este ignorată.',
  'The top drawer is a fixed front, so it has no box to cut around the trap; the U-cut is ignored.':
    'Sertarul de sus este front fix, deci nu are cutie de decupat în jurul sifonului; decupajul în U este ignorat.',
  'Drawers behind doors have no front of their own, so they keep their inner front.':
    'Sertarele din spatele ușilor nu au front propriu, deci își păstrează frontul interior.',
  'Drawer 1 is cut around the trap ({w} × {d} mm notch at the back): check the trap and pipes before cutting.':
    'Sertarul 1 este decupat în jurul sifonului (decupaj de {w} × {d} mm în spate): verificați sifonul și țevile înainte de tăiere.',
  'Drawers behind doors: check hinge and door clearance against the drawer boxes.':
    'Sertare în spatele ușilor: verificați jocul balamalelor și al ușii față de cutiile sertarelor.',
  'Fixed sizes add up to {asked} mm but there is {room} mm; the first part was adjusted to {first} mm. Make one part "Share" to absorb the difference.':
    'Dimensiunile fixe însumează {asked} mm, dar sunt disponibili {room} mm; prima parte a fost ajustată la {first} mm. Faceți o parte „Share” ca să preia diferența.',
  'Fixed sizes add up to {asked} mm but there is {room} mm; the last part was adjusted to {last} mm. Make one part "Share" to absorb the difference.':
    'Dimensiunile fixe însumează {asked} mm, dar sunt disponibili {room} mm; ultima parte a fost ajustată la {last} mm. Faceți o parte „Share” ca să preia diferența.',
  'Shelves {d} mm deep are too shallow for two pin rows {s} mm from their edges.':
    'Rafturile de {d} mm adâncime sunt prea puțin adânci pentru două rânduri de găuri pentru bolțuri, la {s} mm de margini.',
  'The common {kind} is not built: {reason} The items keep their own.':
    'Panoul comun {kind} nu este construit: {reason} Elementele își păstrează panoul propriu.',
  'top@@role': 'de sus',
  'bottom@@role': 'de jos',
  'The common {kind} spans a {n} mm gap with nothing under it.':
    'Panoul comun {kind} acoperă un gol de {n} mm fără nimic dedesubt.',
  'Some items under the common top have a doubled top and some do not; the common top is single.':
    'Unele elemente de sub blatul comun au blat dublat și altele nu; blatul comun este simplu.',
  '{a} and {b} stand side by side with different depths ({reason} mm); {text}.':
    '{a} și {b} stau alăturate cu adâncimi diferite ({reason} mm); {text}.',
  '{a} and {b} are under one worktop with different heights ({reason} mm); {text}.':
    '{a} și {b} sunt sub același blat cu înălțimi diferite ({reason} mm); {text}.',
  '{a} is connected against wall {n} but no longer joined: {reason}':
    '{a} este conectat de peretele {n}, dar nu mai este îmbinat: {reason}',
  '{a} and {b} are connected but no longer joined: {reason}':
    '{a} și {b} sunt conectate, dar nu mai sunt îmbinate: {reason}',
  "Blind section is {blind} mm; about the neighbouring cabinet's depth + 50 mm ({d} mm) keeps its door and handle clear of this door.":
    'Secțiunea oarbă are {blind} mm; aproximativ adâncimea corpului vecin + 50 mm ({d} mm) ține ușa și mânerul acestuia libere față de această ușă.',
  'Knee space is {knee} mm wide; about 600 mm or more is usual.':
    'Spațiul pentru genunchi are {knee} mm lățime; de obicei se folosesc aproximativ 600 mm sau mai mult.',
  'Drawer fronts stick out {out} mm past the worktop edge; set the overhang to at least {min} mm.':
    'Frontul sertarelor iese cu {out} mm peste marginea blatului; setați surplombul la cel puțin {min} mm.',
  'Clear height under the worktop is {h} mm.': 'Înălțimea liberă sub blat este de {h} mm.',
  'The lower shelf sits between the legs: fix it with cleats or dowels (not listed).':
    'Raftul de jos stă între picioare: fixați-l cu suporți sau cepuri (nu sunt incluse în listă).',
  'Seat and back boards on a bought base: the base, gas lift, mechanism and back support are bought and not drawn.':
    'Plăci de șezut și spătar pe o bază cumpărată: baza, ridicătorul cu gaz, mecanismul și suportul spătarului se cumpără și nu sunt desenate.',
  'Guard rails {h} mm above the top deck are too low to add over the side rails.':
    'Balustradele aflate la {h} mm deasupra platformei de sus sunt prea joase ca să fie adăugate peste lonjeroanele laterale.',
  '{s} mm handle does not fit on the {w} mm front.':
    'Mânerul de {s} mm nu încape pe frontul de {w} mm.',
  '{n} parts have no known place and are shown in a pile beside the assembly. Edge banding is not set.':
    '{n} piese nu au un loc cunoscut și sunt arătate într-o grămadă lângă ansamblu. Cantul nu este stabilit.',
  'Loose panels, shown in one pile: how they go together is not in the design. Edge banding is not set.':
    'Panouri libere, arătate într-o grămadă: modul în care se îmbină nu este în proiect. Cantul nu este stabilit.',
  'Screwed joints: choose the screw type, length and number for the board (guidance, not listed).':
    'Îmbinări cu șuruburi: alegeți tipul, lungimea și numărul de șuruburi pentru placă (orientativ, nu sunt în listă).',
  '{name} was placed on a piece that is no longer in the project; it stays where it is.':
    '{name} a fost așezat pe o piesă care nu mai este în proiect; rămâne unde este.',
  '{name} is off the floor with nothing under it; set it to hang on wall brackets (Whole cabinet → Stands on).':
    '{name} este ridicat de la podea fără nimic dedesubt; setați-l să se agațe pe suporți de perete („Whole cabinet” → „Stands on”).',
  '{name} is built to hang on the wall but is placed on the floor.':
    '{name} este făcut să se agațe pe perete, dar este așezat pe podea.',
  "{board} has different sheet settings in {name}; the first piece's sheet ({l} × {w}) is used for the whole project.":
    '{board} are setări de placă diferite în {name}; placa primei piese ({l} × {w}) este folosită pentru tot proiectul.',
  '{front} of {name} cannot open fully: it hits {other} (needs {need} mm, {free} mm free).':
    '{front} de la {name} nu se poate deschide complet: lovește {other} (are nevoie de {need} mm, sunt {free} mm liberi).',
  '{front} of {a} and {other} of {b} open into the same space.':
    '{front} de la {a} și {other} de la {b} se deschid în același spațiu.',
  'The worktop over {name} has a {what} edge but no size; enter the edge size. It is drawn square until then.':
    'Blatul de peste {name} are o margine {what}, dar fără dimensiune; introduceți dimensiunea marginii. Până atunci este desenat drept.',
  'The {what} edge of the worktop over {name} is {size} mm, not less than the {t} mm worktop; it is drawn square.':
    'Marginea {what} a blatului de peste {name} are {size} mm, nu mai mică decât blatul de {t} mm; este desenat drept.',
  '{name} is in the way of {door} (it needs {mm} mm to swing).':
    '{name} stă în calea {door} (are nevoie de {mm} mm ca să se deschidă).',
  '{name} covers the window {window}: it stands against its wall and is {mm} mm higher than its sill.':
    '{name} acoperă fereastra {window}: stă lângă peretele ei și este cu {mm} mm mai înalt decât pervazul.',
  '{front} of {name} cannot open fully: it hits a wall (needs {need} mm).':
    '{front} de la {name} nu se poate deschide complet: lovește un perete (are nevoie de {need} mm).',
  '{outlet} is hidden behind {name}: move the outlet or the piece.':
    '{outlet} este ascunsă în spatele {name}: mutați priza sau piesa.',
  'Pipe behind {name} ({label}): cut the {part} or move the piece.':
    'Țeavă în spatele {name} ({label}): tăiați {part} sau mutați piesa.',
  'Outlet behind {name} ({label}): cut the {part} or move the piece.':
    'Priză în spatele {name} ({label}): tăiați {part} sau mutați piesa.',
  '{outlet} is {mm} mm from a sink cut-out, closer than the {limit} mm you set (your rule).':
    '{outlet} este la {mm} mm de decupajul chiuvetei, mai aproape decât cei {limit} mm stabiliți de dvs. (regula dvs.).',
  '{outlet} is {mm} mm from a hob cut-out, closer than the {limit} mm you set (your rule).':
    '{outlet} este la {mm} mm de decupajul plitei, mai aproape decât cei {limit} mm stabiliți de dvs. (regula dvs.).',
  '{outlet} is {mm} mm from {pipe}, closer than the {limit} mm you set (your rule).':
    '{outlet} este la {mm} mm de {pipe}, mai aproape decât cei {limit} mm stabiliți de dvs. (regula dvs.).',
  'Shelf span {span} mm is long for {t} mm {name} and may sag (typical limit {limit} mm — confirm for your board and load).':
    'Deschiderea raftului de {span} mm este mare pentru {name} de {t} mm și se poate îndoi (limită obișnuită {limit} mm — confirmați pentru placa și sarcina dvs.).',
  'Door {w} mm wide; over ~{max} mm (typical) consider two doors.':
    'Ușă de {w} mm lățime; peste ~{max} mm (obișnuit) luați în calcul două uși.',
  'Opening depth {depth} mm; hangers usually need about {need} mm (typical).':
    'Adâncimea deschiderii este {depth} mm; umerașele cer de obicei aproximativ {need} mm (obișnuit).',
  'Assembled lying down, the piece needs {diag} mm to stand up, but the room is {room} mm high. Build it in place or split it.':
    'Asamblată culcat, piesa are nevoie de {diag} mm ca să fie ridicată, dar camera are {room} mm înălțime. Construiți-o la locul ei sau împărțiți-o.',
  "Choose the {what} from the maker's datasheet and check its fitting sizes against this piece.":
    'Alegeți {what} din fișa tehnică a producătorului și verificați dimensiunile de montaj față de această piesă.',
  'Slat gap {gap} mm; mattress and seat makers usually ask for 70 mm or less (check yours).':
    'Distanța dintre lamele este {gap} mm; producătorii de saltele și de scaune cer de obicei 70 mm sau mai puțin (verificați la ai dvs.).',
  'Bunk beds are covered by safety standards (EN 747 and others). Mobila does not check guard rails, openings or ladder against them; this is not a compliance check.':
    'Paturile suprapuse sunt reglementate de standarde de siguranță (EN 747 și altele). Mobila nu verifică balustradele, deschiderile sau scara în raport cu ele; aceasta nu este o verificare de conformitate.',
  'Cots and cradles are covered by safety standards (EN 716 and others). Mobila does not check bar spacing or side height; this is not a compliance check.':
    'Pătuțurile și leagănele sunt reglementate de standarde de siguranță (EN 716 și altele). Mobila nu verifică distanța dintre bare sau înălțimea laterală; aceasta nu este o verificare de conformitate.',
  'Rails span {span} mm between legs; long tables usually get a centre leg or rail (typical).':
    'Traversele au o deschidere de {span} mm între picioare; mesele lungi primesc de obicei un picior sau o traversă la mijloc (obișnuit).',
  'The shared sides are not built: {reason} The items keep both their sides.':
    'Laturile comune nu sunt construite: {reason} Elementele își păstrează ambele laturi.',
  '{set} is incomplete; its pieces keep their last values.':
    '{set} este incomplet; piesele lui își păstrează ultimele valori.',
  '{name}: {field} keeps its value — it follows “{expr}”, but that size is locked.':
    '{name}: {field} își păstrează valoarea — urmează „{expr}”, dar acea dimensiune este blocată.',
  'Select two or more items standing side by side.':
    'Selectați două sau mai multe elemente care stau alăturate.',
  'An item of this common panel was removed.': 'Un element al acestui panou comun a fost șters.',
  '{name} is not a cabinet, corner unit or desk.': '{name} nu este corp, corp de colț sau birou.',
  '{name} has no bottom.': '{name} nu are fund.',
  '{name} is counted more than once.': '{name} este numărat de mai multe ori.',
  'The items are not turned the same way.': 'Elementele nu sunt întoarse în același sens.',
  '{name} has another plinth height.': '{name} are altă înălțime a soclului.',
  '{name} has another back.': '{name} are alt spate.',
  '{name} has no {part}.': '{name} nu are {part}.',
  '{name} is not the same height or floor level.':
    '{name} nu are aceeași înălțime sau același nivel de la podea.',
  'The {part} of {name} is another thickness.': '{part} de la {name} are altă grosime.',
  'These items do not make one top without holes.':
    'Aceste elemente nu fac un singur blat fără goluri.',
  '{name} is not the same depth or not in line.':
    '{name} nu are aceeași adâncime sau nu este aliniat.',
  '{name} does not touch the others and is not in line with them.':
    '{name} nu atinge celelalte și nu este aliniat cu ele.',
  '{name} is an L-shape or diagonal corner unit; only a blind corner shares a side.':
    '{name} este un corp de colț în L sau diagonal; doar un colț orb împarte o latură.',
  '{name} is not a cabinet, a blind corner unit or a desk.':
    '{name} nu este corp, colț orb sau birou.',
  'An item of these shared sides was removed.': 'Un element al acestor laturi comune a fost șters.',
  '{name} has sides of another thickness.': '{name} are laturi de altă grosime.',
  '{a} and {b} do not touch.': '{a} și {b} nu se ating.',
  '{a} and {b} are both desks; a desk shares a side only with a cabinet.':
    '{a} și {b} sunt ambele birouri; un birou împarte o latură doar cu un corp.',
  '{name} meets its neighbour at its blind end; only its straight end shares a side.':
    '{name} se întâlnește cu vecinul la capătul orb; doar capătul drept împarte o latură.',
  '{name} has a pedestal at that end; only a gable end shares a side.':
    '{name} are un bloc de sertare la acel capăt; doar un capăt cu perete lateral împarte o latură.',
  'in the corner': 'în colț',
  stacked: 'suprapuse',
  'against wall {n}': 'lângă peretele {n}',
  'side by side': 'alăturate',
  '{a} and {b} do not meet in a corner.': '{a} și {b} nu se întâlnesc în colț.',
  '{a} and {b} are not one over the other.': '{a} și {b} nu sunt una peste alta.',
  '{a} and {b} do not stand side by side.': '{a} și {b} nu stau alăturate.',
  'A piece cannot be connected to itself.': 'O piesă nu poate fi conectată cu ea însăși.',
  'A connected piece was removed.': 'O piesă conectată a fost ștearsă.',
  'A wall connection holds one piece.': 'O conexiune la perete leagă o singură piesă.',
  '{a} and {b} are not side by side, in a corner or one over the other.':
    '{a} și {b} nu sunt alăturate, în colț sau una peste alta.',
  'The room has no wall {n}.': 'Camera nu are peretele {n}.',
  '{name} is turned at an angle.': '{name} este întors în unghi.',
  'The back of {name} does not face wall {n}.':
    'Spatele lui {name} nu este orientat spre peretele {n}.',
  'The back of {name} is not against wall {n}.':
    'Spatele lui {name} nu este lipit de peretele {n}.',
  '{name} reaches past the end of wall {n}.': '{name} depășește capătul peretelui {n}.',
  'Draw the room first: a piece goes against its walls.':
    'Desenați mai întâi camera: o piesă se pune lângă pereții ei.',
  'The back of {name} is not against a wall.': 'Spatele lui {name} nu este lipit de un perete.',
  '{reason}; {text}': '{reason}; {text}',
  '{reason}; {text}.': '{reason}; {text}.',
  'floor unit': 'corp de podea',
  'wall unit': 'corp suspendat',
  'piece placed on another piece': 'piesă așezată peste altă piesă',
  side: 'latură',
  back: 'spate',
  front: 'față',
  '{what} {a} vs {b}': '{what} {a} față de {b}',
  'a {a} cannot join a {b}; only sides join':
    'îmbinarea „{a}” cu „{b}” nu este posibilă; se îmbină doar laturile',
  'a {a} cannot join a {b}': 'îmbinarea „{a}” cu „{b}” nu este posibilă',
  'only the back of a piece goes against a wall (this is its {face}); a side goes against a wall only in a corner':
    'doar spatele unei piese se pune lângă un perete (aici: {face}); o latură se pune lângă un perete doar într-un colț',
  depth: 'adâncime',
  height: 'înălțime',
  '{a} ({fa}: {ra}) and {b} ({fb}: {rb}) share no room':
    '{a} ({fa}: {ra}) și {b} ({fb}: {rb}) nu au nicio cameră în comun',
  'The sink over {name} has no worktop to be cut out of; add the run worktop.':
    'Chiuveta de peste {name} nu are blat din care să fie decupată; adăugați blatul șirului.',
  'The hob over {name} has no worktop to be cut out of; add the run worktop.':
    'Plita de peste {name} nu are blat din care să fie decupată; adăugați blatul șirului.',
  'Sink cut-out {w} mm is wider than {name} under it ({width} mm).':
    'Decupajul chiuvetei de {w} mm este mai lat decât {name} de sub el ({width} mm).',
  'Hob cut-out {w} mm is wider than {name} under it ({width} mm).':
    'Decupajul plitei de {w} mm este mai lat decât {name} de sub el ({width} mm).',
  'Sink cut-out {w} mm wide at {x} mm from the left goes past {name} under it ({width} mm).':
    'Decupajul chiuvetei de {w} mm lățime, la {x} mm de la stânga, depășește {name} de sub el ({width} mm).',
  'Hob cut-out {w} mm wide at {x} mm from the left goes past {name} under it ({width} mm).':
    'Decupajul plitei de {w} mm lățime, la {x} mm de la stânga, depășește {name} de sub el ({width} mm).',
  'depth match: floor units side by side should be equally deep':
    'potrivire adâncime: corpurile de podea alăturate trebuie să aibă aceeași adâncime',
  'height match: base units under one worktop should be equally high':
    'potrivire înălțime: corpurile de bază sub același blat trebuie să aibă aceeași înălțime',
} as const satisfies Record<string, PrintKey>;
