/**
 * Print text (ADR-157). Key: the Romanian text (ADR-020); `PRINT_RU` and `PRINT_EN` give it in Russian and English.
 * `PRINT_EN` has the same keys as `PRINT_RU`, so a Romanian text without both fails the type check.
 */
export const PRINT_RU = {
  'Un despărțitor din rândul {i} este aliniat cu unul din rândul de deasupra.':
    'Перегородка в ряду {i} совпадает с перегородкой в ряду выше.',
  // Units and the parts CSV (src/core/ro.ts)
  mm: 'мм',
  Denumire: 'Наименование',
  Material: 'Материал',
  Grosime: 'Толщина',
  Lungime: 'Длина',
  Lățime: 'Ширина',
  'Buc.': 'Кол.',
  'Cant L': 'Кромка Д',
  'Cant l': 'Кромка Ш',
  'Tip cant': 'Тип кромки',
  Fibră: 'Текстура',
  Găurire: 'Присадка',
  nespecificat: 'не указана',
  'pe lungime': 'вдоль длины',
  nu: 'нет',
  // Edge band
  melamină: 'меламин',
  furnir: 'шпон',
  'alt tip': 'другой тип',
  'cant ': 'кромка ',
  fronturi: 'фасады',
  'unele piese: nespecificat': 'для некоторых деталей не указана',
  // Band guidance the user typed (ADR-301)
  'grosime ±{v}': 'толщина ±{v}',
  'lățime ±{v}': 'ширина ±{v}',
  'surplus de tăiat {v} pe parte': 'свес под обрезку {v} на сторону',
  'mașina de cantuit: {s}': 'кромкооблицовочный станок: {s}',
  'cant, după fișa dvs. (orientativ): {list}':
    'кромка, по вашему техническому листу (ориентир): {list}',
  // Drilling
  '$1 rânduri × $2 găuri ø$3, la $4 mm de margini': 'ряды: $1 × $2 отв. ø$3, $4 мм от краёв',
  '(ambele fețe, decalat 16 mm)': '(обе пласти, со смещением 16 мм)',
  ', o față': ', одна пласть',
  'găuri mâner ø$1 la': 'отверстия под ручку ø$1:',
  'gaură mâner ø$1 la': 'отверстие под ручку ø$1:',
  'mm de la stânga/jos': 'мм от левого/нижнего края',
  'tăiere după șablon ($1 puncte)': 'раскрой по шаблону (точек: $1)',
  // Cut-outs and worktop joints (ADR-205)
  'decupaj {w} × {h} mm la {u}/{v} mm de la stânga/jos':
    'вырез {w} × {h} мм в {u}/{v} мм от левого/нижнего края',
  'decupaj chiuvetă {w} × {d} mm': 'вырез под мойку {w} × {d} мм',
  'decupaj plită {w} × {d} mm': 'вырез под варочную панель {w} × {d} мм',
  'îmbinare la 45°': 'соединение под 45°',
  'îmbinare cap la cap cu {other}': 'соединение встык с {other}',
  // Placed cut-outs, moulding profiles, worktop edges and fixing positions (ADR-209)
  'decupaj {what} {w} × {d} mm, la {x} mm de stânga și {z} mm de față':
    'вырез {what} {w} × {d} мм, в {x} мм от левого края и {z} мм от переднего',
  chiuvetă: 'под мойку',
  plită: 'под варочную панель',
  'profil {w} × {h} mm, desenat de tine': 'профиль {w} × {h} мм, нарисован вами',
  'cant rotunjit R{s} mm': 'скруглённая кромка R{s} мм',
  'cant teșit {s} mm': 'скошенная кромка {s} мм',
  'găuri de fixare la {list} mm, orientativ, din valorile tale':
    'отверстия под крепёж в {list} мм, ориентировочно, по вашим значениям',
  // Hardware
  'Pereche glisiere cu bile, montaj lateral': 'Пара шариковых направляющих, боковой монтаж',
  'joc {gap} mm pe parte': 'зазор {gap} мм на сторону',
  'Balama aplicată, cupă 35 mm, soft-close, clip-on':
    'Петля накладная, чашка 35 мм, с доводчиком, clip-on',
  '{n} pe ușă (orientativ — verificați fișa tehnică)':
    '{n} на дверцу (ориентировочно — сверьтесь с техпаспортом)',
  'Bară haine': 'Штанга для одежды',
  'tăiată la lățimea golului': 'отрезать по ширине проёма',
  'Suport bară haine': 'Держатель штанги',
  'Suport raft (pin) ø5': 'Полкодержатель (штифт) ø5',
  '4 pe raft mobil': '4 на съёмную полку',
  'Mâner, {s} mm între găuri': 'Ручка, {s} мм между отверстиями',
  Buton: 'Ручка-кнопка',
  'Sistem push-to-open': 'Система push-to-open',
  'balamale fără arc de închidere la uși': 'петли без пружины закрывания на дверцах',
  'Agățătoare reglabilă pentru corp suspendat': 'Регулируемый навес для навесного шкафа',
  'câte una în colțurile de sus din spate (verificați fișa tehnică și tipul peretelui)':
    'по одному в верхних задних углах (сверьтесь с техпаспортом и типом стены)',
  'Șină de perete pentru agățători': 'Монтажная шина для навесов',
  'tăiată la lățimea corpului': 'отрезать по ширине корпуса',
  'Agățători de perete pentru corpul de colț: la alegerea dvs.':
    'Навесы для углового модуля: на ваш выбор',
  'alegeți agățătorile, câte și unde, după fișa tehnică și tipul peretelui':
    'подберите навесы, их количество и места по техпаспорту и типу стены',
  'Set balama de colț (leagă cele două uși)': 'Комплект угловой петли (соединяет две дверцы)',
  'verificați setul și balamalele înlocuite în fișa tehnică':
    'сверьте комплект и заменяемые петли с техпаспортом',
  'Prindere anti-răsturnare în perete': 'Крепление к стене от опрокидывания',
  'Prindere de sine stătătoare: în podea sau tavan':
    'Крепление отдельностоящего изделия: к полу или потолку',
  'alegeți prinderea după tipul podelei sau al tavanului (orientativ)':
    'крепёж подберите по типу пола или потолка (ориентировочно)',
  'alegeți diblurile după tipul peretelui (orientativ)':
    'дюбели подберите по типу стены (ориентировочно)',
  'Electrocasnic încorporat: ': 'Встраиваемая техника: ',
  'verificați nișa după desenul de montaj al aparatului':
    'проверьте нишу по монтажной схеме прибора',
  'Kit prindere front': 'Комплект крепления фасада',
  'de obicei livrat cu aparatul — verificați desenul de montaj':
    'обычно поставляется с прибором — проверьте монтажную схему',
  'Șină uși glisante, sus și jos': 'Профиль для дверей-купе, верхний и нижний',
  'verificați sistemul glisant în fișa tehnică': 'сверьте раздвижную систему с техпаспортом',
  'Mecanism clapă': 'Подъёмный механизм фасада',
  'alegeți după greutatea și înălțimea frontului (fișa tehnică)':
    'подберите по весу и высоте фасада (техпаспорт)',
  'Șuruburi pentru PAL': 'Саморезы для ДСП',
  '{note} — alegeți tipul, lungimea și numărul (orientativ)':
    '{note} — подберите тип, длину и количество (ориентировочно)',
  // Printed sheet (src/ui/PrintSheet.tsx)
  'Fișă de debitare': 'Карта раскроя',
  proiect: 'проект',
  'gabarit {w} × {h} × {d} mm': 'габарит {w} × {h} × {d} мм',
  'Dimensiuni finite, în mm. Cantul este marcat (L = pe lungime, l = pe lățime), nu scăzut din dimensiuni. Fibra urmează lungimea la plăcile cu fibră. Tăietură {kerf} mm.':
    'Чистовые размеры, в мм. Кромка отмечена (Д = по длине, Ш = по ширине) и не вычтена из размеров. Текстура идёт вдоль длины у плит с текстурой. Пропил {kerf} мм.',
  'Vedere frontală': 'Вид спереди',
  'Piese în proiect': 'Изделия в проекте',
  Piesă: 'Изделие',
  'Poziție x / y / z': 'Положение x / y / z',
  Rotire: 'Поворот',
  'Listă de piese': 'Список деталей',
  'cant {m} m': 'кромка {m} м',
  'fibră pe lungime': 'текстура вдоль длины',
  'Gros.': 'Толщ.',
  Feronerie: 'Фурнитура',
  Articol: 'Позиция',
  Dimensiune: 'Размер',
  Notă: 'Примечание',
  'Șuruburile și elementele de îmbinare nu sunt incluse, în afara îmbinărilor cu șuruburi numite în proiect (șuruburile le alegeți dvs.).':
    'Винты и крепёж не включены, кроме винтовых соединений, указанных в проекте (винты подбираете вы).',
  'De verificat': 'Проверить',
  'Șabloane la scară 1:1': 'Шаблоны в масштабе 1:1',
  'Tipăriți la 100% (fără „potrivire în pagină”) și verificați bara de 100 mm. Foile se suprapun {overlap} mm: lipiți-le după marcaje. Linia punctată este semifabricatul din lista de piese.':
    'Печатайте в масштабе 100 % (без «по размеру страницы») и проверьте отрезок 100 мм. Страницы перекрываются на {overlap} мм: склейте их по меткам. Пунктир — заготовка из списка деталей.',
  Semifabricat: 'Заготовка',
  'Puncte (mm, de la colțul stânga-sus)': 'Точки (мм, от левого верхнего угла)',
  Foi: 'Страницы',
  'Șablon {part} — foaia {i} din {n} (coloana {col}, rândul {row})':
    'Шаблон {part} — страница {i} из {n} (столбец {col}, ряд {row})',
  'Plan de debitare': 'Карта раскроя листов',
  'Așezare euristică pentru tăieturi cap la cap; nu garantează numărul minim de plăci.':
    'Эвристическая раскладка под сквозные резы; минимальное число листов не гарантируется.',
  Plăci: 'Листы',
  Format: 'Формат',
  Margine: 'Отступ от края',
  Utilizare: 'Использование',
  invalid: 'ошибка',
  'placa {i} din {n}': 'лист {i} из {n}',
  // Review pack (src/core/reviewPack.ts)
  '{w} × {d} mm, văzut de sus; linia portocalie = fața':
    '{w} × {d} мм, вид сверху; оранжевая линия — фасад',
  Eroare: 'Ошибка',
  Atenție: 'Внимание',
  'Aplicația nu a găsit probleme.': 'Приложение не нашло проблем.',
  'de verificat': 'на проверку',
  'Proiect de verificat': 'Проект на проверку',
  '{n} piese': '{n|# изделие|# изделия|# изделий}',
  'Dimensiuni în mm. Poziția este colțul din stânga-spate-jos al piesei (x de la stânga, y de la podea, z de la peretele din spate). Rotirea este în grade, în jurul centrului piesei.':
    'Размеры в мм. Положение — левый задний нижний угол изделия (x от левого края, y от пола, z от задней стены). Поворот — в градусах, вокруг центра изделия.',
  Piese: 'Изделия',
  'Lățime × înălțime × adâncime': 'Ширина × высота × глубина',
  'Probleme găsite de aplicație': 'Проблемы, найденные приложением',
  Fișiere: 'Файлы',
  'Lista de piese (CSV), planul văzut de sus și vederea 3D (SVG), fișierul proiectului (JSON, se deschide în aplicație).':
    'Список деталей (CSV), план сверху и 3D-вид (SVG), файл проекта (JSON, открывается в приложении).',
  // Review pack file names (src/core/reviewPack.ts, src/ui/ReviewPack.tsx)
  rezumat: 'сводка',
  piese: 'детали',
  'de-verificat': 'на-проверку',
  // Assembly sheet (ADR-174)
  'Fișă de asamblare': 'Лист сборки',
  Pas: 'Шаг',
  Părți: 'Части',
  'Îmbinări și feronerie': 'Соединения и фурнитура',
  'Îndrumare: ordinea rezultă din pozițiile pieselor; îmbinările, elementele de fixare și găurirea sunt alegerea dumneavoastră.':
    'Рекомендация: порядок следует из положения деталей; соединения, крепёж и присадка — ваш выбор.',
  Fundul: 'Дно',
  'Laturile pe fund': 'Боковины на дно',
  'Despărțitoare și polițe fixe': 'Перегородки и неподвижные полки',
  Capacul: 'Крышка',
  Spatele: 'Задняя стенка',
  Soclul: 'Цоколь',
  'Polițe reglabile': 'Переставные полки',
  'Corpuri de sertar': 'Корпуса ящиков',
  'Uși și fronturi': 'Двери и фасады',
  Mânere: 'Ручки',
  'Prindere și fixare': 'Навес и крепление',
  'Piese libere': 'Свободные детали',
  'De asemenea': 'Также',
  // Assembly steps re-check (ADR-185, ADR-186)
  'Pregătirea pieselor': 'Подготовка деталей',
  'Feroneria pe laterale': 'Фурнитура на боковины',
  'Montarea sertarelor și ușilor, reglarea fronturilor':
    'Установка ящиков и дверей, регулировка фасадов',
  'Corp de sertar × {n}': 'Корпус ящика × {n}',
  'jumătățile de corp': 'корпусные половинки',
  'jumătățile de sertar': 'ящичные половинки',
  'plăcuțe de montaj': 'монтажные планки',
  'cupe și brațe, pe uși': 'чашки и плечи, на дверцах',
  '{n|# îmbinare|# îmbinări}': '{n|# соединение|# соединения|# соединений}',
  '{n|# suport de raft|# suporți de raft}':
    '{n|# полкодержатель|# полкодержателя|# полкодержателей}',
  '{n|# panou de spate|# panouri de spate}': '{n|# задняя стенка|# задние стенки|# задних стенок}',
  '{n|# agățătoare|# agățători}': '{n|# навес|# навеса|# навесов}',
  '{n|# blat|# blaturi}': '{n|# столешница|# столешницы|# столешниц}',
  '{n|# piesă pe soclu|# piese pe soclu}':
    '{n|# изделие на цоколе|# изделия на цоколе|# изделий на цоколе}',
  '{count} — alegeți elementul de fixare ({path})': '{count} — выберите крепёж ({path})',
  'Setări › Elemente de fixare': 'Настройки › Крепёж',
  '{n|# latură lungă|# laturi lungi}': '{n|# длинная сторона|# длинные стороны|# длинных сторон}',
  '{n|# latură scurtă|# laturi scurte}':
    '{n|# короткая сторона|# короткие стороны|# коротких сторон}',
  'cant pe {what}': 'кромка: {what}',
  'Cupe de balama de găurit: {n} — {hinge}': 'Чашки петель к сверлению: {n} — {hinge}',
  'Rânduri pentru suporți de raft de găurit: {n|# piesă|# piese}':
    'Ряды под полкодержатели к сверлению: {n|# деталь|# детали|# деталей}',
  ' și ': ' и ',
  ' ({n|# îmbinare|# îmbinări})': ' ({n|# соединение|# соединения|# соединений})',
  'cantuiți muchiile la {n|# piesă|# piese}': 'оклейте кромкой {n|# деталь|# детали|# деталей}',
  'găuriți {n|# cupă de balama|# cupe de balama}':
    'просверлите {n|# чашку петли|# чашки петель|# чашек петель}',
  'găuriți rândurile pentru suporți de raft în {n|# piesă|# piese}':
    'просверлите ряды под полкодержатели в {n|# детали|# деталях|# деталях}',
  'Înainte de asamblare: {what}.': 'До сборки: {what}.',
  'jumătățile de corp ale glisierelor ({n|# pereche|# perechi})':
    'корпусные половинки направляющих ({n|# пара|# пары|# пар})',
  'plăcuțele de montaj ale balamalelor ({n})': 'монтажные планки петель ({n})',
  'Fixați {what} pe laterale cât stau culcate.': 'Закрепите {what} на боковинах, пока они лежат.',
  'Așezați pe o suprafață plană, cu fața interioară în sus: {parts}.':
    'Положите на ровную поверхность внутренней стороной вверх: {parts}.',
  'Fixați pe bază: {parts}{joints}.': 'Прикрепите к дну: {parts}{joints}.',
  'Fixați între laterale: {parts}{joints}.': 'Закрепите между боковинами: {parts}{joints}.',
  'Fixați deasupra lateralelor: {parts}{joints}.':
    'Закрепите сверху на боковинах: {parts}{joints}.',
  'Verificați că corpul este în echer (diagonale egale) înainte de a fixa spatele.':
    'Проверьте, что корпус прямоугольный (диагонали равны), прежде чем крепить заднюю стенку.',
  'Apoi fixați pe corp: {parts}{joints}.': 'Затем закрепите на корпусе: {parts}{joints}.',
  'Fixați sub corp: {parts}{joints}.': 'Закрепите под корпусом: {parts}{joints}.',
  'Puneți suporții de raft la înălțimile dorite și așezați pe ei: {parts}.':
    'Вставьте полкодержатели на нужной высоте и положите на них: {parts}.',
  'Asamblați {n|# corp de sertar|# corpuri de sertar} și fixați jumătățile de sertar ale glisierelor pe laterale.':
    'Соберите {n|# корпус ящика|# корпуса ящиков|# корпусов ящиков} и закрепите на их боковинах ящичные половинки направляющих.',
  'Asamblați {n|# corp de sertar|# corpuri de sertar}.':
    'Соберите {n|# корпус ящика|# корпуса ящиков|# корпусов ящиков}.',
  'montați balamalele pe uși': 'установите петли на дверцы',
  'pregătiți ușile pentru montaj': 'подготовьте дверцы к установке',
  'fixați fronturile pe corpurile de sertar': 'закрепите фасады на корпусах ящиков',
  'fixați: {parts}': 'закрепите: {parts}',
  'montați feroneria de aici': 'установите указанную здесь фурнитуру',
  'Fixați mânerele pe fronturi.': 'Закрепите ручки на фасадах.',
  'agățați corpul pe agățători': 'навесьте изделие на навесы',
  'agățați ușile': 'навесьте дверцы',
  'introduceți sertarele': 'вставьте ящики',
  'reglați fronturile până când rosturile sunt egale':
    'отрегулируйте фасады, чтобы зазоры были равными',
  'Îmbinați piesele după cum decideți; nu se propune o ordine.':
    'Соедините детали так, как решите сами; порядок не предлагается.',
  'Montați aceste piese la locul lor.': 'Установите эти детали на свои места.',
  // Project order on the assembly sheet (ADR-178)
  'Ordinea în proiect': 'Порядок в проекте',
  'Corpuri de colț': 'Угловые шкафы',
  'Corpuri de jos': 'Нижние изделия',
  'Corpuri suspendate': 'Навесные изделия',
  'Piese de rând': 'Детали ряда',
  'Decupaj chiuvetă {w} × {d} mm': 'Вырез под мойку {w} × {d} мм',
  'peretele {n}': 'стена {n}',
  // Shopping list unit price (ADR-181)
  'Preț unitar': 'Цена за единицу',
  '/ placă': '/ лист',
  '/ m²': '/ м²',
  '/ m': '/ м',
  '/ buc': '/ шт.',
  '/ blat': '/ щит столешницы',
  // Shopping list headers, sections and units (ADR-181: "All headers via print language")
  'Listă de cumpărături — {name}': 'Список покупок — {name}',
  Secțiune: 'Раздел',
  Cantitate: 'Количество',
  UM: 'Ед. изм.',
  Detalii: 'Подробности',
  Preț: 'Цена',
  Cant: 'Кромка',
  'Piese de linie': 'Детали ряда',
  'De ales înainte de cumpărare': 'Выбрать перед покупкой',
  plăci: 'листы',
  'm²': 'м²',
  m: 'м',
  // Fastener lines on the shopping CSV and printed list (ADR-202)
  'Fixare îmbinări': 'Крепёж соединений',
  'Suporți de raft': 'Полкодержатели',
  'Fixare panouri de spate': 'Крепёж задних стенок',
  'Fixare agățători': 'Крепёж навесов',
  'Fixare blaturi': 'Крепёж столешниц',
  Picioare: 'Опоры',
  'fiecare loc unde se întâlnesc două plăci ale corpului: laterale, capac, bază, despărțitori, rafturi fixe, traverse':
    'каждое место, где встречаются две плиты корпуса: боковины, крышка, дно, перегородки, неподвижные полки, царги',
  'suporții de raft din lista de feronerie': 'полкодержатели и опоры из перечня фурнитуры',
  'fiecare panou de spate, fixat pe tot perimetrul':
    'каждая задняя стенка, крепится по всему периметру',
  'fiecare agățătoare a unei piese suspendate': 'каждый навес навесного изделия',
  'fiecare blat, de linie sau de birou': 'каждая столешница, ряда или стола',
  'fiecare piesă așezată pe soclu': 'каждое изделие на цоколе',
  ', {m} m de margine a spatelui': ', {m} м кромки задней стенки',
  ', {m} m de blat': ', {m} м столешницы',
  'Orientativ: numărat din model': 'Ориентировочно: подсчитано по модели',
  '{line}: {count} — alegeți elementul de fixare': '{line}: {count} — выберите крепёж',
  '{guidance} ({how}{len}). Numiți-l pe al dvs. în {path}.':
    '{guidance} ({how}{len}). Укажите свой в разделе {path}.',
  'Șuruburile, diblurile și excentricii sunt numărați doar ca îmbinări, orientativ; elementul de fixare îl alegeți dvs. ({path}). Lipiciul nu este numărat.':
    'Шурупы, шканты и эксцентрики учитываются только как соединения, ориентировочно; крепёж выбираете вы ({path}). Клей не учитывается.',
  buc: 'шт.',
  // Client sheet and step pictures (ADR-206)
  'Fișă pentru client': 'Лист для клиента',
  'Preț estimat': 'Ориентировочная цена',
  '{n|# linie fără preț|# linii fără preț}':
    '{n|# строка без цены|# строки без цены|# строк без цены}',
  // The printed Shopping list's estimate (ADR-260)
  'Estimare: {total} {currency}': 'Оценка: {total} {currency}',
  // The printed front view's space labels (ADR-265)
  Gol: 'Пусто',
  '{n|# raft|# rafturi}': '{n|# полка|# полки|# полок}',
  '{n|# sertar|# sertare}': '{n|# ящик|# ящика|# ящиков}',
  'Spațiu de agățat': 'Для вешалок',
  ' — {n|# preț lipsă|# prețuri lipsă}': ' — без цены: {n}',
  ' (prețurile tale; {n|# linie|# linii} la prețuri de vânzător: {sellers})':
    ' (ваши цены; {n|# строка|# строки|# строк} по ценам продавца: {sellers})',
  ' (prețurile tale)': ' (ваши цены)',
  'Dimensiuni L × Î × A, mm': 'Размеры Ш × В × Г, мм',
  'Prețuri de vânzător: {sellers}': 'Цены продавца: {sellers}',
  'Imaginile pașilor cer vizualizarea 3D': 'Для картинок шагов нужен 3D-вид',
  // Warnings on the cut sheet (ADR-265, src/core/i18n/warning-text.ts)
  '{n|O piesă cu cant propriu nu mai există|# piese cu cant propriu nu mai există} (piesa s-a schimbat); cantul nu este folosit. Ștergeți-l la „Material” → „Part”.':
    '{n|Деталь|# детали|# деталей} со своей кромкой больше не {n|существует|существуют|существуют} (изделие изменилось); кромка не используется. Сбросьте её в окне «Материал» → «Деталь».',
  'O piesă cu placă proprie nu mai există (piesa s-a schimbat); placa aleasă nu este folosită. Ștergeți alegerea la „Material” → „Part”.':
    'Деталь со своей плитой больше не существует (изделие изменилось); выбор плиты не используется. Сбросьте его в окне «Материал» → «Деталь».',
  '{n} piese cu placă proprie nu mai există (piesa s-a schimbat); placa aleasă nu este folosită. Ștergeți alegerea la „Material” → „Part”.':
    'Детали со своей плитой ({n} шт.) больше не существуют (изделие изменилось); выбор плиты не используется. Сбросьте его в окне «Материал» → «Деталь».',
  '{part} are doar {w} mm lățime.': '«{part}» шириной всего {w} мм.',
  '{board} este marcată ca blat de bucătărie, dar este folosită pentru {part} (orientativ).':
    '«{board}» отмечена как кухонная столешница, но используется для детали «{part}» (ориентир).',
  '{board} este marcată ca blat de bucătărie, dar este folosită pentru {n} piese care nu sunt blaturi (orientativ).':
    '«{board}» отмечена как кухонная столешница, но используется для деталей, которые не столешницы: {n} (ориентир).',
  'Mânerul de {s} mm nu încape pe {part} ({along} mm).':
    'Ручка {s} мм не помещается на детали «{part}» ({along} мм).',
  'Un blat dublat se aplică unui panou de blat întreg; cele două traverse de sus rămân simple.':
    'Двойная крышка применяется только к сплошной крышке; две верхние планки остаются одинарными.',
  'Un corp de podea fără fund nu are pe ce să sprijine conținutul; este gândit pentru corpurile de deasupra unei hote.':
    'У напольного шкафа без дна содержимому не на что опираться; так делают только шкафы над вытяжкой.',
  'Suporturile de agățare cer de obicei spatele retras cu aproximativ 15–20 mm; verificați fișa tehnică a suportului.':
    'Для навесов задняя стенка обычно утоплена примерно на 15–20 мм; сверьтесь с техпаспортом навеса.',
  'Ușile glisante merg în fața corpului; stilul de front încastrat nu li se aplică.':
    'Раздвижные дверцы идут перед корпусом; вкладной фасад к ним не применяется.',
  'Alegeți sistemul de ridicare pentru acest front de {w}×{h} mm din fișa lui tehnică și denumiți-l aici.':
    'Подберите подъёмный механизм для этого фасада {w}×{h} мм по его техпаспорту и укажите его здесь.',
  'Alegeți brațul pentru clapă pentru acest front de {w}×{h} mm din fișa lui tehnică și denumiți-l aici.':
    'Подберите стай для этого откидного фасада {w}×{h} мм по его техпаспорту и укажите его здесь.',
  'Doar {h} mm de înălțime pentru agățare.': 'Для вешалок всего {h} мм высоты.',
  'Înălțimile sertarelor însumează {asked} mm, dar sunt disponibili {room} mm; sertarul de jos a fost ajustat. Faceți un sertar „Share” ca să preia diferența.':
    'Высоты ящиков в сумме {asked} мм, а места {room} мм; нижний ящик подогнан. Сделайте один ящик «Доля», чтобы он забирал разницу.',
  'Un front fix cere un front de sertar propriu; sertarele din spatele ușilor nu au, deci setarea este ignorată.':
    'Ложному фасаду нужен собственный фасад ящика; у ящиков за дверцами его нет, поэтому настройка не учитывается.',
  'Sertarul de sus este front fix, deci nu are cutie de decupat în jurul sifonului; decupajul în U este ignorat.':
    'Верхний ящик — ложный фасад, у него нет короба для выреза под сифон; U-вырез не учитывается.',
  'Sertarele din spatele ușilor nu au front propriu, deci își păstrează frontul interior.':
    'У ящиков за дверцами нет собственного фасада, поэтому внутренняя передняя стенка остаётся.',
  'Sertarul 1 este decupat în jurul sifonului (decupaj de {w} × {d} mm în spate): verificați sifonul și țevile înainte de tăiere.':
    'Ящик 1 вырезан под сифон (вырез {w} × {d} мм сзади): проверьте сифон и трубы перед раскроем.',
  'Sertare în spatele ușilor: verificați jocul balamalelor și al ușii față de cutiile sertarelor.':
    'Ящики за дверцами: проверьте зазор петель и дверец относительно коробов ящиков.',
  'Dimensiunile fixe însumează {asked} mm, dar sunt disponibili {room} mm; prima parte a fost ajustată la {first} mm. Faceți o parte „Share” ca să preia diferența.':
    'Фиксированные размеры дают в сумме {asked} мм, а места {room} мм; первая часть изменена до {first} мм. Сделайте одну часть «Доля», чтобы поглотить разницу.',
  'Dimensiunile fixe însumează {asked} mm, dar sunt disponibili {room} mm; ultima parte a fost ajustată la {last} mm. Faceți o parte „Share” ca să preia diferența.':
    'Фиксированные размеры в сумме {asked} мм, а места {room} мм; последняя часть подогнана до {last} мм. Сделайте одну часть «Доля», чтобы она забирала разницу.',
  'Rafturile de {d} mm adâncime sunt prea puțin adânci pentru două rânduri de găuri pentru bolțuri, la {s} mm de margini.':
    'Полки глубиной {d} мм слишком мелкие для двух рядов полкодержателей в {s} мм от краёв.',
  'Panoul comun {kind} nu este construit: {reason} Elementele își păstrează panoul propriu.':
    'Общая панель ({kind}) не построена: {reason} Изделия сохраняют свои.',
  'de sus': 'крышки',
  'de jos': 'дна',
  'Panoul comun {kind} acoperă un gol de {n} mm fără nimic dedesubt.':
    'Общая панель ({kind}) перекрывает проём {n} мм, под которым ничего нет.',
  'Unele elemente de sub blatul comun au blat dublat și altele nu; blatul comun este simplu.':
    'Под общей крышкой у части изделий двойная крышка, у части — нет; общая крышка одинарная.',
  '{a} și {b} stau alăturate cu adâncimi diferite ({reason} mm); {text}.':
    '«{a}» и «{b}» стоят рядом с разной глубиной ({reason} мм); {text}.',
  '{a} și {b} sunt sub același blat cu înălțimi diferite ({reason} mm); {text}.':
    '«{a}» и «{b}» под одной столешницей с разной высотой ({reason} мм); {text}.',
  '{a} este conectat de peretele {n}, dar nu mai este îmbinat: {reason}':
    '{a} соединено со стеной {n}, но больше не прилегает: {reason}',
  '{a} și {b} sunt conectate, dar nu mai sunt îmbinate: {reason}':
    '{a} и {b} соединены, но больше не стыкуются: {reason}',
  'Secțiunea oarbă are {blind} mm; aproximativ adâncimea corpului vecin + 50 mm ({d} mm) ține ușa și mânerul acestuia libere față de această ușă.':
    'Глухая часть {blind} мм; примерно глубина соседнего шкафа + 50 мм ({d} мм) не даёт его дверце и ручке задевать эту дверцу.',
  'Spațiul pentru genunchi are {knee} mm lățime; de obicei se folosesc aproximativ 600 mm sau mai mult.':
    'Место для ног шириной {knee} мм; обычно около 600 мм или больше.',
  'Frontul sertarelor iese cu {out} mm peste marginea blatului; setați surplombul la cel puțin {min} mm.':
    'Фасады ящиков выступают на {out} мм за край столешницы; задайте свес не меньше {min} мм.',
  'Înălțimea liberă sub blat este de {h} mm.': 'Свободная высота под столешницей {h} мм.',
  'Raftul de jos stă între picioare: fixați-l cu suporți sau cepuri (nu sunt incluse în listă).':
    'Нижняя полка стоит между ножками: закрепите её брусками или шкантами (не в списке).',
  'Plăci de șezut și spătar pe o bază cumpărată: baza, ridicătorul cu gaz, mecanismul și suportul spătarului se cumpără și nu sunt desenate.':
    'Щиты сиденья и спинки на покупном основании: основание, газлифт, механизм и опора спинки покупные и не рисуются.',
  'Balustradele aflate la {h} mm deasupra platformei de sus sunt prea joase ca să fie adăugate peste lonjeroanele laterale.':
    'Бортики {h} мм над верхним ложем слишком низкие, чтобы ставить их поверх боковых царг.',
  'Mânerul de {s} mm nu încape pe frontul de {w} mm.':
    'Ручка {s} мм не помещается на фасаде {w} мм.',
  '{n} piese nu au un loc cunoscut și sunt arătate într-o grămadă lângă ansamblu. Cantul nu este stabilit.':
    'У деталей ({n} шт.) нет известного места, они показаны стопкой рядом со сборкой. Кромка не задана.',
  'Panouri libere, arătate într-o grămadă: modul în care se îmbină nu este în proiect. Cantul nu este stabilit.':
    'Отдельные щиты, показаны одной стопкой: как они собираются, в проекте не указано. Кромка не задана.',
  'Îmbinări cu șuruburi: alegeți tipul, lungimea și numărul de șuruburi pentru placă (orientativ, nu sunt în listă).':
    'Винтовые соединения: подберите тип, длину и количество шурупов для плиты (ориентир, не в списке).',
  '{name} a fost așezat pe o piesă care nu mai este în proiect; rămâne unde este.':
    '{name} было поставлено на изделие, которого больше нет в проекте; оно остаётся на месте.',
  '{name} este ridicat de la podea fără nimic dedesubt; setați-l să se agațe pe suporți de perete („Whole cabinet” → „Stands on”).':
    '{name} поднято над полом, и под ним ничего нет; повесьте его на настенные кронштейны (Весь шкаф → Опора).',
  '{name} este făcut să se agațe pe perete, dar este așezat pe podea.':
    '{name} сделано для подвеса на стену, но стоит на полу.',
  '{board} are setări de placă diferite în {name}; placa primei piese ({l} × {w}) este folosită pentru tot proiectul.':
    '{board} имеет другие настройки листа в {name}; для всего проекта используется лист первого изделия ({l} × {w}).',
  '{front} de la {name} nu se poate deschide complet: lovește {other} (are nevoie de {need} mm, sunt {free} mm liberi).':
    '{front} изделия {name} не открывается полностью: упирается в {other} (нужно {need} мм, свободно {free} мм).',
  '{front} de la {a} și {other} de la {b} se deschid în același spațiu.':
    '{front} изделия {a} и {other} изделия {b} открываются в одно и то же место.',
  'Blatul de peste {name} are o margine {what}, dar fără dimensiune; introduceți dimensiunea marginii. Până atunci este desenat drept.':
    'У столешницы над {name} {what} кромка, но без размера; введите размер кромки. До тех пор она рисуется прямой.',
  'Marginea {what} a blatului de peste {name} are {size} mm, nu mai mică decât blatul de {t} mm; este desenat drept.':
    '{what} кромка столешницы над {name} — {size} мм, не меньше толщины столешницы {t} мм; она рисуется прямой.',
  '{name} stă în calea {door} (are nevoie de {mm} mm ca să se deschidă).':
    '{name} мешает {door} (ей нужно {mm} мм для открывания).',
  '{name} acoperă fereastra {window}: stă lângă peretele ei și este cu {mm} mm mai înalt decât pervazul.':
    '{name} закрывает окно {window}: стоит у его стены и на {mm} мм выше подоконника.',
  '{front} de la {name} nu se poate deschide complet: lovește un perete (are nevoie de {need} mm).':
    '{front} изделия {name} не открывается полностью: упирается в стену (нужно {need} мм).',
  '{outlet} este ascunsă în spatele {name}: mutați priza sau piesa.':
    '{outlet} скрыта за {name}: перенесите розетку или изделие.',
  'Țeavă în spatele {name} ({label}): tăiați {part} sau mutați piesa.':
    'Труба за {name} ({label}): сделайте вырез в {part} или переместите изделие.',
  'Priză în spatele {name} ({label}): tăiați {part} sau mutați piesa.':
    'Розетка за {name} ({label}): сделайте вырез в {part} или переместите изделие.',
  'Deschiderea raftului de {span} mm este mare pentru {name} de {t} mm și se poate îndoi (limită obișnuită {limit} mm — confirmați pentru placa și sarcina dvs.).':
    'Пролёт полки {span} мм велик для «{name}» {t} мм, полка может прогнуться (типичный предел {limit} мм — уточните для своей плиты и нагрузки).',
  'Ușă de {w} mm lățime; peste ~{max} mm (obișnuit) luați în calcul două uși.':
    'Дверца шириной {w} мм; при ширине больше ~{max} мм (типично) лучше две дверцы.',
  'Adâncimea deschiderii este {depth} mm; umerașele cer de obicei aproximativ {need} mm (obișnuit).':
    'Глубина проёма {depth} мм; вешалкам обычно нужно около {need} мм (типично).',
  'Asamblată culcat, piesa are nevoie de {diag} mm ca să fie ridicată, dar camera are {room} mm înălțime. Construiți-o la locul ei sau împărțiți-o.':
    'Чтобы поднять изделие, собранное лёжа, нужно {diag} мм, а высота комнаты {room} мм. Соберите его на месте или разделите.',
  'Alegeți {what} din fișa tehnică a producătorului și verificați dimensiunile de montaj față de această piesă.':
    'Выберите по техпаспорту производителя: {what} — и сверьте установочные размеры с этим изделием.',
  'Distanța dintre lamele este {gap} mm; producătorii de saltele și de scaune cer de obicei 70 mm sau mai puțin (verificați la ai dvs.).':
    'Зазор между ламелями {gap} мм; производители матрасов и сидений обычно требуют 70 мм или меньше (проверьте свои).',
  'Paturile suprapuse sunt reglementate de standarde de siguranță (EN 747 și altele). Mobila nu verifică balustradele, deschiderile sau scara în raport cu ele; aceasta nu este o verificare de conformitate.':
    'Двухъярусные кровати подпадают под стандарты безопасности (EN 747 и другие). Mobila не проверяет по ним бортики, проёмы и лестницу; это не проверка соответствия.',
  'Pătuțurile și leagănele sunt reglementate de standarde de siguranță (EN 716 și altele). Mobila nu verifică distanța dintre bare sau înălțimea laterală; aceasta nu este o verificare de conformitate.':
    'Детские кроватки и колыбели подпадают под стандарты безопасности (EN 716 и другие). Mobila не проверяет шаг прутьев и высоту бортов; это не проверка соответствия.',
  'Traversele au o deschidere de {span} mm între picioare; mesele lungi primesc de obicei un picior sau o traversă la mijloc (obișnuit).':
    'Царги перекрывают {span} мм между ножками; длинным столам обычно добавляют среднюю ножку или царгу (типично).',
  'Laturile comune nu sunt construite: {reason} Elementele își păstrează ambele laturi.':
    'Общие боковины не построены: {reason} Изделия сохраняют обе свои боковины.',
  '{set} este incomplet; piesele lui își păstrează ultimele valori.':
    '{set} не завершён; его изделия сохраняют последние значения.',
  '{name}: {field} își păstrează valoarea — urmează „{expr}”, dar acea dimensiune este blocată.':
    '{name}: {field} сохраняет значение — поле следует «{expr}», но этот размер закреплён.',
  'Selectați două sau mai multe elemente care stau alăturate.':
    'Выберите два и более изделий, стоящих рядом.',
  'Un element al acestui panou comun a fost șters.': 'Изделие этой общей панели удалено.',
  '{name} nu este corp, corp de colț sau birou.': '{name} — не шкаф, не угловой модуль и не стол.',
  '{name} nu are fund.': 'У {name} нет дна.',
  '{name} este numărat de mai multe ori.': '{name} учтено больше одного раза.',
  'Elementele nu sunt întoarse în același sens.': 'Изделия повёрнуты по-разному.',
  '{name} are altă înălțime a soclului.': 'У {name} другая высота цоколя.',
  '{name} are alt spate.': 'У {name} другая задняя стенка.',
  '{name} nu are {part}.': 'У {name} нет: {part}.',
  '{name} nu are aceeași înălțime sau același nivel de la podea.':
    '{name} другой высоты или стоит на другом уровне.',
  '{part} de la {name} are altă grosime.': 'У {name} другая толщина ({part}).',
  'Aceste elemente nu fac un singur blat fără goluri.':
    'Эти изделия не образуют одну панель без отверстий.',
  '{name} nu are aceeași adâncime sau nu este aliniat.':
    '{name} другой глубины или не на одной линии.',
  '{name} nu atinge celelalte și nu este aliniat cu ele.':
    '{name} не касается остальных и не стоит с ними в линию.',
  '{name} este un corp de colț în L sau diagonal; doar un colț orb împarte o latură.':
    '{name} — Г-образный или диагональный угловой модуль; общую боковину может иметь только глухой угол.',
  '{name} nu este corp, colț orb sau birou.':
    '{name} — не шкаф, не глухой угловой модуль и не стол.',
  'Un element al acestor laturi comune a fost șters.': 'Изделие с общими боковинами удалено.',
  '{name} are laturi de altă grosime.': 'У {name} боковины другой толщины.',
  '{a} și {b} nu se ating.': '{a} и {b} не касаются друг друга.',
  '{a} și {b} sunt ambele birouri; un birou împarte o latură doar cu un corp.':
    '{a} и {b} — оба столы; стол делит боковину только со шкафом.',
  '{name} se întâlnește cu vecinul la capătul orb; doar capătul drept împarte o latură.':
    '{name} примыкает к соседу глухим концом; общую боковину может иметь только прямой конец.',
  '{name} are un bloc de sertare la acel capăt; doar un capăt cu perete lateral împarte o latură.':
    'У {name} с этой стороны тумба; общую боковину может иметь только конец с опорной стенкой.',
  'în colț': 'в углу',
  suprapuse: 'друг над другом',
  'lângă peretele {n}': 'у стены {n}',
  alăturate: 'рядом',
  '{a} și {b} nu se întâlnesc în colț.': '{a} и {b} не сходятся в углу.',
  '{a} și {b} nu sunt una peste alta.': '{a} и {b} не стоят друг над другом.',
  '{a} și {b} nu stau alăturate.': '{a} и {b} не стоят вплотную рядом.',
  'O piesă nu poate fi conectată cu ea însăși.': 'Изделие нельзя соединить с самим собой.',
  'O piesă conectată a fost ștearsă.': 'Соединённое изделие удалено.',
  'O conexiune la perete leagă o singură piesă.':
    'Соединение со стеной относится к одному изделию.',
  '{a} și {b} nu sunt alăturate, în colț sau una peste alta.':
    '{a} и {b} не стоят рядом, в углу или друг над другом.',
  'Camera nu are peretele {n}.': 'В комнате нет стены {n}.',
  '{name} este întors în unghi.': '{name} повёрнуто под углом.',
  'Spatele lui {name} nu este orientat spre peretele {n}.':
    'Задняя сторона {name} не обращена к стене {n}.',
  'Spatele lui {name} nu este lipit de peretele {n}.':
    'Задняя сторона {name} не прилегает к стене {n}.',
  '{name} depășește capătul peretelui {n}.': '{name} выходит за конец стены {n}.',
  'Desenați mai întâi camera: o piesă se pune lângă pereții ei.':
    'Сначала нарисуйте комнату: изделие ставится к её стенам.',
  'Spatele lui {name} nu este lipit de un perete.': 'Задняя сторона {name} не прилегает к стене.',
  '{reason}; {text}': '{reason}; {text}',
  '{reason}; {text}.': '{reason}; {text}.',
  'corp de podea': 'напольный модуль',
  'corp suspendat': 'навесной модуль',
  'piesă așezată peste altă piesă': 'изделие, стоящее на другом изделии',
  latură: 'бок',
  spate: 'задняя стенка',
  față: 'фасад',
  '{what} {a} față de {b}': '{what} {a} и {b}',
  'îmbinarea „{a}” cu „{b}” nu este posibilă; se îmbină doar laturile':
    'нельзя соединить: {a} и {b}; примыкают только боками',
  'îmbinarea „{a}” cu „{b}” nu este posibilă': 'нельзя соединить {a} и {b}',
  'doar spatele unei piese se pune lângă un perete (aici: {face}); o latură se pune lângă un perete doar într-un colț':
    'к стене ставится только задняя сторона изделия (а это его {face}); бок ставится к стене только в углу',
  adâncime: 'глубина',
  înălțime: 'высота',
  '{a} ({fa}: {ra}) și {b} ({fb}: {rb}) nu au nicio cameră în comun':
    'у «{a}» ({fa}: {ra}) и «{b}» ({fb}: {rb}) нет общей комнаты',
  'Chiuveta de peste {name} nu are blat din care să fie decupată; adăugați blatul șirului.':
    'У мойки над {name} нет столешницы для выреза; добавьте столешницу ряда.',
  'Plita de peste {name} nu are blat din care să fie decupată; adăugați blatul șirului.':
    'Для варочной панели над {name} нет столешницы, в которой делать вырез; добавьте столешницу ряда.',
  'Decupajul chiuvetei de {w} mm este mai lat decât {name} de sub el ({width} mm).':
    'Вырез под мойку {w} мм шире, чем {name} под ним ({width} мм).',
  'Decupajul plitei de {w} mm este mai lat decât {name} de sub el ({width} mm).':
    'Вырез под варочную панель {w} мм шире, чем {name} под ним ({width} мм).',
  'Decupajul chiuvetei de {w} mm lățime, la {x} mm de la stânga, depășește {name} de sub el ({width} mm).':
    'Вырез под мойку шириной {w} мм в {x} мм слева выходит за {name} под ним ({width} мм).',
  'Decupajul plitei de {w} mm lățime, la {x} mm de la stânga, depășește {name} de sub el ({width} mm).':
    'Вырез под варочную панель шириной {w} мм в {x} мм слева выходит за {name} под ним ({width} мм).',
  'potrivire adâncime: corpurile de podea alăturate trebuie să aibă aceeași adâncime':
    'одинаковая глубина: напольные модули бок о бок должны быть одной глубины',
  'potrivire înălțime: corpurile de bază sub același blat trebuie să aibă aceeași înălțime':
    'одинаковая высота: нижние модули под одной столешницей должны быть одной высоты',
} satisfies Record<string, string>;

export const PRINT_EN: Record<keyof typeof PRINT_RU, string> = {
  'Un despărțitor din rândul {i} este aliniat cu unul din rândul de deasupra.':
    'A divider in row {i} lines up with one in the row above.',
  mm: 'mm',
  Denumire: 'Part',
  Material: 'Material',
  Grosime: 'Thickness',
  Lungime: 'Length',
  Lățime: 'Width',
  'Buc.': 'Qty',
  'Cant L': 'Band L',
  'Cant l': 'Band W',
  'Tip cant': 'Band type',
  Fibră: 'Grain',
  Găurire: 'Drilling',
  nespecificat: 'not named',
  'pe lungime': 'along length',
  nu: 'no',
  melamină: 'melamine',
  furnir: 'veneer',
  'alt tip': 'other',
  'cant ': 'edge band ',
  fronturi: 'fronts',
  'unele piese: nespecificat': 'some parts: not named',
  'grosime ±{v}': 'thickness ±{v}',
  'lățime ±{v}': 'width ±{v}',
  'surplus de tăiat {v} pe parte': 'overhang to trim {v} per side',
  'mașina de cantuit: {s}': 'edgebander: {s}',
  'cant, după fișa dvs. (orientativ): {list}': 'edge band, from your datasheet (guidance): {list}',
  '$1 rânduri × $2 găuri ø$3, la $4 mm de margini': '$1 rows × $2 holes ø$3, $4 mm from edges',
  '(ambele fețe, decalat 16 mm)': '(both faces, offset 16 mm)',
  ', o față': ', one face',
  'găuri mâner ø$1 la': 'handle holes ø$1 at',
  'gaură mâner ø$1 la': 'handle hole ø$1 at',
  'mm de la stânga/jos': 'mm from left/bottom',
  'tăiere după șablon ($1 puncte)': 'cut to template ($1 points)',
  'decupaj {w} × {h} mm la {u}/{v} mm de la stânga/jos':
    'cut-out {w} × {h} mm at {u}/{v} mm from left/bottom',
  'decupaj chiuvetă {w} × {d} mm': 'sink cut-out {w} × {d} mm',
  'decupaj plită {w} × {d} mm': 'hob cut-out {w} × {d} mm',
  'îmbinare la 45°': 'mitre joint',
  'îmbinare cap la cap cu {other}': 'butt joint against {other}',
  'decupaj {what} {w} × {d} mm, la {x} mm de stânga și {z} mm de față':
    '{what} cut-out {w} × {d} mm, {x} mm from the left and {z} mm from the front',
  chiuvetă: 'sink',
  plită: 'hob',
  'profil {w} × {h} mm, desenat de tine': 'profile {w} × {h} mm, drawn by you',
  'cant rotunjit R{s} mm': 'rounded edge R{s} mm',
  'cant teșit {s} mm': 'bevelled edge {s} mm',
  'găuri de fixare la {list} mm, orientativ, din valorile tale':
    'fixing holes at {list} mm, guidance from your values',
  'Pereche glisiere cu bile, montaj lateral': 'Ball-bearing runner pair, side mount',
  'joc {gap} mm pe parte': '{gap} mm clearance per side',
  'Balama aplicată, cupă 35 mm, soft-close, clip-on':
    'Overlay hinge, 35 mm cup, soft-close, clip-on',
  '{n} pe ușă (orientativ — verificați fișa tehnică)':
    '{n} per door (guidance — check the data sheet)',
  'Bară haine': 'Clothes rail',
  'tăiată la lățimea golului': 'cut to the opening width',
  'Suport bară haine': 'Rail support',
  'Suport raft (pin) ø5': 'Shelf pin ø5',
  '4 pe raft mobil': '4 per adjustable shelf',
  'Mâner, {s} mm între găuri': 'Handle, {s} mm centres',
  Buton: 'Knob',
  'Sistem push-to-open': 'Push-to-open latch',
  'balamale fără arc de închidere la uși': 'hinges without closing spring on doors',
  'Agățătoare reglabilă pentru corp suspendat': 'Adjustable hanging bracket for wall cabinet',
  'câte una în colțurile de sus din spate (verificați fișa tehnică și tipul peretelui)':
    'one in each top back corner (check the data sheet and the wall type)',
  'Șină de perete pentru agățători': 'Wall rail for hanging brackets',
  'tăiată la lățimea corpului': 'cut to the cabinet width',
  'Agățători de perete pentru corpul de colț: la alegerea dvs.':
    'Wall hanging brackets: choose for this corner unit',
  'alegeți agățătorile, câte și unde, după fișa tehnică și tipul peretelui':
    'choose the brackets, how many and where, from the bracket datasheet and the wall type',
  'Set balama de colț (leagă cele două uși)': 'Corner hinge set (joins the two doors)',
  'verificați setul și balamalele înlocuite în fișa tehnică':
    'check the set and the hinges it replaces in the data sheet',
  'Prindere anti-răsturnare în perete': 'Anti-tip wall fixing',
  'Prindere de sine stătătoare: în podea sau tavan': 'Free-standing fixing: floor or ceiling',
  'alegeți prinderea după tipul podelei sau al tavanului (orientativ)':
    'choose the fixing for the floor or ceiling type (guidance)',
  'alegeți diblurile după tipul peretelui (orientativ)':
    'choose plugs for the wall type (guidance)',
  'Electrocasnic încorporat: ': 'Built-in ',
  'verificați nișa după desenul de montaj al aparatului':
    "check the opening against the appliance's installation drawing",
  'Kit prindere front': 'Front fixing kit',
  'de obicei livrat cu aparatul — verificați desenul de montaj':
    'usually supplied with the appliance — check the installation drawing',
  'Șină uși glisante, sus și jos': 'Sliding door track, top and bottom',
  'verificați sistemul glisant în fișa tehnică': 'check the sliding system in the data sheet',
  'Mecanism clapă': 'Flap stay',
  'alegeți după greutatea și înălțimea frontului (fișa tehnică)':
    'choose by front weight and height (data sheet)',
  'Șuruburi pentru PAL': 'Chipboard screws',
  '{note} — alegeți tipul, lungimea și numărul (orientativ)':
    '{note} — choose type, length and count (guidance)',
  'Fișă de debitare': 'Cutting sheet',
  proiect: 'project',
  'gabarit {w} × {h} × {d} mm': 'overall {w} × {h} × {d} mm',
  'Dimensiuni finite, în mm. Cantul este marcat (L = pe lungime, l = pe lățime), nu scăzut din dimensiuni. Fibra urmează lungimea la plăcile cu fibră. Tăietură {kerf} mm.':
    'Finished sizes, in mm. Edge banding is marked (L = along length, W = along width), not deducted from sizes. Grain runs along the length on grained boards. Kerf {kerf} mm.',
  'Vedere frontală': 'Front view',
  'Piese în proiect': 'Pieces in the project',
  Piesă: 'Piece',
  'Poziție x / y / z': 'Position x / y / z',
  Rotire: 'Rotation',
  'Listă de piese': 'Cut list',
  'cant {m} m': 'edge band {m} m',
  'fibră pe lungime': 'grain along length',
  'Gros.': 'Thk.',
  Feronerie: 'Hardware',
  Articol: 'Item',
  Dimensiune: 'Size',
  Notă: 'Note',
  'Șuruburile și elementele de îmbinare nu sunt incluse, în afara îmbinărilor cu șuruburi numite în proiect (șuruburile le alegeți dvs.).':
    'Screws and connectors are not included, except the screwed joints named in the project (you choose the screws).',
  'De verificat': 'To check',
  'Șabloane la scară 1:1': 'Full-size templates (1:1)',
  'Tipăriți la 100% (fără „potrivire în pagină”) și verificați bara de 100 mm. Foile se suprapun {overlap} mm: lipiți-le după marcaje. Linia punctată este semifabricatul din lista de piese.':
    'Print at 100% (no "fit to page") and check the 100 mm bar. Pages overlap {overlap} mm: tape them together at the marks. The dotted line is the blank from the cut list.',
  Semifabricat: 'Blank',
  'Puncte (mm, de la colțul stânga-sus)': 'Points (mm, from the top-left corner)',
  Foi: 'Pages',
  'Șablon {part} — foaia {i} din {n} (coloana {col}, rândul {row})':
    'Template {part} — page {i} of {n} (column {col}, row {row})',
  'Plan de debitare': 'Sheet layouts',
  'Așezare euristică pentru tăieturi cap la cap; nu garantează numărul minim de plăci.':
    'Heuristic layout for guillotine cuts; the minimum number of boards is not guaranteed.',
  Plăci: 'Boards',
  Format: 'Size',
  Margine: 'Trim',
  Utilizare: 'Yield',
  invalid: 'invalid',
  'placa {i} din {n}': 'board {i} of {n}',
  '{w} × {d} mm, văzut de sus; linia portocalie = fața':
    '{w} × {d} mm, seen from above; orange line = front',
  Eroare: 'Error',
  Atenție: 'Warning',
  'Aplicația nu a găsit probleme.': 'The app found no problems.',
  'de verificat': 'for review',
  'Proiect de verificat': 'Project for review',
  '{n} piese': '{n|# piece|# pieces}',
  'Dimensiuni în mm. Poziția este colțul din stânga-spate-jos al piesei (x de la stânga, y de la podea, z de la peretele din spate). Rotirea este în grade, în jurul centrului piesei.':
    "Sizes in mm. The position is the piece's left-back-bottom corner (x from the left, y from the floor, z from the back wall). Rotation is in degrees, about the piece's centre.",
  Piese: 'Pieces',
  'Lățime × înălțime × adâncime': 'Width × height × depth',
  'Probleme găsite de aplicație': 'Problems found by the app',
  Fișiere: 'Files',
  'Lista de piese (CSV), planul văzut de sus și vederea 3D (SVG), fișierul proiectului (JSON, se deschide în aplicație).':
    'Cut list (CSV), plan seen from above and 3D view (SVG), project file (JSON, opens in the app).',
  rezumat: 'summary',
  piese: 'parts',
  'de-verificat': 'to-check',
  'Fișă de asamblare': 'Assembly sheet',
  Pas: 'Step',
  Părți: 'Parts',
  'Îmbinări și feronerie': 'Joints and hardware',
  'Îndrumare: ordinea rezultă din pozițiile pieselor; îmbinările, elementele de fixare și găurirea sunt alegerea dumneavoastră.':
    "Guidance: order from the parts' positions; your joints, fasteners and drilling decide.",
  Fundul: 'Bottom',
  'Laturile pe fund': 'Sides to the bottom',
  'Despărțitoare și polițe fixe': 'Fixed dividers and shelves',
  Capacul: 'Top',
  Spatele: 'Back',
  Soclul: 'Plinth',
  'Polițe reglabile': 'Adjustable shelves',
  'Corpuri de sertar': 'Drawer boxes',
  'Uși și fronturi': 'Doors and fronts',
  Mânere: 'Handles',
  'Prindere și fixare': 'Hanging and fixing',
  'Piese libere': 'Loose parts',
  'De asemenea': 'Also',
  'Pregătirea pieselor': 'Prepare the parts',
  'Feroneria pe laterale': 'Fit hardware to the sides',
  'Montarea sertarelor și ușilor, reglarea fronturilor': 'Fit drawers and doors, adjust the fronts',
  'Corp de sertar × {n}': 'Drawer box × {n}',
  'jumătățile de corp': 'carcass halves',
  'jumătățile de sertar': 'drawer halves',
  'plăcuțe de montaj': 'mounting plates',
  'cupe și brațe, pe uși': 'cups and arms, on the doors',
  '{n|# îmbinare|# îmbinări}': '{n|# joint|# joints}',
  '{n|# suport de raft|# suporți de raft}': '{n|# pin|# pins}',
  '{n|# panou de spate|# panouri de spate}': '{n|# back|# backs}',
  '{n|# agățătoare|# agățători}': '{n|# bracket|# brackets}',
  '{n|# blat|# blaturi}': '{n|# worktop|# worktops}',
  '{n|# piesă pe soclu|# piese pe soclu}': '{n|# piece on a plinth|# pieces on a plinth}',
  '{count} — alegeți elementul de fixare ({path})': '{count} — choose your fastener ({path})',
  'Setări › Elemente de fixare': 'Settings › Fasteners',
  '{n|# latură lungă|# laturi lungi}': '{n|# long edge|# long edges}',
  '{n|# latură scurtă|# laturi scurte}': '{n|# short edge|# short edges}',
  'cant pe {what}': 'band {what}',
  'Cupe de balama de găurit: {n} — {hinge}': 'Hinge cups to drill: {n} — {hinge}',
  'Rânduri pentru suporți de raft de găurit: {n|# piesă|# piese}':
    'Shelf-pin rows to drill: {n|# panel|# panels}',
  ' și ': ' and ',
  ' ({n|# îmbinare|# îmbinări})': ' ({n|# joint|# joints})',
  'cantuiți muchiile la {n|# piesă|# piese}': 'band the edges of {n|# part|# parts}',
  'găuriți {n|# cupă de balama|# cupe de balama}': 'drill {n|# hinge cup|# hinge cups}',
  'găuriți rândurile pentru suporți de raft în {n|# piesă|# piese}':
    'drill the shelf-pin rows in {n|# panel|# panels}',
  'Înainte de asamblare: {what}.': 'Before assembly: {what}.',
  'jumătățile de corp ale glisierelor ({n|# pereche|# perechi})':
    'the carcass halves of the runners ({n|# pair|# pairs})',
  'plăcuțele de montaj ale balamalelor ({n})': 'the hinge mounting plates ({n})',
  'Fixați {what} pe laterale cât stau culcate.': 'Fix {what} to the sides while they lie flat.',
  'Așezați pe o suprafață plană, cu fața interioară în sus: {parts}.':
    'Lay the {parts} on a flat surface, inside face up.',
  'Fixați pe bază: {parts}{joints}.': 'Fix the {parts} to the bottom{joints}.',
  'Fixați între laterale: {parts}{joints}.': 'Fix the {parts} between the sides{joints}.',
  'Fixați deasupra lateralelor: {parts}{joints}.': 'Fix the {parts} on top of the sides{joints}.',
  'Verificați că corpul este în echer (diagonale egale) înainte de a fixa spatele.':
    'Check the carcass is square (equal diagonals) before fixing the back.',
  'Apoi fixați pe corp: {parts}{joints}.': 'Then fix the {parts} to the carcass{joints}.',
  'Fixați sub corp: {parts}{joints}.': 'Fix the {parts} under the carcass{joints}.',
  'Puneți suporții de raft la înălțimile dorite și așezați pe ei: {parts}.':
    'Set the shelf pins at the heights you want and lay the {parts} on them.',
  'Asamblați {n|# corp de sertar|# corpuri de sertar} și fixați jumătățile de sertar ale glisierelor pe laterale.':
    'Assemble {n|# drawer box|# drawer boxes} and fix the drawer halves of the runners to their sides.',
  'Asamblați {n|# corp de sertar|# corpuri de sertar}.':
    'Assemble {n|# drawer box|# drawer boxes}.',
  'montați balamalele pe uși': 'fit the hinges to the doors',
  'pregătiți ușile pentru montaj': 'get the doors ready to fit',
  'fixați fronturile pe corpurile de sertar': 'fix the fronts to the drawer boxes',
  'fixați: {parts}': 'fix the {parts}',
  'montați feroneria de aici': 'fit the hardware listed here',
  'Fixați mânerele pe fronturi.': 'Fix the handles to the fronts.',
  'agățați corpul pe agățători': 'hang the piece on its brackets',
  'agățați ușile': 'hang the doors',
  'introduceți sertarele': 'slide the drawers in',
  'reglați fronturile până când rosturile sunt egale': 'adjust the fronts until the gaps are even',
  'Îmbinați piesele după cum decideți; nu se propune o ordine.':
    'Join the parts as your own design decides; no order is claimed.',
  'Montați aceste piese la locul lor.': 'Fit these parts where they belong.',
  'Ordinea în proiect': 'Project order',
  'Corpuri de colț': 'Corner cabinets',
  'Corpuri de jos': 'Base pieces',
  'Corpuri suspendate': 'Wall pieces',
  'Piese de rând': 'Run parts',
  'Decupaj chiuvetă {w} × {d} mm': 'Sink cut-out {w} × {d} mm',
  'peretele {n}': 'wall {n}',
  'Preț unitar': 'Unit price',
  '/ placă': '/ sheet',
  '/ m²': '/ m²',
  '/ m': '/ m',
  '/ buc': '/ piece',
  '/ blat': '/ worktop board',
  'Listă de cumpărături — {name}': 'Shopping list — {name}',
  Secțiune: 'Section',
  Cantitate: 'Quantity',
  UM: 'Unit',
  Detalii: 'Details',
  Preț: 'Price',
  Cant: 'Edge banding',
  'Piese de linie': 'Run parts',
  'De ales înainte de cumpărare': 'To choose before buying',
  plăci: 'sheets',
  'm²': 'm²',
  m: 'm',
  buc: 'pcs',
  // Fastener lines on the shopping CSV and printed list (ADR-202)
  'Fixare îmbinări': 'Joint fixings',
  'Suporți de raft': 'Shelf pins',
  'Fixare panouri de spate': 'Back fixings',
  'Fixare agățători': 'Hanging point fixings',
  'Fixare blaturi': 'Worktop fixings',
  Picioare: 'Feet',
  'fiecare loc unde se întâlnesc două plăci ale corpului: laterale, capac, bază, despărțitori, rafturi fixe, traverse':
    'each place two carcass boards meet: sides, top, bottom, dividers, fixed shelves, rails',
  'suporții de raft din lista de feronerie': 'the shelf pins and supports in the hardware schedule',
  'fiecare panou de spate, fixat pe tot perimetrul': 'each back panel, fixed round its perimeter',
  'fiecare agățătoare a unei piese suspendate': 'each hanging bracket of a wall-hung piece',
  'fiecare blat, de linie sau de birou': 'each worktop, run or desk top',
  'fiecare piesă așezată pe soclu': 'each piece standing on a plinth',
  ', {m} m de margine a spatelui': ', {m} m of back edge',
  ', {m} m de blat': ', {m} m of worktop',
  'Orientativ: numărat din model': 'Guidance: counted from the model',
  '{line}: {count} — alegeți elementul de fixare': '{line}: {count} — choose your fastener',
  '{guidance} ({how}{len}). Numiți-l pe al dvs. în {path}.':
    '{guidance} ({how}{len}). Name yours under {path}.',
  'Șuruburile, diblurile și excentricii sunt numărați doar ca îmbinări, orientativ; elementul de fixare îl alegeți dvs. ({path}). Lipiciul nu este numărat.':
    'Screws, dowels and cams are counted only as joints, as guidance; the fastener is yours ({path}). Glue is not counted.',
  'Fișă pentru client': 'Client sheet',
  'Preț estimat': 'Estimated price',
  '{n|# linie fără preț|# linii fără preț}': '{n|# line without a price|# lines without a price}',
  'Estimare: {total} {currency}': 'Estimate: {total} {currency}',
  Gol: 'Empty',
  '{n|# raft|# rafturi}': '{n|# shelf|# shelves}',
  '{n|# sertar|# sertare}': '{n|# drawer|# drawers}',
  'Spațiu de agățat': 'Hanging',
  ' — {n|# preț lipsă|# prețuri lipsă}': ' — {n|# price missing|# prices missing}',
  ' (prețurile tale; {n|# linie|# linii} la prețuri de vânzător: {sellers})':
    ' (your prices; {n|# line|# lines} at seller prices: {sellers})',
  ' (prețurile tale)': ' (your prices)',
  'Dimensiuni L × Î × A, mm': 'Size W × H × D, mm',
  'Prețuri de vânzător: {sellers}': 'Seller prices: {sellers}',
  'Imaginile pașilor cer vizualizarea 3D': 'Step pictures need the 3D view',
  // Warnings on the cut sheet (ADR-265)
  '{n|O piesă cu cant propriu nu mai există|# piese cu cant propriu nu mai există} (piesa s-a schimbat); cantul nu este folosit. Ștergeți-l la „Material” → „Part”.':
    '{n|A part|# parts} with its own edge band no longer {n|exists|exist} (the piece changed); the band is not used. Clear it under Material → Part.',
  'O piesă cu placă proprie nu mai există (piesa s-a schimbat); placa aleasă nu este folosită. Ștergeți alegerea la „Material” → „Part”.':
    'A part with its own board no longer exists (the piece changed); the board choice is not used. Clear it under Material → Part.',
  '{n} piese cu placă proprie nu mai există (piesa s-a schimbat); placa aleasă nu este folosită. Ștergeți alegerea la „Material” → „Part”.':
    '{n} parts with their own board no longer exist (the piece changed); the board choice is not used. Clear it under Material → Part.',
  '{part} are doar {w} mm lățime.': '{part} is only {w} mm wide.',
  '{board} este marcată ca blat de bucătărie, dar este folosită pentru {part} (orientativ).':
    '{board} is labelled kitchen worktop but is used for {part} (guidance).',
  '{board} este marcată ca blat de bucătărie, dar este folosită pentru {n} piese care nu sunt blaturi (orientativ).':
    '{board} is labelled kitchen worktop but is used for {n} parts that are not worktops (guidance).',
  'Mânerul de {s} mm nu încape pe {part} ({along} mm).':
    '{s} mm handle does not fit on {part} ({along} mm).',
  'Un blat dublat se aplică unui panou de blat întreg; cele două traverse de sus rămân simple.':
    'A doubled top applies to a full top panel; the two top rails stay single.',
  'Un corp de podea fără fund nu are pe ce să sprijine conținutul; este gândit pentru corpurile de deasupra unei hote.':
    'A floor cabinet without a bottom has nothing to stand its contents on; this is meant for units over a cooker hood.',
  'Suporturile de agățare cer de obicei spatele retras cu aproximativ 15–20 mm; verificați fișa tehnică a suportului.':
    'Hanging brackets usually need the back set in about 15–20 mm; check the bracket datasheet.',
  'Ușile glisante merg în fața corpului; stilul de front încastrat nu li se aplică.':
    'Sliding doors run in front of the carcass; the inset front style does not apply to them.',
  'Alegeți sistemul de ridicare pentru acest front de {w}×{h} mm din fișa lui tehnică și denumiți-l aici.':
    'Choose the lift-up system for this {w}×{h} mm front from its datasheet and name it here.',
  'Alegeți brațul pentru clapă pentru acest front de {w}×{h} mm din fișa lui tehnică și denumiți-l aici.':
    'Choose the flap stay for this {w}×{h} mm front from its datasheet and name it here.',
  'Doar {h} mm de înălțime pentru agățare.': 'Only {h} mm of height for hanging.',
  'Înălțimile sertarelor însumează {asked} mm, dar sunt disponibili {room} mm; sertarul de jos a fost ajustat. Faceți un sertar „Share” ca să preia diferența.':
    'Drawer heights add up to {asked} mm but there is {room} mm; the bottom drawer was adjusted. Make one drawer "Share" to absorb the difference.',
  'Un front fix cere un front de sertar propriu; sertarele din spatele ușilor nu au, deci setarea este ignorată.':
    'A fixed front needs a drawer front of its own; drawers behind doors have none, so the setting is ignored.',
  'Sertarul de sus este front fix, deci nu are cutie de decupat în jurul sifonului; decupajul în U este ignorat.':
    'The top drawer is a fixed front, so it has no box to cut around the trap; the U-cut is ignored.',
  'Sertarele din spatele ușilor nu au front propriu, deci își păstrează frontul interior.':
    'Drawers behind doors have no front of their own, so they keep their inner front.',
  'Sertarul 1 este decupat în jurul sifonului (decupaj de {w} × {d} mm în spate): verificați sifonul și țevile înainte de tăiere.':
    'Drawer 1 is cut around the trap ({w} × {d} mm notch at the back): check the trap and pipes before cutting.',
  'Sertare în spatele ușilor: verificați jocul balamalelor și al ușii față de cutiile sertarelor.':
    'Drawers behind doors: check hinge and door clearance against the drawer boxes.',
  'Dimensiunile fixe însumează {asked} mm, dar sunt disponibili {room} mm; prima parte a fost ajustată la {first} mm. Faceți o parte „Share” ca să preia diferența.':
    'Fixed sizes add up to {asked} mm but there is {room} mm; the first part was adjusted to {first} mm. Make one part "Share" to absorb the difference.',
  'Dimensiunile fixe însumează {asked} mm, dar sunt disponibili {room} mm; ultima parte a fost ajustată la {last} mm. Faceți o parte „Share” ca să preia diferența.':
    'Fixed sizes add up to {asked} mm but there is {room} mm; the last part was adjusted to {last} mm. Make one part "Share" to absorb the difference.',
  'Rafturile de {d} mm adâncime sunt prea puțin adânci pentru două rânduri de găuri pentru bolțuri, la {s} mm de margini.':
    'Shelves {d} mm deep are too shallow for two pin rows {s} mm from their edges.',
  'Panoul comun {kind} nu este construit: {reason} Elementele își păstrează panoul propriu.':
    'The common {kind} is not built: {reason} The items keep their own.',
  'de sus': 'top',
  'de jos': 'bottom',
  'Panoul comun {kind} acoperă un gol de {n} mm fără nimic dedesubt.':
    'The common {kind} spans a {n} mm gap with nothing under it.',
  'Unele elemente de sub blatul comun au blat dublat și altele nu; blatul comun este simplu.':
    'Some items under the common top have a doubled top and some do not; the common top is single.',
  '{a} și {b} stau alăturate cu adâncimi diferite ({reason} mm); {text}.':
    '{a} and {b} stand side by side with different depths ({reason} mm); {text}.',
  '{a} și {b} sunt sub același blat cu înălțimi diferite ({reason} mm); {text}.':
    '{a} and {b} are under one worktop with different heights ({reason} mm); {text}.',
  '{a} este conectat de peretele {n}, dar nu mai este îmbinat: {reason}':
    '{a} is connected against wall {n} but no longer joined: {reason}',
  '{a} și {b} sunt conectate, dar nu mai sunt îmbinate: {reason}':
    '{a} and {b} are connected but no longer joined: {reason}',
  'Secțiunea oarbă are {blind} mm; aproximativ adâncimea corpului vecin + 50 mm ({d} mm) ține ușa și mânerul acestuia libere față de această ușă.':
    "Blind section is {blind} mm; about the neighbouring cabinet's depth + 50 mm ({d} mm) keeps its door and handle clear of this door.",
  'Spațiul pentru genunchi are {knee} mm lățime; de obicei se folosesc aproximativ 600 mm sau mai mult.':
    'Knee space is {knee} mm wide; about 600 mm or more is usual.',
  'Frontul sertarelor iese cu {out} mm peste marginea blatului; setați surplombul la cel puțin {min} mm.':
    'Drawer fronts stick out {out} mm past the worktop edge; set the overhang to at least {min} mm.',
  'Înălțimea liberă sub blat este de {h} mm.': 'Clear height under the worktop is {h} mm.',
  'Raftul de jos stă între picioare: fixați-l cu suporți sau cepuri (nu sunt incluse în listă).':
    'The lower shelf sits between the legs: fix it with cleats or dowels (not listed).',
  'Plăci de șezut și spătar pe o bază cumpărată: baza, ridicătorul cu gaz, mecanismul și suportul spătarului se cumpără și nu sunt desenate.':
    'Seat and back boards on a bought base: the base, gas lift, mechanism and back support are bought and not drawn.',
  'Balustradele aflate la {h} mm deasupra platformei de sus sunt prea joase ca să fie adăugate peste lonjeroanele laterale.':
    'Guard rails {h} mm above the top deck are too low to add over the side rails.',
  'Mânerul de {s} mm nu încape pe frontul de {w} mm.':
    '{s} mm handle does not fit on the {w} mm front.',
  '{n} piese nu au un loc cunoscut și sunt arătate într-o grămadă lângă ansamblu. Cantul nu este stabilit.':
    '{n} parts have no known place and are shown in a pile beside the assembly. Edge banding is not set.',
  'Panouri libere, arătate într-o grămadă: modul în care se îmbină nu este în proiect. Cantul nu este stabilit.':
    'Loose panels, shown in one pile: how they go together is not in the design. Edge banding is not set.',
  'Îmbinări cu șuruburi: alegeți tipul, lungimea și numărul de șuruburi pentru placă (orientativ, nu sunt în listă).':
    'Screwed joints: choose the screw type, length and number for the board (guidance, not listed).',
  '{name} a fost așezat pe o piesă care nu mai este în proiect; rămâne unde este.':
    '{name} was placed on a piece that is no longer in the project; it stays where it is.',
  '{name} este ridicat de la podea fără nimic dedesubt; setați-l să se agațe pe suporți de perete („Whole cabinet” → „Stands on”).':
    '{name} is off the floor with nothing under it; set it to hang on wall brackets (Whole cabinet → Stands on).',
  '{name} este făcut să se agațe pe perete, dar este așezat pe podea.':
    '{name} is built to hang on the wall but is placed on the floor.',
  '{board} are setări de placă diferite în {name}; placa primei piese ({l} × {w}) este folosită pentru tot proiectul.':
    "{board} has different sheet settings in {name}; the first piece's sheet ({l} × {w}) is used for the whole project.",
  '{front} de la {name} nu se poate deschide complet: lovește {other} (are nevoie de {need} mm, sunt {free} mm liberi).':
    '{front} of {name} cannot open fully: it hits {other} (needs {need} mm, {free} mm free).',
  '{front} de la {a} și {other} de la {b} se deschid în același spațiu.':
    '{front} of {a} and {other} of {b} open into the same space.',
  'Blatul de peste {name} are o margine {what}, dar fără dimensiune; introduceți dimensiunea marginii. Până atunci este desenat drept.':
    'The worktop over {name} has a {what} edge but no size; enter the edge size. It is drawn square until then.',
  'Marginea {what} a blatului de peste {name} are {size} mm, nu mai mică decât blatul de {t} mm; este desenat drept.':
    'The {what} edge of the worktop over {name} is {size} mm, not less than the {t} mm worktop; it is drawn square.',
  '{name} stă în calea {door} (are nevoie de {mm} mm ca să se deschidă).':
    '{name} is in the way of {door} (it needs {mm} mm to swing).',
  '{name} acoperă fereastra {window}: stă lângă peretele ei și este cu {mm} mm mai înalt decât pervazul.':
    '{name} covers the window {window}: it stands against its wall and is {mm} mm higher than its sill.',
  '{front} de la {name} nu se poate deschide complet: lovește un perete (are nevoie de {need} mm).':
    '{front} of {name} cannot open fully: it hits a wall (needs {need} mm).',
  '{outlet} este ascunsă în spatele {name}: mutați priza sau piesa.':
    '{outlet} is hidden behind {name}: move the outlet or the piece.',
  'Țeavă în spatele {name} ({label}): tăiați {part} sau mutați piesa.':
    'Pipe behind {name} ({label}): cut the {part} or move the piece.',
  'Priză în spatele {name} ({label}): tăiați {part} sau mutați piesa.':
    'Outlet behind {name} ({label}): cut the {part} or move the piece.',
  'Deschiderea raftului de {span} mm este mare pentru {name} de {t} mm și se poate îndoi (limită obișnuită {limit} mm — confirmați pentru placa și sarcina dvs.).':
    'Shelf span {span} mm is long for {t} mm {name} and may sag (typical limit {limit} mm — confirm for your board and load).',
  'Ușă de {w} mm lățime; peste ~{max} mm (obișnuit) luați în calcul două uși.':
    'Door {w} mm wide; over ~{max} mm (typical) consider two doors.',
  'Adâncimea deschiderii este {depth} mm; umerașele cer de obicei aproximativ {need} mm (obișnuit).':
    'Opening depth {depth} mm; hangers usually need about {need} mm (typical).',
  'Asamblată culcat, piesa are nevoie de {diag} mm ca să fie ridicată, dar camera are {room} mm înălțime. Construiți-o la locul ei sau împărțiți-o.':
    'Assembled lying down, the piece needs {diag} mm to stand up, but the room is {room} mm high. Build it in place or split it.',
  'Alegeți {what} din fișa tehnică a producătorului și verificați dimensiunile de montaj față de această piesă.':
    "Choose the {what} from the maker's datasheet and check its fitting sizes against this piece.",
  'Distanța dintre lamele este {gap} mm; producătorii de saltele și de scaune cer de obicei 70 mm sau mai puțin (verificați la ai dvs.).':
    'Slat gap {gap} mm; mattress and seat makers usually ask for 70 mm or less (check yours).',
  'Paturile suprapuse sunt reglementate de standarde de siguranță (EN 747 și altele). Mobila nu verifică balustradele, deschiderile sau scara în raport cu ele; aceasta nu este o verificare de conformitate.':
    'Bunk beds are covered by safety standards (EN 747 and others). Mobila does not check guard rails, openings or ladder against them; this is not a compliance check.',
  'Pătuțurile și leagănele sunt reglementate de standarde de siguranță (EN 716 și altele). Mobila nu verifică distanța dintre bare sau înălțimea laterală; aceasta nu este o verificare de conformitate.':
    'Cots and cradles are covered by safety standards (EN 716 and others). Mobila does not check bar spacing or side height; this is not a compliance check.',
  'Traversele au o deschidere de {span} mm între picioare; mesele lungi primesc de obicei un picior sau o traversă la mijloc (obișnuit).':
    'Rails span {span} mm between legs; long tables usually get a centre leg or rail (typical).',
  'Laturile comune nu sunt construite: {reason} Elementele își păstrează ambele laturi.':
    'The shared sides are not built: {reason} The items keep both their sides.',
  '{set} este incomplet; piesele lui își păstrează ultimele valori.':
    '{set} is incomplete; its pieces keep their last values.',
  '{name}: {field} își păstrează valoarea — urmează „{expr}”, dar acea dimensiune este blocată.':
    '{name}: {field} keeps its value — it follows “{expr}”, but that size is locked.',
  'Selectați două sau mai multe elemente care stau alăturate.':
    'Select two or more items standing side by side.',
  'Un element al acestui panou comun a fost șters.': 'An item of this common panel was removed.',
  '{name} nu este corp, corp de colț sau birou.': '{name} is not a cabinet, corner unit or desk.',
  '{name} nu are fund.': '{name} has no bottom.',
  '{name} este numărat de mai multe ori.': '{name} is counted more than once.',
  'Elementele nu sunt întoarse în același sens.': 'The items are not turned the same way.',
  '{name} are altă înălțime a soclului.': '{name} has another plinth height.',
  '{name} are alt spate.': '{name} has another back.',
  '{name} nu are {part}.': '{name} has no {part}.',
  '{name} nu are aceeași înălțime sau același nivel de la podea.':
    '{name} is not the same height or floor level.',
  '{part} de la {name} are altă grosime.': 'The {part} of {name} is another thickness.',
  'Aceste elemente nu fac un singur blat fără goluri.':
    'These items do not make one top without holes.',
  '{name} nu are aceeași adâncime sau nu este aliniat.':
    '{name} is not the same depth or not in line.',
  '{name} nu atinge celelalte și nu este aliniat cu ele.':
    '{name} does not touch the others and is not in line with them.',
  '{name} este un corp de colț în L sau diagonal; doar un colț orb împarte o latură.':
    '{name} is an L-shape or diagonal corner unit; only a blind corner shares a side.',
  '{name} nu este corp, colț orb sau birou.':
    '{name} is not a cabinet, a blind corner unit or a desk.',
  'Un element al acestor laturi comune a fost șters.': 'An item of these shared sides was removed.',
  '{name} are laturi de altă grosime.': '{name} has sides of another thickness.',
  '{a} și {b} nu se ating.': '{a} and {b} do not touch.',
  '{a} și {b} sunt ambele birouri; un birou împarte o latură doar cu un corp.':
    '{a} and {b} are both desks; a desk shares a side only with a cabinet.',
  '{name} se întâlnește cu vecinul la capătul orb; doar capătul drept împarte o latură.':
    '{name} meets its neighbour at its blind end; only its straight end shares a side.',
  '{name} are un bloc de sertare la acel capăt; doar un capăt cu perete lateral împarte o latură.':
    '{name} has a pedestal at that end; only a gable end shares a side.',
  'în colț': 'in the corner',
  suprapuse: 'stacked',
  'lângă peretele {n}': 'against wall {n}',
  alăturate: 'side by side',
  '{a} și {b} nu se întâlnesc în colț.': '{a} and {b} do not meet in a corner.',
  '{a} și {b} nu sunt una peste alta.': '{a} and {b} are not one over the other.',
  '{a} și {b} nu stau alăturate.': '{a} and {b} do not stand side by side.',
  'O piesă nu poate fi conectată cu ea însăși.': 'A piece cannot be connected to itself.',
  'O piesă conectată a fost ștearsă.': 'A connected piece was removed.',
  'O conexiune la perete leagă o singură piesă.': 'A wall connection holds one piece.',
  '{a} și {b} nu sunt alăturate, în colț sau una peste alta.':
    '{a} and {b} are not side by side, in a corner or one over the other.',
  'Camera nu are peretele {n}.': 'The room has no wall {n}.',
  '{name} este întors în unghi.': '{name} is turned at an angle.',
  'Spatele lui {name} nu este orientat spre peretele {n}.':
    'The back of {name} does not face wall {n}.',
  'Spatele lui {name} nu este lipit de peretele {n}.':
    'The back of {name} is not against wall {n}.',
  '{name} depășește capătul peretelui {n}.': '{name} reaches past the end of wall {n}.',
  'Desenați mai întâi camera: o piesă se pune lângă pereții ei.':
    'Draw the room first: a piece goes against its walls.',
  'Spatele lui {name} nu este lipit de un perete.': 'The back of {name} is not against a wall.',
  '{reason}; {text}': '{reason}; {text}',
  '{reason}; {text}.': '{reason}; {text}.',
  'corp de podea': 'floor unit',
  'corp suspendat': 'wall unit',
  'piesă așezată peste altă piesă': 'piece placed on another piece',
  latură: 'side',
  spate: 'back',
  față: 'front',
  '{what} {a} față de {b}': '{what} {a} vs {b}',
  'îmbinarea „{a}” cu „{b}” nu este posibilă; se îmbină doar laturile':
    'a {a} cannot join a {b}; only sides join',
  'îmbinarea „{a}” cu „{b}” nu este posibilă': 'a {a} cannot join a {b}',
  'doar spatele unei piese se pune lângă un perete (aici: {face}); o latură se pune lângă un perete doar într-un colț':
    'only the back of a piece goes against a wall (this is its {face}); a side goes against a wall only in a corner',
  adâncime: 'depth',
  înălțime: 'height',
  '{a} ({fa}: {ra}) și {b} ({fb}: {rb}) nu au nicio cameră în comun':
    '{a} ({fa}: {ra}) and {b} ({fb}: {rb}) share no room',
  'Chiuveta de peste {name} nu are blat din care să fie decupată; adăugați blatul șirului.':
    'The sink over {name} has no worktop to be cut out of; add the run worktop.',
  'Plita de peste {name} nu are blat din care să fie decupată; adăugați blatul șirului.':
    'The hob over {name} has no worktop to be cut out of; add the run worktop.',
  'Decupajul chiuvetei de {w} mm este mai lat decât {name} de sub el ({width} mm).':
    'Sink cut-out {w} mm is wider than {name} under it ({width} mm).',
  'Decupajul plitei de {w} mm este mai lat decât {name} de sub el ({width} mm).':
    'Hob cut-out {w} mm is wider than {name} under it ({width} mm).',
  'Decupajul chiuvetei de {w} mm lățime, la {x} mm de la stânga, depășește {name} de sub el ({width} mm).':
    'Sink cut-out {w} mm wide at {x} mm from the left goes past {name} under it ({width} mm).',
  'Decupajul plitei de {w} mm lățime, la {x} mm de la stânga, depășește {name} de sub el ({width} mm).':
    'Hob cut-out {w} mm wide at {x} mm from the left goes past {name} under it ({width} mm).',
  'potrivire adâncime: corpurile de podea alăturate trebuie să aibă aceeași adâncime':
    'depth match: floor units side by side should be equally deep',
  'potrivire înălțime: corpurile de bază sub același blat trebuie să aibă aceeași înălțime':
    'height match: base units under one worktop should be equally high',
};
