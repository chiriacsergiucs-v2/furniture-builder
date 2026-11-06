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
};
