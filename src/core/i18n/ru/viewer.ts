/** Russian text for viewer (ADR-153). Key: the English text; value: the Russian text. */
export const ru_viewer = {
  // Shared
  mm: 'мм',
  Width: 'Ширина',
  Height: 'Высота',
  Depth: 'Глубина',
  Cancel: 'Отмена',
  Reset: 'Сбросить',
  Apply: 'Применить',
  Delete: 'Удалить',
  'Fill wall': 'Заполнить стену',
  'Make the picture cover the whole wall': 'Растянуть картинку на всю стену',
  'Wall {n}': 'Стена {n}',
  '{name} could not be saved on this device.': '{name} не удалось сохранить на этом устройстве.',

  // View switch and options (viewChoice.ts, ViewOptions.tsx)
  '3D preview is not available in this browser': '3D-просмотр недоступен в этом браузере',
  Options: 'Параметры',
  'View options': 'Параметры вида',

  // Render a picture (RenderDialog.tsx, pathtrace.ts)
  'Rendered picture': 'Готовая картинка',
  'Render again': 'Рендерить снова',
  Start: 'Начать',
  'Save PNG': 'Сохранить PNG',
  'Render a picture': 'Рендер картинки',
  'Rendering needs WebGL 2 on this device': 'Для рендера на этом устройстве нужен WebGL 2',
  Size: 'Размер',
  'Renders what the 3D view shows, with realistic light. Best on a laptop; a phone may be slow. The picture stays on this device.':
    'Рендерит то, что показывает 3D-вид, с реалистичным светом. Лучше всего на ноутбуке; на телефоне может быть медленно. Картинка остаётся на этом устройстве.',
  'Rendering… {n} / {total} samples': 'Рендер… {n} / {total} проходов',
  'Done: {n} samples': 'Готово: {n} проходов',
  'Could not render: {message}': 'Не удалось выполнить рендер: {message}',
  'Open the 3D view first.': 'Сначала откройте 3D-вид.',

  // Straighten a wall photo (StraightenPhoto.tsx)
  'Bottom-left corner of the wall': 'Нижний левый угол стены',
  'Bottom-right corner of the wall': 'Нижний правый угол стены',
  'Top-right corner of the wall': 'Верхний правый угол стены',
  'Top-left corner of the wall': 'Верхний левый угол стены',
  'Bottom-left corner of the wall: drag, or use the arrow keys':
    'Нижний левый угол стены: перетащите или используйте клавиши со стрелками',
  'Bottom-right corner of the wall: drag, or use the arrow keys':
    'Нижний правый угол стены: перетащите или используйте клавиши со стрелками',
  'Top-right corner of the wall: drag, or use the arrow keys':
    'Верхний правый угол стены: перетащите или используйте клавиши со стрелками',
  'Top-left corner of the wall: drag, or use the arrow keys':
    'Верхний левый угол стены: перетащите или используйте клавиши со стрелками',
  'Straighten the photo on {wall}': 'Выровнять фото: {wall}',
  'Drag the four handles onto the corners of the wall in the photo. The part inside is straightened to fill the wall picture.':
    'Перетащите четыре маркера на углы стены на фото. Часть внутри выпрямляется и заполняет картинку стены.',
  'Photo on {wall}': 'Фото: {wall}',
  "The corners cross or lie in a line. Put them on the wall's four corners in order.":
    'Углы пересекаются или лежат на одной линии. Поставьте их на четыре угла стены по порядку.',

  // Wall background (WallBackground.tsx)
  '{name} keeps its current background.': '{name} сохраняет текущий фон.',
  '{name} background': '{name}: фон',
  None: 'Нет',
  Colour: 'Цвет',
  Picture: 'Картинка',
  '{name} colour': '{name}: цвет',
  'Picture on {name}': 'Картинка: {name}',
  'Preparing picture…': 'Подготовка картинки…',
  'Replace picture': 'Заменить картинку',
  'Add a picture': 'Добавить картинку',
  'Replace picture for {name}': 'Заменить картинку: {name}',
  'Add a picture for {name}': 'Добавить картинку: {name}',
  'The picture {file} is not on this device. Its average colour is shown; add the picture again to see it.':
    'Картинки {file} нет на этом устройстве. Показан её средний цвет; добавьте картинку снова, чтобы её увидеть.',
  'Covers: {rect}': 'Покрывает: {rect}',
  ' · straightened': ' · выровнено',
  'Straighten photo on {name}': 'Выровнять фото: {name}',
  'Straighten photo': 'Выровнять фото',
  'Move and stretch it on the wall in 3D with Adjust wall picture.':
    'Перемещайте и растягивайте её на стене в 3D с помощью «Настроить картинку стены».',

  // Fill a wall (WallFill.tsx)
  Wall: 'Стена',
  Suggestions: 'Варианты',
  Refine: 'Уточнить',
  'Mix: wall {wall} mm, {widths} mm': 'Набор: стена {wall} мм, {widths} мм',
  'Mix: {widths} mm': 'Набор: {widths} мм',
  'Wall: {w} mm': 'Стена: {w} мм',
  '…and {n} more in the project.': '…и ещё {n} в проекте.',
  'Use this mix': 'Выбрать этот набор',
  'Fill a wall': 'Заполнить стену',
  'The project could not be saved in this browser’s storage.':
    'Не удалось сохранить проект в хранилище этого браузера.',
  'Fill a wall steps': 'Шаги заполнения стены',
  'The space to fill, in mm. Pieces taller than the height are still suggested, with a warning.':
    'Пространство для заполнения, в мм. Изделия выше этой высоты тоже предлагаются, с предупреждением.',
  'Tall cabinet depth': 'Глубина высокого шкафа',
  'same as depth': 'как глубина',
  'Leave a field empty for any. The width range is your choice; shelves wider than the shelf-span guidance get a centre divider.':
    'Оставьте поле пустым — подойдёт любое значение. Диапазон ширины выбираете вы; полки шире рекомендуемого пролёта получают центральную перегородку.',
  'Min piece width': 'Мин. ширина изделия',
  'Max piece width': 'Макс. ширина изделия',
  'Base height': 'Высота нижних шкафов',
  'Number of pieces': 'Количество изделий',
  any: 'любое',
  'Tall cabinets': 'Высокие шкафы',
  'At least, open shelf bases': 'Не меньше, открытых нижних шкафов с полками',
  'At least, drawer bases': 'Не меньше, нижних шкафов с ящиками',
  'At least, door bases': 'Не меньше, нижних шкафов с дверцами',
  'Equal fronts': 'Одинаковые фасады',
  off: 'выкл.',
  'Every door the same width; insides left empty to configure later.':
    'Все дверцы одной ширины; внутреннее наполнение остаётся пустым, чтобы настроить позже.',
  'Wall cabinet height': 'Высота настенных шкафов',
  'Wall cabinet tops sit at the wall height.': 'Верх настенных шкафов — на высоте стены.',
  'Wall cabinets': 'Настенные шкафы',
  Any: 'Любые',
  Always: 'Всегда',
  Never: 'Никогда',
  'Tall cabinets stand': 'Высокие шкафы стоят',
  Auto: 'Авто',
  Left: 'Слева',
  Right: 'Справа',
  'Both ends': 'По краям',
  Centre: 'В центре',
  'Suggested mixes': 'Предложенные наборы',
  '{width} mm wall · best {n}, checked by the model':
    'Стена {width} мм · лучшие {n}, проверены моделью',
  'Show suggestions': 'Показать варианты',
  'Suggest again': 'Предложить снова',

  // 3D models (Models3D.tsx)
  Front: 'Спереди',
  'Selected 3D model: {name}': 'Выбранная 3D-модель: {name}',
  'Selected 3D model': 'Выбранная 3D-модель',
  'About 3D models': 'О 3D-моделях',
  'Display only: never in the parts list, sheets, costs or shopping list. Its box is checked against the pieces and the room.':
    'Только для показа: никогда не попадает в список деталей, листы, стоимость или список покупок. Её габарит проверяется относительно изделий и комнаты.',
  'This 3D model is not on this device; it is drawn as a box.':
    'Этой 3D-модели нет на этом устройстве; она показана как коробка.',
  'Keep proportions': 'Сохранять пропорции',
  'About keep proportions': 'О сохранении пропорций',
  'Changing one side scales the other two with it.':
    'При изменении одной стороны две другие масштабируются вместе с ней.',
  'Each side changes on its own; the model stretches to fill its box.':
    'Каждая сторона меняется отдельно; модель растягивается по своему габариту.',
  'Reset size': 'Сбросить размер',
  Turn: 'Поворот',
  'Front faces': 'Лицевая сторона',
  'About front faces': 'О лицевой стороне',
  'The side of the model that is its front, if it came in facing the wrong way.':
    'Сторона модели, которая является её лицевой, если модель повёрнута не туда.',
  'From left': 'От левого края',
  'From back': 'От задней стены',
  'Height above floor': 'Высота над полом',
  'Remove “{name}” from this project?': 'Убрать «{name}» из этого проекта?',
  'Remove from project': 'Убрать из проекта',
  '3D models (display only)': '3D-модели (только показ)',
  'Imported {name}.': 'Импортировано: {name}.',
  "Delete “{name}” from this device's 3D models?":
    'Удалить «{name}» из 3D-моделей этого устройства?',
  'Deleted {name}.': 'Удалено: {name}.',
  '{name} is used by {list}; remove it there first.':
    '{name} используется в: {list}; сначала уберите её оттуда.',
  '{name} could not be deleted.': '{name} не удалось удалить.',
  'My 3D models': 'Мои 3D-модели',
  'About my 3D models': 'О моих 3D-моделях',
  'Appliances, sinks or decor from a .glb or .gltf file on this device, up to 30 MB and 500 000 triangles. Display only: never cut, priced or bought. Nothing is uploaded.':
    'Техника, мойки или декор из файла .glb или .gltf на этом устройстве, до 30 МБ и 500 000 треугольников. Только для показа: не раскраивается, не оценивается и не покупается. Ничего не загружается.',
  'Importing…': 'Импорт…',
  'Import 3D model': 'Импортировать 3D-модель',
  '{n} triangles': 'треугольников: {n}',
  'Delete {name}': 'Удалить {name}',
  '{name} (3D model), {w} by {d} mm': '{name} (3D-модель), {w} на {d} мм',
  '{name} (3D model), {w} wide, {h} high': '{name} (3D-модель), ширина {w}, высота {h}',

  // Model and picture files (persist/models.ts, persist/images.ts)
  '{name} is {size} MB; the limit is {limit} MB.': '{name}: {size} МБ; предел — {limit} МБ.',
  '{name} could not be read.': '{name} не удалось прочитать.',
  'The 3D reader could not be loaded; reload the app and try again.':
    'Не удалось загрузить модуль чтения 3D; перезагрузите приложение и попробуйте снова.',
  '{name} has no size to show.': 'У {name} нет размера для показа.',
  '{name} has {n} triangles; the limit is {limit}.': '{name}: {n} треугольников; предел — {limit}.',
  '{name} could not be read as a 3D model.': '{name} не удалось прочитать как 3D-модель.',
  'The 3D models in the file could not be read.': 'Не удалось прочитать 3D-модели в файле.',
  'a 3D model': '3D-модель',
  '{name} was skipped: it is not a valid 3D model entry.':
    '{name} пропущена: это неверная запись 3D-модели.',
  '{name} was skipped: {problem}': '{name} пропущена: {problem}',
  '{name} could not be read as a picture.': '{name} не удалось прочитать как картинку.',
  'This browser cannot prepare pictures.': 'Этот браузер не может подготовить картинки.',
  '{name} could not be prepared.': '{name} не удалось подготовить.',
  'The pictures in the file could not be read.': 'Не удалось прочитать картинки в файле.',
  'A picture was skipped: {problems}.': 'Картинка пропущена: {problems}.',
  'The picture {name} could not be saved on this device.':
    'Картинку {name} не удалось сохранить на этом устройстве.',

  // 3D view (Viewer3D.tsx, section.ts)
  Locked: 'Закреплено',
  'Place pieces in 3D': 'Расстановка изделий в 3D',
  'Turn off Exploded 3D to move pieces': 'Выключите разнесённый 3D-вид, чтобы перемещать изделия',
  'Drag a piece to move it; dragging empty space turns the view':
    'Перетащите изделие, чтобы переместить его; перетаскивание пустого места поворачивает вид',
  Move: 'Переместить',
  'Turn off Exploded 3D to adjust a wall picture':
    'Выключите разнесённый 3D-вид, чтобы настроить картинку стены',
  'Tap a wall with a picture, then drag the picture to shift it or its handles to stretch it':
    'Коснитесь стены с картинкой, затем перетащите картинку, чтобы сдвинуть её, или маркеры, чтобы растянуть',
  'Adjust wall picture': 'Настроить картинку стены',
  'Snap within {n} mm to walls and neighbours; hold Alt to place freely':
    'Привязка в пределах {n} мм к стенам и соседям; удерживайте Alt для свободной расстановки',
  Snap: 'Привязка',
  'Turn 90° anticlockwise about its centre':
    'Повернуть на 90° против часовой стрелки вокруг центра',
  'Turn about its centre (R)': 'Повернуть вокруг центра (R)',
  'Turn 90° clockwise about its centre': 'Повернуть на 90° по часовой стрелке вокруг центра',
  'Turn about its centre (Shift+R)': 'Повернуть вокруг центра (Shift+R)',
  'Turn 90° ↺': 'Повернуть на 90° ↺',
  'Turn 90° ↻': 'Повернуть на 90° ↻',
  'Move to…': 'Переместить к…',
  'Cut through the project to see inside': 'Разрезать проект, чтобы увидеть внутри',
  Section: 'Разрез',
  'Show only the selected pieces': 'Показать только выбранные изделия',
  Isolate: 'Изолировать',
  'Show the room walls solid or see-through': 'Показать стены комнаты сплошными или прозрачными',
  'Solid walls': 'Сплошные стены',
  'Section cut': 'Разрез',
  'Cut across the width': 'Разрез по ширине',
  'Cut across the height': 'Разрез по высоте',
  'Cut across the depth': 'Разрез по глубине',
  'Cut position across the width, mm': 'Положение разреза по ширине, мм',
  'Cut position across the height, mm': 'Положение разреза по высоте, мм',
  'Cut position across the depth, mm': 'Положение разреза по глубине, мм',
  'Cut at {n} mm': 'Разрез на {n} мм',
  'Add pieces under Compose to see them in 3D.':
    'Добавьте изделия в разделе «Компоновка», чтобы увидеть их в 3D.',
  'Resize width': 'Изменить ширину',
  'Resize height': 'Изменить высоту',
  'Resize depth': 'Изменить глубину',
  '{label}: drag': '{label}: перетащите',
  'Change height': 'Изменить высоту',
  'Change height: drag up or down': 'Изменить высоту: перетащите вверх или вниз',
  ' — below the floor, it will not move': ' — ниже пола, не переместится',
  '{w} × {h} × {d} mm (W × H × D)': '{w} × {h} × {d} мм (Ш × В × Г)',
  'top-left corner': 'верхний левый угол',
  'top edge': 'верхний край',
  'top-right corner': 'верхний правый угол',
  'right edge': 'правый край',
  'bottom-right corner': 'нижний правый угол',
  'bottom edge': 'нижний край',
  'bottom-left corner': 'нижний левый угол',
  'left edge': 'левый край',
  'Stretch the picture: {handle}': 'Растянуть картинку: {handle}',
  'Stretch the picture: drag the {handle}': 'Растянуть картинку: перетащите {handle}',
  'Tap a wall with a picture to adjust it': 'Коснитесь стены с картинкой, чтобы настроить её',
  'Wall {n} picture: {rect}': 'Картинка стены {n}: {rect}',
  'From left {x} · From back {z} mm': 'От левого края {x} · От задней стены {z} мм',
  'Snaps: {list}': 'Привязка: {list}',
  'Alt held: placing freely.': 'Alt удерживается: свободная расстановка.',
  'Snap is off.': 'Привязка выключена.',
} satisfies Record<string, string>;
