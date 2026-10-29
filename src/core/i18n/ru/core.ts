/** Russian text for core (ADR-153). Key: the English text; value: the Russian text. */
export const ru_core = {
  // Project checks and notes (src/core/project.ts)
  'Locked — unlock to move': 'Закреплено — снимите закрепление, чтобы переместить',
  '{name} (piece {n})': '{name} (изделие {n})',
  '{name} is locked — unlock it to move it.':
    '{name} закреплено — снимите закрепление, чтобы переместить.',
  '{name} sits on {base} and is locked — unlock it to move {base}.':
    '{name} стоит на {base} и закреплено — снимите закрепление, чтобы переместить {base}.',
  '{name} was placed on a piece that is no longer in the project; it stays where it is.':
    '{name} было поставлено на изделие, которого больше нет в проекте; оно остаётся на месте.',
  '{name} and {other} are placed on each other.': '{name} и {other} поставлены друг на друга.',
  '{name} is off the floor with nothing under it; set it to hang on wall brackets (Whole cabinet → Stands on).':
    '{name} поднято над полом, и под ним ничего нет; повесьте его на настенные кронштейны (Весь шкаф → Опора).',
  '{name} is built to hang on the wall but is placed on the floor.':
    '{name} сделано для подвеса на стену, но стоит на полу.',
  '{a} and {b} overlap by {amount} mm in the room.':
    '{a} и {b} пересекаются в комнате на {amount} мм.',
  '{name} goes below the floor.': '{name} уходит ниже пола.',
  '{part} was made for pieces that changed or were removed; suggest the run parts again.':
    '{part} сделано для изделий, которые изменились или удалены; предложите детали ряда заново.',
  'Edge band {band} on {board} ({part}) is narrower than the {t} mm board.':
    'Кромка {band} на {board} ({part}) уже плиты толщиной {t} мм.',
  '{part} overlaps {name}; suggest the run parts again after moving pieces.':
    '{part} пересекается с {name}; после перемещения изделий предложите детали ряда заново.',
  '{part} is not made yet; suggest the run parts again.':
    '{part} ещё не создано; предложите детали ряда заново.',
  '{front} of {name} cannot open fully: it hits {other} (needs {need} mm, {free} mm free).':
    '{front} изделия {name} не открывается полностью: упирается в {other} (нужно {need} мм, свободно {free} мм).',
  '{front} of {a} and {other} of {b} open into the same space.':
    '{front} изделия {a} и {other} изделия {b} открываются в одно и то же место.',
  "{board} has different sheet settings in {name}; the first piece's sheet ({l} × {w}) is used for the whole project.":
    '{board} имеет другие настройки листа в {name}; для всего проекта используется лист первого изделия ({l} × {w}).',
  '{name} has {n|# problem|# problems}; open it to fix.':
    'В {name} {n|# проблема|# проблемы|# проблем}; откройте его, чтобы исправить.',
  'a removed piece': 'удалённое изделие',
  'The sink over {name} has no worktop to be cut out of; add the run worktop.':
    'У мойки над {name} нет столешницы для выреза; добавьте столешницу ряда.',
  'Sink cut-out {w} × {d} mm is as deep as the worktop over {name} ({depth} mm) or deeper.':
    'Вырез под мойку {w} × {d} мм не меньше глубины столешницы над {name} ({depth} мм).',
  'Sink cut-out {w} mm is wider than {name} under it ({width} mm).':
    'Вырез под мойку {w} мм шире, чем {name} под ним ({width} мм).',
  '{part}: {why}.': '{part}: {why}.',
  'a corner unit in the run keeps its own plinth': 'угловой модуль в ряду сохраняет свой цоколь',
  'no plinth on {names}': 'нет цоколя у {names}',
  'the sides of {names} reach the floor; set Bottom → under the sides':
    'боковины {names} доходят до пола; выберите Дно → под боковинами',
  'plinth heights differ ({list})': 'высоты цоколей различаются ({list})',
  '{name} {mm} mm': '{name} {mm} мм',
  'plinth setbacks differ ({list})': 'отступы цоколей различаются ({list})',
  '{mm} mm': '{mm} мм',
  'plinth fronts are not in line ({list})': 'лицевые стороны цоколей не на одной линии ({list})',
  '{mm} mm from the back': '{mm} мм от задней стороны',
  'body boards differ ({list})': 'плиты корпусов различаются ({list})',
  ' grained': ' с текстурой',
  ' with a picture': ' с картинкой',
  'no board': 'нет плиты',
  'No run plinth for {names}: {why}.': 'Нет общего цоколя для {names}: {why}.',
  'No run plinth for {names}: it would overlap a filler or another piece.':
    'Нет общего цоколя для {names}: он пересёкся бы с вставкой или другим изделием.',
  'it would overlap another worktop or run part':
    'она пересеклась бы с другой столешницей или деталью ряда',
  'No worktop over {names}: worktops were chosen for other pieces of this run (Add worktop over… adds one).':
    'Нет столешницы над {names}: столешницы выбраны для других изделий этого ряда (Добавить столешницу над… добавит её).',
  'a piece it was made for is no longer in the project':
    'изделия, для которого это сделано, больше нет в проекте',
  'the pieces are not side by side in one run of base units':
    'изделия не стоят рядом в одном ряду нижних модулей',
  'the pieces are not next to each other': 'изделия не стоят рядом друг с другом',
  'it would overlap another run part': 'она пересеклась бы с другой деталью ряда',
  'Worktop over {names}': 'Столешница над {names}',
  'Crown over {names}': 'Карниз над {names}',
  'Pelmet over {names}': 'Нижний карниз под {names}',
  'Ceiling filler over {names}': 'Вставка до потолка над {names}',
  '{name} is not a wall or tall unit facing the room':
    '{name} — не навесной и не высокий модуль, обращённый в комнату',
  'the pieces are not side by side': 'изделия не стоят рядом',
  'choose its board': 'выберите для неё плиту',
  'set the room and its height first (Room)': 'сначала задайте комнату и её высоту (Комната)',
  'the run already reaches the {h} mm ceiling': 'ряд уже доходит до потолка высотой {h} мм',
  'enter its height': 'введите её высоту',
  'it would go {mm} mm below the floor': 'она ушла бы на {mm} мм ниже пола',

  // Project file checks (validateProject)
  'Invalid project settings': 'Неверные настройки проекта',
  'Invalid project {k} board': 'Неверная плита проекта {k}',
  'Invalid project handle': 'Неверная ручка проекта',
  'Invalid project front overlay': 'Неверное наложение фасадов проекта',
  'Project plinth height must be 0 to 500 mm': 'Высота цоколя проекта должна быть от 0 до 500 мм',
  'Project must be an object': 'Проект должен быть объектом',
  'Unsupported project schemaVersion': 'Неподдерживаемая schemaVersion проекта',
  'Missing project id or name': 'Нет id или названия проекта',
  'Invalid cutting settings': 'Неверные настройки распила',
  'Items missing': 'Нет изделий',
  'Invalid item': 'Неверное изделие',
  'Duplicate item {id}': 'Повторяющееся изделие {id}',
  'Item quantity must be 1 to 99': 'Количество изделия должно быть от 1 до 99',
  'Item position must be whole mm (height ≥ 0)':
    'Положение изделия должно быть в целых мм (высота ≥ 0)',
  'Item rotation must be a quarter turn': 'Поворот изделия должен быть на четверть оборота',
  'Item angle must be whole degrees from 1 to 89':
    'Угол изделия должен быть целым числом градусов от 1 до 89',
  'Pieces at an angle need project schemaVersion {v}':
    'Изделиям под углом нужна schemaVersion проекта {v}',
  'Invalid item placement': 'Неверная установка изделия',
  'Invalid item clearance zones': 'Неверные зоны открывания изделия',
  'Invalid item lock': 'Неверное закрепление изделия',
  'Locked pieces need project schemaVersion {v}':
    'Закреплённым изделиям нужна schemaVersion проекта {v}',
  'Invalid kept template revision': 'Неверная сохранённая версия шаблона',
  'Kept template revisions need project schemaVersion {v}':
    'Сохранённым версиям шаблона нужна schemaVersion проекта {v}',
  'Invalid item link': 'Неверная связь изделия',
  'Linked copies need project schemaVersion {v}':
    'Связанным копиям нужна schemaVersion проекта {v}',
  'Invalid item size lock': 'Неверная фиксация размера изделия',
  'Size-locked pieces need project schemaVersion {v}':
    'Изделиям с фиксированным размером нужна schemaVersion проекта {v}',
  'Invalid template reference': 'Неверная ссылка на шаблон',
  'Template references need project schemaVersion {v}':
    'Ссылкам на шаблоны нужна schemaVersion проекта {v}',
  'Item {id}: {problem}': 'Изделие {id}: {problem}',
  'Invalid run parts': 'Неверные детали ряда',
  'Invalid run part': 'Неверная деталь ряда',
  'Invalid run settings': 'Неверные настройки ряда',
  'Invalid run requests': 'Неверные запросы деталей ряда',
  'Invalid run request': 'Неверный запрос детали ряда',
  'Trims and chosen worktops need project schemaVersion {v}':
    'Карнизам и выбранным столешницам нужна schemaVersion проекта {v}',
  'Wall backgrounds need project schemaVersion {v}': 'Фонам стен нужна schemaVersion проекта {v}',
  'Fitted wall pictures need project schemaVersion {v}':
    'Подогнанным картинкам стен нужна schemaVersion проекта {v}',
  'Invalid removed run parts': 'Неверные удалённые детали ряда',
  'Groups need project schemaVersion {v}': 'Группам нужна schemaVersion проекта {v}',
  'Invalid groups': 'Неверные группы',
  'Invalid group': 'Неверная группа',
  'Project settings need project schemaVersion {v}':
    'Настройкам проекта нужна schemaVersion проекта {v}',
  'Run handles and sinks need project schemaVersion {v}':
    'Ручкам ряда и мойкам нужна schemaVersion проекта {v}',
  'Invalid run handles': 'Неверные ручки ряда',
  'Invalid run handle': 'Неверная ручка ряда',
  'Invalid sinks': 'Неверные мойки',
  'Invalid sink': 'Неверная мойка',
  '3D models need project schemaVersion {v}': '3D-моделям нужна schemaVersion проекта {v}',

  // Room checks (src/core/room.ts)
  'A room needs at least four walls.': 'В комнате должно быть не меньше четырёх стен.',
  'Wall {n} is not straight along the room: change another wall by {a} or {b} mm so the walls close square.':
    'Стена {n} не идёт прямо вдоль комнаты: измените другую стену на {a} или {b} мм, чтобы стены сомкнулись под прямым углом.',
  'Wall {n} has no length.': 'У стены {n} нет длины.',
  'Walls {a} and {b} cross.': 'Стены {a} и {b} пересекаются.',
  'Room: {problem}': 'Комната: {problem}',
  '{name} is on a wall the room does not have.':
    '{name} находится на стене, которой нет в комнате.',
  '{name} runs {mm} mm past the end of wall {n} ({len} mm long): move it or make it narrower.':
    '{name} выходит на {mm} мм за конец стены {n} (длина {len} мм): переместите или сделайте уже.',
  '{name} is outside the room: move it inside the walls.':
    '{name} находится вне комнаты: переместите внутрь стен.',
  '{name} is outside the room (through a wall).':
    '{name} выходит за пределы комнаты (сквозь стену).',
  '{name} is outside the room (through a wall): it is {mm} mm too far out.':
    '{name} выходит за пределы комнаты (сквозь стену): на {mm} мм дальше, чем нужно.',
  '{name} is {mm} mm taller than the room.': '{name} на {mm} мм выше комнаты.',
  '{name} runs into {other}.': '{name} упирается в {other}.',
  '{name} is in the way of {door} (it needs {mm} mm to swing).':
    '{name} мешает {door} (ей нужно {mm} мм для открывания).',
  '{name} covers the window {window}: it stands against its wall and is {mm} mm higher than its sill.':
    '{name} закрывает окно {window}: стоит у его стены и на {mm} мм выше подоконника.',
  '{front} of {name} cannot open fully: it hits a wall (needs {need} mm).':
    '{front} изделия {name} не открывается полностью: упирается в стену (нужно {need} мм).',
  '{outlet} is hidden behind {name}: move the outlet or the piece.':
    '{outlet} скрыта за {name}: перенесите розетку или изделие.',
  'Pipe behind {name} ({label}): cut the {part} or move the piece.':
    'Труба за {name} ({label}): сделайте вырез в {part} или переместите изделие.',
  'Outlet behind {name} ({label}): cut the {part} or move the piece.':
    'Розетка за {name} ({label}): сделайте вырез в {part} или переместите изделие.',
  'Invalid room': 'Неверная комната',
  'Room height must be whole mm': 'Высота комнаты должна быть в целых мм',
  'Room outline must be at least four whole-mm corners':
    'Контур комнаты должен иметь не меньше четырёх углов в целых мм',
  'Room features missing': 'Нет элементов комнаты',
  'Invalid room feature': 'Неверный элемент комнаты',
  'Invalid room shape': 'Неверная форма комнаты',
  'Invalid wall backgrounds': 'Неверные фоны стен',
  'Invalid wall background': 'Неверный фон стены',

  // Design (src/core/design.ts)
  Interior: 'Внутреннее пространство',
  'Usable section': 'Полезная секция',
  'Back-wall wing': 'Крыло у задней стены',
  'Side-wall wing': 'Крыло у боковой стены',
  'Left drawer unit': 'Левая тумба с ящиками',
  'Right drawer unit': 'Правая тумба с ящиками',
  'Invalid part boards': 'Неверные плиты деталей',
  'Part boards need schemaVersion 4': 'Плитам деталей нужна schemaVersion 4',
  'Part board for {k} refers to an unknown material':
    'Плита детали {k} ссылается на неизвестный материал',
  'Invalid catalog metadata': 'Неверные данные каталога',
  'Invalid catalog {k}': 'Неверное поле каталога {k}',
  'Invalid catalog origin': 'Неверное происхождение из каталога',
  'Catalog source link must be an http(s) address':
    'Ссылка на источник каталога должна быть адресом http(s)',
  'Invalid wizard answers': 'Неверные ответы мастера',
  'Invalid settings': 'Неверные настройки',
  'Invalid rule setting {k}': 'Неверная настройка правила {k}',
  'Space tree is too deep': 'Дерево пространств слишком глубокое',
  'Invalid space': 'Неверное пространство',
  'Duplicate space id {id}': 'Повторяющийся id пространства {id}',
  'Invalid doors': 'Неверные дверцы',
  'Invalid handle': 'Неверная ручка',
  'Invalid appliance niche': 'Неверная ниша для техники',
  'Invalid shelf count': 'Неверное число полок',
  'Invalid adjustable flag': 'Неверный признак регулируемости',
  'Invalid drawer count': 'Неверное число ящиков',
  'Invalid U-cut': 'Неверный U-образный вырез',
  'Invalid fixed front': 'Неверный глухой фасад',
  'Drawer heights must list one size per drawer':
    'В высотах ящиков должен быть один размер на каждый ящик',
  'Invalid drawer height': 'Неверная высота ящика',
  'Invalid rail drop': 'Неверный отступ планки',
  'Invalid split': 'Неверное деление',
  'Invalid split size': 'Неверный размер деления',
  'Unknown space kind {kind}': 'Неизвестный тип пространства {kind}',
  'Design must be an object': 'Проект изделия должен быть объектом',
  'Unsupported schemaVersion': 'Неподдерживаемая schemaVersion',
  'Missing id or name': 'Нет id или названия',
  'Materials missing': 'Нет материалов',
  'Invalid material': 'Неверный материал',
  'Invalid sheet for {name}': 'Неверный лист для {name}',
  'Invalid stock for {name}': 'Неверный вид заготовки для {name}',
  'Invalid stock lengths for {name}': 'Неверные длины заготовок для {name}',
  'Invalid picture for {name}: {problems}': 'Неверная картинка для {name}: {problems}',
  'Invalid finish for {name}: use matte, satin or gloss':
    'Неверная поверхность для {name}: используйте matte, satin или gloss',
  'Invalid edge band for {name}: {problems}': 'Неверная кромка для {name}: {problems}',
  'Invalid front edge band for {name}: {problems}':
    'Неверная кромка фасадов для {name}: {problems}',
  'Invalid labels for {name}: {problems}': 'Неверные подписи для {name}: {problems}',
  'Duplicate material {id}': 'Повторяющийся материал {id}',
  'Invalid product': 'Неверное изделие',
  '{k} must be a whole number of mm': '{k} должно быть целым числом мм',
  '{k} refers to an unknown material': '{k} ссылается на неизвестный материал',
  'Invalid panel list': 'Неверный список панелей',
  'Invalid panel': 'Неверная панель',
  'Quantity of {name} must be 1 to {max}': 'Количество {name} должно быть от 1 до {max}',
  'Invalid place for {name}': 'Неверное место для {name}',
  '{name}: a placed panel has quantity 1 (list each copy with its own place)':
    '{name}: у размещённой панели количество 1 (укажите каждую копию с её местом)',
  'Invalid joints': 'Неверные соединения',
  'Invalid joint': 'Неверное соединение',
  'Invalid note': 'Неверная заметка',
  'Invalid panel purpose': 'Неверное назначение панели',
  'Invalid drawer settings': 'Неверные настройки ящиков',
  'Invalid top joint': 'Неверное соединение крышки',
  'Invalid bottom joint': 'Неверное соединение дна',
  'Invalid top kind': 'Неверный тип крышки',
  'Invalid front style': 'Неверный тип фасада',
  'Invalid mount': 'Неверное крепление',
  'Invalid back': 'Неверная задняя стенка',
  'Invalid support': 'Неверная опора',
  'Invalid pedestal': 'Неверная тумба',
  'Invalid modesty panel': 'Неверная передняя панель стола',
  'Invalid corner variant': 'Неверный вариант углового модуля',
  'Invalid corner side': 'Неверная сторона углового модуля',
  'Unknown product kind': 'Неизвестный тип изделия',
  'Invalid frame kind': 'Неверный тип каркаса',
  'Invalid frame top': 'Неверный верх каркаса',
  'Invalid stretchers': 'Неверные царги',
  'Invalid {k}': 'Неверное поле {k}',
  'Slats need a size': 'Для ламелей нужен размер',
  'Invalid lower shelf': 'Неверная нижняя полка',
  'Back rake must be a whole number of degrees from 0 to 60':
    'Наклон спинки должен быть целым числом градусов от 0 до 60',
  'Invalid recline positions': 'Неверные положения наклона',
  'Invalid footrest': 'Неверная подставка для ног',
  'Invalid backrest': 'Неверная спинка',
  'Invalid arms': 'Неверные подлокотники',
  'Invalid base': 'Неверное основание',
  'Invalid bed settings': 'Неверные настройки кровати',
  'A lifting backrest needs a slatted seat': 'Для подъёмной спинки нужно сиденье из ламелей',
  'A reclining frame needs a back': 'Для откидного каркаса нужна спинка',
  'mountHeight must be a whole number of mm': 'mountHeight должно быть целым числом мм',
  'pinRowSetback must be 8 to 300 mm': 'pinRowSetback должно быть от 8 до 300 мм',
  'railDepth must be a whole number of mm': 'railDepth должно быть целым числом мм',
  'shelfClearance must be a whole number of mm': 'shelfClearance должно быть целым числом мм',
  'topLayers must be 1 or 2': 'topLayers должно быть 1 или 2',

  // Undo step names (src/core/history.ts, src/store/designStore.ts)
  '{n|# piece|# pieces}': '{n|# изделие|# изделия|# изделий}',
  'Add {what}': 'Добавить: {what}',
  'Remove {what}': 'Удалить: {what}',
  'Change {what}': 'Изменить: {what}',
  'Turn {what}': 'Повернуть: {what}',
  'Lock {what}': 'Закрепить: {what}',
  'Unlock {what}': 'Открепить: {what}',
  'Change how many: {what}': 'Изменить количество: {what}',
  'Move {what}': 'Переместить: {what}',
  'Edit {what}': 'Правка: {what}',
  'Group pieces': 'Сгруппировать изделия',
  Ungroup: 'Разгруппировать',
  'Change the room': 'Изменить комнату',
  'Change 3D models': 'Изменить 3D-модели',
  'Change run parts': 'Изменить детали ряда',
  'Change the saw cut': 'Изменить пропил',
  'Rename the project': 'Переименовать проект',
  'Change the project': 'Изменить проект',
  'No project is open.': 'Проект не открыт.',
  'Replace {name}': 'Заменить {name}',
  'Set {setting}': 'Задать: {setting}',
  'Follow project {setting}': 'Как в проекте: {setting}',
  'Moved without mirroring: {reasons}': 'Перемещено без зеркального отражения: {reasons}',
  'Mirror the run': 'Отразить ряд',
  Align: 'Выровнять',
  Distribute: 'Распределить',
  'Gaps now {gaps} mm.': 'Зазоры теперь {gaps} мм.',
  'Group {n|# piece|# pieces}': 'Сгруппировать {n|# изделие|# изделия|# изделий}',
  'Insert {name}': 'Вставить: {name}',
  'Restore a version': 'Восстановить версию',
  'Apply style {name}': 'Применить стиль: {name}',
  'Apply finish': 'Применить отделку',
  'Resize {name}': 'Изменить размер: {name}',
  'This board is still used by parts of the piece. Choose another board for them first.':
    'Эта плита ещё используется деталями изделия. Сначала выберите для них другую плиту.',

  // Saved data and backups (src/persist, src/core/backup.ts)
  'a saved project': 'сохранённый проект',
  'the open project': 'открытый проект',
  'No backup folder chosen.': 'Папка для резервных копий не выбрана.',
  'Allow the backup folder again to back up.':
    'Снова разрешите доступ к папке резервных копий, чтобы сделать копию.',
  'Backup failed: {why}': 'Резервное копирование не удалось: {why}',
  'unknown error': 'неизвестная ошибка',
  'compressed; not written by this app': 'сжат; записан не этим приложением',
  'not part of a backup': 'не входит в резервную копию',
  'not readable as JSON': 'не читается как JSON',
  'no {key}': 'нет {key}',
  'it could not be checked': 'его не удалось проверить',
  'That file is not a valid project template: {problems}.':
    'Этот файл не является правильным шаблоном проекта: {problems}.',
} satisfies Record<string, string>;
