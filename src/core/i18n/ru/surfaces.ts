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
  'Tap the floor to place': 'Нажмите на пол, чтобы разместить',
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
  'From the 3D toolbar ⋯: View in AR on phones that offer it, and a .usdz file for AR Quick Look.':
    'Из меню ⋯ панели 3D: просмотр в AR на телефонах, которые это поддерживают, и файл .usdz для AR Quick Look.',
  'WebGPU rendering': 'Рендеринг через WebGPU',
  'Render uses the WebGPU path tracer when the device has WebGPU, WebGL 2 otherwise.':
    'Рендеринг использует трассировщик WebGPU, если устройство поддерживает WebGPU, иначе WebGL 2.',
} satisfies Record<string, string>;
