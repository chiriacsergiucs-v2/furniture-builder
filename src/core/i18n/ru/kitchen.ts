/**
 * Russian text for kitchen cut-outs, worktop corners and placement precision (ADR-205, ADR-153). Key: the English
 * text; value: the Russian text.
 */
export const ru_kitchen = {
  // Mirrored splits (G-032)
  'Fixed sizes add up to {asked} mm but there is {room} mm; the first part was adjusted to {first} mm. Make one part "Share" to absorb the difference.':
    'Фиксированные размеры дают в сумме {asked} мм, а места {room} мм; первая часть изменена до {first} мм. Сделайте одну часть «Доля», чтобы поглотить разницу.',
  'Split remainder order needs schemaVersion 9':
    'Порядку остатка при делении нужна schemaVersion 9',
  // Shaped parts with cut-outs
  '{part}: a cut-out must lie inside its {w} × {h} mm blank, in whole millimetres.':
    '{part}: вырез должен лежать внутри заготовки {w} × {h} мм, в целых миллиметрах.',
  // Hobs (G-035)
  'The hob over {name} has no worktop to be cut out of; add the run worktop.':
    'Для варочной панели над {name} нет столешницы, в которой делать вырез; добавьте столешницу ряда.',
  'Hob cut-out {w} × {d} mm is as deep as the worktop over {name} ({depth} mm) or deeper.':
    'Вырез под варочную панель {w} × {d} мм такой же глубины, как столешница над {name} ({depth} мм), или глубже.',
  'Hob cut-out {w} mm is wider than {name} under it ({width} mm).':
    'Вырез под варочную панель {w} мм шире, чем {name} под ним ({width} мм).',
  'Hobs need project schemaVersion {v}': 'Варочным панелям нужна schemaVersion проекта {v}',
  'Invalid hobs': 'Неверные варочные панели',
  'Invalid hob': 'Неверная варочная панель',
  'Add hob…': 'Добавить варочную панель…',
  'Add hob': 'Добавить варочную панель',
  'Hob over a base unit': 'Варочная панель над нижним модулем',
  'Hob over': 'Варочная панель над',
  'Hob over {name}': 'Варочная панель над {name}',
  'Remove the hob over {name}': 'Убрать варочную панель над {name}',
  "From the hob's installation drawing; there is no default.":
    'По монтажной схеме варочной панели; значения по умолчанию нет.',
  'Hob cut-out in the run worktop': 'Вырез под варочную панель в столешнице ряда',
  'Sink and hob cut-outs drawn on the plan': 'Вырезы под мойку и варочную панель на плане',
  '{w} × {d} mm': '{w} × {d} мм',
  // Worktop corners (G-010)
  'The worktops over {a} and {b} overlap at the corner: choose a mitred or butt joint.':
    'Столешницы над {a} и {b} перекрываются в углу: выберите соединение под 45° или встык.',
  'The worktops over {a} and {b} meet in a butt joint: choose the one that runs through.':
    'Столешницы над {a} и {b} соединяются встык: выберите ту, что идёт до угла.',
  'Worktop joints need project schemaVersion {v}':
    'Соединениям столешниц нужна schemaVersion проекта {v}',
  'Invalid worktop joints': 'Неверные соединения столешниц',
  'Invalid worktop joint': 'Неверное соединение столешниц',
  'Worktop corner': 'Угол столешницы',
  'Mitred joint': 'Соединение под 45°',
  'Butt joint': 'Соединение встык',
  'Runs through': 'Идёт до угла',
  'Joint not chosen yet: export is blocked until you choose one.':
    'Соединение ещё не выбрано: экспорт заблокирован, пока вы его не выберете.',
  'Worktop corners with a mitred or butt joint': 'Углы столешниц с соединением под 45° или встык',
  'Runs along the side walls': 'Ряды вдоль боковых стен',
  // Backs cut around pipes and outlets (G-030)
  'Invalid back cut-outs': 'Неверные вырезы в задних стенках',
  'Backs cut around pipes need project schemaVersion {v}':
    'Вырезам в задних стенках нужна schemaVersion проекта {v}',
  'Cut the back around it': 'Вырезать заднюю стенку вокруг',
  '{name} is typed at an angle: its back cannot be cut around a pipe or outlet; turn it to a quarter turn or move it.':
    '{name} задан под углом: его заднюю стенку нельзя вырезать вокруг трубы или розетки; поверните его на четверть оборота или переместите.',
  'Backs cut around pipes and outlets': 'Задние стенки с вырезом вокруг труб и розеток',
  // Clearance zones (G-036)
  'Clearance zones in 3D': 'Зоны зазоров в 3D',
  'Show clearance zones in 3D': 'Показать зоны зазоров в 3D',
  'Where it lies before it is tipped up': 'Где он лежит, пока его не подняли',
  // Height snapping (G-033)
  'Snapped to the worktop line, {h} mm': 'Привязано к линии столешницы, {h} мм',
  'Snapped to {name}, {h} mm': 'Привязано к {name}, {h} мм',
  'Drag up or down to change the height': 'Перетащите вверх или вниз, чтобы изменить высоту',
  'Wall unit heights snap to the worktop and wall units':
    'Высота навесных модулей привязывается к столешнице и другим навесным',
  // Distribute (G-110)
  '{names}: fewer than three in this row': '{names}: в этом ряду меньше трёх',
  'Distribute each row': 'Распределить каждый ряд',
  // Angled pieces (G-170)
  'Angled pieces snap along their turned faces':
    'Повёрнутые под углом предметы привязываются гранями',
  // Mirrored copies (G-032)
  'Mirrored copies match to the mm': 'Зеркальные копии совпадают до миллиметра',

  // ADR-209: kitchen run follow-ups
  // Moulding profiles (G-405)
  'Moulding profile': 'Профиль молдинга',
  'Moulding profile drawing; tap to add a point':
    'Чертёж профиля молдинга; нажмите, чтобы добавить точку',
  'e.g. 0,0; 20,0; 20,45; 0,60': 'напр. 0,0; 20,0; 20,45; 0,60',
  'Remove last point': 'Убрать последнюю точку',
  'Clear profile': 'Очистить профиль',
  'Type whole-mm points as across,up separated by ";". Not saved until it is.':
    'Введите точки в целых мм как «поперёк,вверх» через «;». Не сохраняется, пока не так.',
  'The profile crosses itself or has fewer than three points.':
    'Профиль пересекает сам себя или в нём меньше трёх точек.',
  'Profile {w} × {h} mm: the strip takes this size.':
    'Профиль {w} × {h} мм: планка получает этот размер.',
  'Optional: without a profile the trim is a plain strip.':
    'Необязательно: без профиля планка — простая полоса.',
  'Profile {w} × {h} mm': 'Профиль {w} × {h} мм',
  'Height {h} mm, no profile': 'Высота {h} мм, без профиля',
  'The profile sets the height.': 'Высоту задаёт профиль.',
  'The profile of {name} crosses itself or has fewer than three points.':
    'Профиль {name} пересекает сам себя или в нём меньше трёх точек.',
  'Moulding profiles, bindings and repair fillers need project schemaVersion {v}':
    'Профилям молдингов, привязкам и доборам-исправлениям нужна schemaVersion проекта {v}',
  'Moulding profiles drawn or typed': 'Профили молдингов — нарисованные или введённые',
  'Templates keep run requests': 'Шаблоны сохраняют запрошенные детали ряда',
  // Cut-out positions (G-407)
  'From front': 'От переднего края',
  'Empty = centred.': 'Пусто = по центру.',
  centred: 'по центру',
  'Whole number from 0 to 3000.': 'Целое число от 0 до 3000.',
  'Cut-out positions need project schemaVersion {v}':
    'Положениям вырезов нужна schemaVersion проекта {v}',
  'Sink cut-out {d} mm deep at {z} mm from the front reaches the back of the worktop over {name} ({depth} mm) or past it.':
    'Вырез под мойку глубиной {d} мм в {z} мм от переднего края доходит до задней кромки столешницы над {name} ({depth} мм) или дальше.',
  'Sink cut-out {w} mm wide at {x} mm from the left goes past {name} under it ({width} mm).':
    'Вырез под мойку шириной {w} мм в {x} мм слева выходит за {name} под ним ({width} мм).',
  'Hob cut-out {d} mm deep at {z} mm from the front reaches the back of the worktop over {name} ({depth} mm) or past it.':
    'Вырез под варочную панель глубиной {d} мм в {z} мм от переднего края доходит до задней кромки столешницы над {name} ({depth} мм) или дальше.',
  'Hob cut-out {w} mm wide at {x} mm from the left goes past {name} under it ({width} mm).':
    'Вырез под варочную панель шириной {w} мм в {x} мм слева выходит за {name} под ним ({width} мм).',
  'Sink and hob cut-outs placed from the left and the front':
    'Вырезы под мойку и варочную панель с отступом слева и спереди',
  'Cut-outs as holes in the 3D worktop': 'Вырезы — отверстия в столешнице в 3D',
  // Worktop edge profiles (G-412)
  'Edge profile': 'Профиль кромки',
  Square: 'Прямая',
  Rounded: 'Скруглённая',
  Bevelled: 'Скошенная',
  'Edge size (mm)': 'Размер кромки (мм)',
  'The radius of the front edge; there is no default.':
    'Радиус передней кромки; значения по умолчанию нет.',
  'How far the bevel cuts back; there is no default.':
    'Насколько глубоко срезана фаска; значения по умолчанию нет.',
  rounded: 'скруглённая',
  bevelled: 'скошенная',
  'The worktop over {name} has a {what} edge but no size; enter the edge size. It is drawn square until then.':
    'У столешницы над {name} {what} кромка, но без размера; введите размер кромки. До тех пор она рисуется прямой.',
  'The {what} edge of the worktop over {name} is {size} mm, not less than the {t} mm worktop; it is drawn square.':
    '{what} кромка столешницы над {name} — {size} мм, не меньше толщины столешницы {t} мм; она рисуется прямой.',
  'Worktop edges need project schemaVersion {v}':
    'Кромкам столешниц нужна schemaVersion проекта {v}',
  'Invalid worktop edges': 'Неверные кромки столешниц',
  'Invalid worktop edge': 'Неверная кромка столешницы',
  'Worktop edges square, rounded or bevelled':
    'Кромки столешниц: прямые, скруглённые или скошенные',
  // Run requests follow variables (G-325)
  'Worktop overhangs and trim heights follow variables':
    'Свесы столешницы и высоты планок следуют переменным',
  // Formulas (G-414)
  'The step of “round” must be more than 0.': 'Шаг в «round» должен быть больше 0.',
  'Formulas with comparisons, if and stepped rounding':
    'Формулы со сравнениями, if и округлением с шагом',
  // Repair fillers (G-034)
  'Filler beside {names}': 'Добор рядом с {names}',
  'enter its width': 'введите её ширину',
  'it would overlap another piece or run part': 'она перекрыла бы другой предмет или деталь ряда',
  'Repair fillers kept by automatic refresh; the problem in 3D':
    'Доборы-исправления сохраняются при автообновлении; проблема в 3D',
  // Fasteners and drilling positions (G-380)
  'From each end (mm)': 'От каждого конца (мм)',
  'Guidance: with your fastener named and this typed, Parts shows drilling positions from your values. No diameter, depth or screw is given.':
    'Ориентир: когда крепёж назван и это значение введено, в «Детали» показаны места сверления по вашим значениям. Диаметр, глубина и шуруп не указываются.',
  'Whole number from 0 to 5000. Not saved until it is.':
    'Целое число от 0 до 5000. Не сохраняется, пока не так.',
  'Guidance: drilling positions from your values': 'Ориентир: места сверления по вашим значениям',
  '{n|# joint is|# joints are} shorter than twice your distance from each end: no drilling positions there.':
    '{n|# соединение короче|# соединения короче|# соединений короче} двойного расстояния от конца: мест сверления там нет.',
  'Project fasteners and drilling positions': 'Крепёж проекта и места сверления',
};
