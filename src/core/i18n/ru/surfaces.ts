/** Russian text for room surfaces, plan tracing, placed 3D models and AR (ADR-208, ADR-153). */
export const ru_surfaces = {
  // Room surfaces and the plan picture (src/ui/RoomSurfaces.tsx, src/ui/WallBehind.tsx)
  'Floor background': 'Фон пола',
  'Floor colour': 'Цвет пола',
  'Picture on the floor': 'Изображение на полу',
  'Add a picture for the floor': 'Добавить изображение для пола',
  'Plan picture': 'Изображение плана',
  'Add a plan picture': 'Добавить изображение плана',
  'Set the scale': 'Задать масштаб',
  'Tap a corner of the plan, then the other end of a wall you know.':
    'Нажмите на угол плана, затем на другой конец стены, длину которой вы знаете.',
  'Known length': 'Известная длина',
  'Show the plan picture': 'Показывать изображение плана',
  'Remove the plan picture': 'Удалить изображение плана',
  'Remove the plan picture? The room stays.': 'Удалить изображение плана? Комната останется.',
  '{n} of 2': '{n} из 2',
  'Wall {n} behind the piece': 'Стена {n} за изделием',

  // Checks (src/core/project.ts, src/core/room.ts, src/core/planPicture.ts)
  'Invalid floor background': 'Неверный фон пола',
  'Invalid plan picture': 'Неверное изображение плана',
  'Invalid 3D model placement': 'Неверное размещение 3D-модели',
  'Placed 3D models need project schemaVersion {v}':
    'Для размещённых 3D-моделей нужна версия схемы проекта {v}',
  'Plan pictures need project schemaVersion {v}':
    'Для изображения плана нужна версия схемы проекта {v}',
  'Floor backgrounds need project schemaVersion {v}':
    'Для фона пола нужна версия схемы проекта {v}',
  'the project template {name}': 'шаблон проекта {name}',
  'a project template': 'шаблон проекта',

  // 3D view: models in Move mode, AR, render engine (src/viewer)
  '3D view tools': 'Инструменты 3D-вида',
  'More 3D actions': 'Другие действия в 3D',
  'View in AR': 'Посмотреть в AR',
  // AR placement (ADR-213 to ADR-215)
  'Looking for the floor — move the phone slowly.': 'Ищем пол — медленно ведите телефон.',
  'Tap the floor in the room corner.': 'Нажмите на пол в углу комнаты.',
  'Tap the floor along the wall the back goes against.':
    'Нажмите на пол вдоль стены, к которой встанет задняя сторона.',
  'Tap to place it on the outline.': 'Нажмите, чтобы поставить по контуру.',
  'Placed at full size. Drag it, fine-tune with the arrows, or Place again.':
    'Размещено в натуральную величину. Перетащите, уточните стрелками или разместите заново.',
  // AR walls, wall gap, occlusion, light, drag and sizes (ADR-218)
  'Both walls found — tap to place in the corner.':
    'Обе стены найдены — нажмите, чтобы поставить в угол.',
  'Wall gap': 'Зазор от стены',
  'Less wall gap': 'Меньше зазор от стены',
  'More wall gap': 'Больше зазор от стены',
  'Wall gap: {mm} mm': 'Зазор от стены: {mm} мм',
  'Sizes: {name}': 'Размеры: {name}',
  Overall: 'Общие',
  'Per piece': 'По предметам',
  'Hide behind real objects: On': 'Скрывать за реальными предметами: вкл.',
  'Hide behind real objects: Off': 'Скрывать за реальными предметами: выкл.',
  'Back-left': 'Сзади слева',
  'Back-right': 'Сзади справа',
  'Point: {name}': 'Точка: {name}',
  'Room corner': 'Угол комнаты',
  'Cancel corner': 'Отменить угол',
  'Fine-tune': 'Точная настройка',
  'Turn left by the step': 'Повернуть влево на шаг',
  'Turn right by the step': 'Повернуть вправо на шаг',
  '↑ Back': '↑ Назад',
  '↓ Forward': '↓ Вперёд',
  '← Left': '← Влево',
  '→ Right': '→ Вправо',
  'Step: 1 cm / 1°': 'Шаг: 1 см / 1°',
  'Step: 10 cm / 15°': 'Шаг: 10 см / 15°',
  'Place again': 'Разместить заново',
  'W {mm} mm': 'Ш {mm} мм',
  'H {mm} mm': 'В {mm} мм',
  'D {mm} mm': 'Г {mm} мм',
  'Exit AR': 'Выйти из AR',
  'Export for AR (.usdz)': 'Экспорт для AR (.usdz)',
  'AR is not available on this device.': 'AR недоступна на этом устройстве.',
  'AR could not start on this device.': 'Не удалось запустить AR на этом устройстве.',
  'Could not export for AR: {message}': 'Не удалось экспортировать для AR: {message}',
  'Engine: {name}': 'Движок: {name}',

  // Feature tree (src/core/features.ts, ADR-158)
  'Wall colour bands on the plan': 'Цветные полосы стен на плане',
  "A 50 mm band inside each wall with a background, in the wall's colour.":
    'Полоса 50 мм у каждой стены с фоном, в цвет стены.',
  'Floor colour or picture': 'Цвет или изображение пола',
  'Set under Walls in the room; shown on the floor in 3D and under the pieces on the plan.':
    'Задаётся в разделе «Стены» комнаты; показывается на полу в 3D и под изделиями на плане.',
  'Wall behind a single piece': 'Стена за отдельным изделием',
  'A piece opened from a project with a room shows the wall its back stands against in its own front view.':
    'Изделие, открытое из проекта с комнатой, показывает в своём виде спереди стену, к которой оно стоит спиной.',
  'Board pictures on the plan': 'Изображения плит на плане',
  "Each piece on the plan shows the picture of its highest panel's board.":
    'Каждое изделие на плане показывает изображение плиты своей самой высокой детали.',
  'Trace a plan picture': 'Обвести изображение плана',
  'Add a picture of the floor plan, set its scale from two taps and a known length, and draw the room over it.':
    'Добавьте изображение плана, задайте масштаб двумя нажатиями и известной длиной и нарисуйте комнату поверх него.',
  'Place and drag 3D models': 'Размещение и перетаскивание 3D-моделей',
  'On the floor, on the wall or on a piece; dragged with snapping on the plan and in Move mode; kept in project templates.':
    'На полу, на стене или на изделии; перетаскиваются с привязкой на плане и в режиме перемещения; сохраняются в шаблонах проектов.',
  'View in AR and export for AR': 'Просмотр в AR и экспорт для AR',
  'AR furniture sits on the real floor': 'Мебель в AR стоит на настоящем полу',
  'Steady floor-only hits, anchors so it does not drift, a soft shadow under it, sharper edges.':
    'Только устойчивые попадания в пол, якоря против смещения, мягкая тень под мебелью, более чёткие края.',
  'Place in AR by a corner or into a room corner': 'Размещение в AR по углу или в угол комнаты',
  'A footprint outline, a Point switch (Centre, Back-left, Back-right) and Room corner by two floor taps.':
    'Контур основания, переключатель точки (центр, сзади слева, сзади справа) и угол комнаты двумя нажатиями на пол.',
  'Fine-tune in AR and see its size': 'Точная настройка в AR и размеры',
  'AR walls, wall gap, real objects, room light, drag and per-piece sizes':
    'Стены в AR, зазор от стены, реальные предметы, свет комнаты, перетаскивание и размеры по предметам',
  'Room corner in one tap when both walls are seen, a wall gap, real objects hide it, the room light, one-finger drag, Sizes per piece.':
    'Угол комнаты одним нажатием, когда видны обе стены, зазор от стены, реальные предметы закрывают мебель, свет комнаты, перетаскивание одним пальцем, размеры по предметам.',
  'Move 1 cm or 10 cm, turn 1° or 15°, Place again, and W × H × D labels in mm.':
    'Сдвиг на 1 или 10 см, поворот на 1° или 15°, повторное размещение и подписи Ш × В × Г в мм.',
  'From the 3D toolbar ⋯: View in AR on phones that offer it, and a .usdz file for AR Quick Look.':
    'Из меню ⋯ панели 3D: просмотр в AR на телефонах, которые это поддерживают, и файл .usdz для AR Quick Look.',
  'WebGPU rendering': 'Рендеринг через WebGPU',
  'Render uses the WebGPU path tracer when the device has WebGPU, WebGL 2 otherwise.':
    'Рендеринг использует трассировщик WebGPU, если устройство поддерживает WebGPU, иначе WebGL 2.',
} satisfies Record<string, string>;
