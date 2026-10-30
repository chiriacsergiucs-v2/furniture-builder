/** Russian text for project variables and value sets (ADR-166, ADR-167). Key: the English text; value: the Russian text. */
export const ru_variables = {
  // features
  'Project variables and formulas': 'Переменные и формулы проекта',
  'Bind a size, a division or a position to a named value; change it once.':
    'Привяжите размер, деление или положение к именованному значению; меняйте его один раз.',
  'Value sets': 'Наборы значений',
  'Duplicate every bound piece with other values, with the room; save a set as a project.':
    'Дублируйте каждое привязанное изделие с другими значениями, вместе с комнатой; сохраните набор как проект.',
  // validation
  'Invalid variables': 'Недопустимые переменные',
  'Variables need project schemaVersion {v}': 'Переменным нужна версия схемы проекта {v}',
  'Invalid variable': 'Недопустимая переменная',
  'Invalid value sets': 'Недопустимые наборы значений',
  'Value sets need project schemaVersion {v}': 'Наборам значений нужна версия схемы проекта {v}',
  'Invalid value set': 'Недопустимый набор значений',
  'Item {id}: unknown value set': 'Элемент {id}: неизвестный набор значений',
  'Invalid item bindings': 'Недопустимые привязки элемента',
  'Bindings need project schemaVersion {v}': 'Привязкам нужна версия схемы проекта {v}',
  'Invalid item value set': 'Недопустимый набор значений элемента',
  // sets
  'Set {n}': 'Набор {n}',
  '{project} — {set}': '{project} — {set}',
  // variables core
  'A variable needs a name.': 'Переменной нужно имя.',
  'A variable name is at most {n} characters.': 'Имя переменной — не более {n} символов.',
  'A variable name is letters, digits and spaces, starting with a letter.':
    'Имя переменной — буквы, цифры и пробелы, начиная с буквы.',
  'A variable named “{name}” already exists.': 'Переменная «{name}» уже есть.',
  'Unknown variable “{name}”.': 'Неизвестная переменная «{name}».',
  'Unexpected “{text}” in the formula.': 'Неожиданное «{text}» в формуле.',
  'The formula is empty.': 'Формула пуста.',
  'The formula ends too early.': 'Формула обрывается.',
  'A “(” is not closed.': 'Скобка «(» не закрыта.',
  'Division by zero.': 'Деление на ноль.',
  'The formula has no value.': 'У формулы нет значения.',
  '“{name}” refers to itself in a circle.': '«{name}» ссылается на себя по кругу.',
  '“{name}” depends on “{dep}”, which has a problem.':
    '«{name}» зависит от «{dep}», где есть проблема.',
  '{raw} → {n} mm': '{raw} → {n} мм',
  'Division {n}': 'Деление {n}',
  '{set}, variable “{name}”: {problem}': '{set}, переменная «{name}»: {problem}',
  'Variable “{name}”: {problem}': 'Переменная «{name}»: {problem}',
  '{name}, {field}: {problem}': '{name}, {field}: {problem}',
  '{name} has no {field} to bind.': 'У {name} нет поля «{field}» для привязки.',
  '{name}: {field} follows “{expr}” although its size is locked.':
    '{name}: {field} следует «{expr}», хотя размер заблокирован.',
  '{name}: {field} follows “{expr}”; unbind it to change it.':
    '{name}: {field} следует «{expr}»; отвяжите, чтобы изменить.',
  // store steps
  'Add variable {name}': 'Добавить переменную {name}',
  'Change variable': 'Изменить переменную',
  'Delete variable': 'Удалить переменную',
  Unbind: 'Отвязать',
  'Bind to variable': 'Привязать к переменной',
  'Add value set': 'Добавить набор значений',
  'Change value set': 'Изменить набор значений',
  'Remove value set': 'Удалить набор значений',
  // piece card
  '{set} of {name}': '{set}: копия «{name}»',
  Set: 'Набор',
  // bind button and sheet
  '{expr}: {problem}': '{expr}: {problem}',
  '{expr} = {n}': '{expr} = {n}',
  '{field} follows a variable; change or unbind':
    '{field} следует переменной; изменить или отвязать',
  'Bind {field} to a variable': 'Привязать {field} к переменной',
  'Bind to a variable': 'Привязать к переменной',
  'Bind {field}': 'Привязать {field}',
  'About binding': 'О привязке',
  'The field follows the variable or formula: change the variable in Settings › Variables and every bound piece follows. A non-whole result is rounded to the nearest mm.':
    'Поле следует переменной или формуле: измените переменную в Настройки › Переменные, и каждое привязанное изделие последует. Нецелый результат округляется до мм.',
  Bind: 'Привязать',
  Variable: 'Переменная',
  'No variables yet. Add them in Settings › Variables.':
    'Переменных пока нет. Добавьте их в Настройки › Переменные.',
  Formula: 'Формула',
  'e.g. bottom height + 18': 'например, высота низа + 18',
  '= {text}': '= {text}',
  // variables panel
  Variables: 'Переменные',
  'About variables': 'О переменных',
  'A named number or formula. Bind a piece’s width, height, depth, a division or its position to it with the ƒ button beside the field; change the variable and every bound piece follows.':
    'Именованное число или формула. Привяжите ширину, высоту, глубину, деление или положение изделия кнопкой ƒ рядом с полем; измените переменную, и каждое привязанное изделие последует.',
  'A variable needs a value or a formula.': 'Переменной нужно значение или формула.',
  'Delete “{name}”? {list} use it; they keep their current numbers.':
    'Удалить «{name}»? Её используют: {list}; они сохранят текущие числа.',
  'Delete “{name}”?': 'Удалить «{name}»?',
  'Name of {name}': 'Имя {name}',
  'Value of {name}': 'Значение {name}',
  'used by {n|# piece|# pieces}': 'используют {n|# изделие|# изделия|# изделий}',
  'not used': 'не используется',
  'Delete {name}': 'Удалить {name}',
  'New variable': 'Новая переменная',
  'e.g. bottom height': 'например, высота низа',
  'Value or formula': 'Значение или формула',
  'Add variable': 'Добавить переменную',
  // sets panel
  'Set 1 is the values above. Another set duplicates every bound piece with its own values, beside set 1.':
    'Набор 1 — значения выше. Другой набор дублирует каждое привязанное изделие со своими значениями, рядом с набором 1.',
  'Add set': 'Добавить набор',
  'Saved as “{name}”. Keep {set} in this project?':
    'Сохранено как «{name}». Оставить {set} в этом проекте?',
  Keep: 'Оставить',
  'Remove {set} and its {n|# piece|# pieces}?':
    'Удалить {set} и {n|# изделие|# изделия|# изделий}?',
  'Remove {set}?': 'Удалить {set}?',
  '{done} of {total} values set': 'Задано {done} из {total} значений',
  '{set}: value of {name}': '{set}: значение {name}',
  'Set origin from left': 'Начало набора слева',
  'Set origin from back': 'Начало набора от задней стены',
  'Set every value first': 'Сначала задайте все значения',
  'Save as separate project': 'Сохранить как отдельный проект',
  'Remove set': 'Удалить набор',
  'The set draws its pieces and can be saved once every value is set.':
    'Набор показывает изделия и может быть сохранён, когда заданы все значения.',
  'Saved as “{name}”.': 'Сохранено как «{name}».',
  '{set} is incomplete; its pieces keep their last values.':
    '{set} не завершён; его изделия сохраняют последние значения.',
  '{name}: Above floor follows “{expr}” but the piece stands on the floor or on a piece; set Placed to Anywhere or Wall.':
    '{name}: «Над полом» следует «{expr}», но изделие стоит на полу или на другом изделии; выберите «Где угодно» или «Стена».',
  'Edit the set-1 piece; this copy follows it.':
    'Редактируйте изделие набора 1; эта копия следует ему.',
  'Go to it': 'Перейти к нему',
  'Select them': 'Выбрать их',
  'All variables and value sets…': 'Все переменные и наборы значений…',
  'A copy of the set-1 piece: change the size there.':
    'Копия изделия набора 1: меняйте размер там.',
  '{n} mm is outside {min}–{max} mm.': '{n} мм вне диапазона {min}–{max} мм.',
  '{name}, {field}: {problem} The field keeps {n} mm.':
    '{name}, {field}: {problem} Поле сохраняет {n} мм.',
} satisfies Record<string, string>;
