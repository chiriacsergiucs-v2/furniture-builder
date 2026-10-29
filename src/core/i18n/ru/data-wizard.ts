/** Russian text for built-in data: wizard (ADR-155). Key: the English text; value: the Russian text. */
export const data_wizard: Record<string, string> = {
  // Steps
  Size: 'Размер',
  Type: 'Тип',
  Dividers: 'Перегородки',
  Contents: 'Наполнение',
  Doors: 'Дверцы',
  Base: 'Основание',
  Back: 'Задняя стенка',
  Frame: 'Каркас',
  Desk: 'Письменный стол',
  Bed: 'Кровать',
  Review: 'Проверка',
  'Overall size in whole millimetres (width, height from the floor, depth). Until you change them, sizes and name follow the type you picked.':
    'Габариты в целых миллиметрах (ширина, высота от пола, глубина). Пока вы их не измените, размеры и название следуют выбранному типу.',
  'What kind of construction. The next steps ask only what applies to it.':
    'Какая конструкция. Следующие шаги спрашивают только то, что к ней относится.',
  'Vertical dividers split the inside into compartments, left to right.':
    'Вертикальные перегородки делят внутреннее пространство на секции слева направо.',
  'What each compartment holds, left to right.': 'Что находится в каждой секции, слева направо.',
  'Doors over the whole piece, or chosen per compartment. Drawers have their own fronts.':
    'Дверцы на всё изделие или на каждую секцию отдельно. У ящиков свои фасады.',
  'What the piece stands on. Legs come with the table and bench types.':
    'На чём стоит изделие. Ножки есть у типов «стол» и «скамья».',
  'A back panel keeps the box square; open shelving can go without.':
    'Задняя стенка держит корпус в прямоугольнике; открытый стеллаж может обойтись без неё.',
  'Legs, rails under the top and stretchers between the legs.':
    'Ножки, царги под крышкой и проножки между ножками.',
  'What carries the top: panel gables or drawer pedestals.':
    'На чём держится столешница: на боковых панелях или на тумбах с ящиками.',
  'The bed is sized from its mattress; the height asked first is the headboard height.':
    'Размер кровати определяется матрасом; высота, указанная первой, — это высота изголовья.',
  'Check the picture, parts and problems, then create the piece.':
    'Проверьте изображение, детали и проблемы, затем создайте изделие.',

  // Fields
  Name: 'Название',
  Category: 'Категория',
  Width: 'Ширина',
  Height: 'Высота',
  Depth: 'Глубина',
  Board: 'Плита',
  'Panel thickness comes from the board.': 'Толщина панелей берётся из плиты.',
  'Construction type': 'Тип конструкции',
  'Vertical dividers': 'Вертикальные перегородки',
  'Compartment widths': 'Ширина секций',
  'Width of each compartment (0 = share the rest)': 'Ширина каждой секции (0 = делить остаток)',
  Compartment: 'Секция',
  'Doors on compartment': 'Дверцы на секции',
  Handles: 'Ручки',
  'Hole spacing 128 mm for bars (typical); check your handle.':
    'Межосевое расстояние 128 мм для ручек-скоб (типично); проверьте свою ручку.',
  'Plinth height': 'Высота цоколя',
  'Underside above the floor': 'Низ над полом',
  'Back panel': 'Задняя стенка',
  Top: 'Крышка',
  Stretchers: 'Проножки',
  'Lower shelf': 'Нижняя полка',
  'Lower shelf height': 'Высота нижней полки',
  'Leg section (square)': 'Сечение ножки (квадрат)',
  'Solid timber; a layout default, not a load rating.':
    'Массив дерева; значение по умолчанию для компоновки, а не допустимая нагрузка.',
  Support: 'Опора',
  'Drawers per pedestal': 'Ящиков в тумбе',
  'Modesty panel': 'Передняя панель',
  'Mattress width': 'Ширина матраса',
  'Mattress length': 'Длина матраса',
  'Slats above the floor': 'Ламели над полом',
  Footboard: 'Изножье',
  'Footboard height': 'Высота изножья',
  'Headboard height': 'Высота изголовья',

  // Options
  'Kitchen cabinets': 'Кухонные шкафы',
  'Storage and display': 'Хранение и витрины',
  'Tables and surfaces': 'Столы и поверхности',
  Seating: 'Сиденья',
  'Sleeping and lying': 'Сон и отдых',
  'PAL 18 white (18 mm)': 'ЛДСП 18 белая (18 мм)',
  'PAL 18 oak (18 mm)': 'ЛДСП 18 дуб (18 мм)',
  'PAL 16 white (16 mm)': 'ЛДСП 16 белая (16 мм)',
  'MDF 18 painted (18 mm)': 'МДФ 18 крашеный (18 мм)',
  Equal: 'Одинаковая',
  Custom: 'Своя',
  Open: 'Открытая',
  Shelves: 'Полки',
  Drawers: 'Ящики',
  'Hanging rail': 'Штанга для одежды',
  'Shelves over drawers': 'Полки над ящиками',
  None: 'Нет',
  'One door': 'Одна дверца',
  Pair: 'Пара',
  'Sliding pair': 'Пара раздвижных',
  'Per compartment': 'На каждую секцию',
  One: 'Одна',
  Bar: 'Скоба',
  Knob: 'Кнопка',
  'Push to open': 'Нажимное открывание',
  Plinth: 'Цоколь',
  'None (on the floor)': 'Нет (на полу)',
  'Hung on the wall': 'Навесной на стене',
  'Nailed on the back': 'Прибита сзади',
  'Set in': 'Вставная',
  'No back': 'Без задней стенки',
  Panel: 'Панель',
  Slats: 'Ламели',
  Box: 'По периметру',
  H: 'H-образные',
  Yes: 'Да',
  No: 'Нет',
  'Two gables': 'Две боковые панели',
  'Pedestal left': 'Тумба слева',
  'Pedestal right': 'Тумба справа',
  'Two pedestals': 'Две тумбы',
  'Low (rails height)': 'Низкое (на высоте царг)',
  Raised: 'Высокое',

  // Construction types
  'Cabinet (closed box)': 'Шкаф (закрытый корпус)',
  'A rectangular carcass: sides, top, bottom and back, with dividers, shelves, drawers and doors.':
    'Прямоугольный корпус: боковины, крышка, дно и задняя стенка, с перегородками, полками, ящиками и дверцами.',
  'Open shelving': 'Открытый стеллаж',
  'A rectangular frame with no doors: bookcases and open storage, with or without a back.':
    'Прямоугольный корпус без дверец: книжные и открытые стеллажи, с задней стенкой или без.',
  Wardrobe: 'Платяной шкаф',
  'A tall carcass for clothes: hanging rails, shelves and drawers, behind hinged or sliding doors.':
    'Высокий корпус для одежды: штанги, полки и ящики за распашными или раздвижными дверцами.',
  'A bed frame sized from its mattress: headboard, side rails, slats on ledgers, optional raised footboard.':
    'Каркас кровати по размеру матраса: изголовье, боковые царги, ламели на брусках, по желанию высокое изножье.',
  'Table (leg frame)': 'Стол (на ножках)',
  'Four legs, rails under the top, optional stretchers and a lower shelf.':
    'Четыре ножки, царги под крышкой, по желанию проножки и нижняя полка.',
  'Bench (leg frame)': 'Скамья (на ножках)',
  'A long low seat on four legs, panel or slatted, with optional stretchers and shelf.':
    'Длинное низкое сиденье на четырёх ножках, из панели или ламелей, по желанию с проножками и полкой.',
  'A worktop on panel gables or on drawer pedestals, with an optional modesty panel.':
    'Столешница на боковых панелях или тумбах с ящиками, по желанию с передней панелью.',
};
