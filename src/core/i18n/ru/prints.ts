/**
 * Russian text for prints, exports and seller matching (ADR-206): the client sheet, step pictures, the scene export
 * and seller products on fasteners and run parts. Key: the English text; value: the Russian text.
 */
export const ru_prints = {
  // features
  'Client sheet': 'Лист для клиента',
  'One A4 page to sell from: a picture, the pieces with their sizes and the estimated price, with the lines that have no price counted.':
    'Одна страница A4 для продажи: картинка, изделия с размерами и ориентировочная цена, строки без цены посчитаны.',
  'Export scene (.glb)': 'Экспорт сцены (.glb)',
  'The 3D scene with its boards and their pictures as one binary glTF file, for Blender or another renderer; made on this device.':
    '3D-сцена с плитами и их картинками одним двоичным файлом glTF для Blender или другого рендерера; создаётся на этом устройстве.',
  // project document
  'Run part products need project schemaVersion {v}':
    'Товарам для деталей ряда нужна версия схемы проекта {v}',
  'Invalid run part products': 'Неверные товары для деталей ряда',
  'Invalid run part product for {k}': 'Неверный товар для детали ряда {k}',
  // shopping list
  '{w} × {h} × {d} mm, {material} (priced by its product)':
    '{w} × {h} × {d} мм, {material} (цена по её товару)',
  'with its board': 'вместе с плитой',
  'Boards and worktops first. A product priced per piece or per metre prices this part instead of its board.':
    'Сначала плиты и столешницы. Товар с ценой за штуку или за метр задаёт цену этой детали вместо её плиты.',
  // export scene (.glb)
  'The scene could not be exported.': 'Не удалось экспортировать сцену.',
  'The scene could not be exported: {message}': 'Не удалось экспортировать сцену: {message}',
  'More 3D actions': 'Другие действия 3D',
  // client sheet and step pictures
  'Print one page for your client: a picture, the pieces and the estimated price':
    'Печать одной страницы для клиента: картинка, изделия и ориентировочная цена',
  'Taking the step pictures…': 'Снимаем картинки шагов…',
  'Project seller items need project schemaVersion {v}':
    'Товары продавца проекта требуют schemaVersion проекта {v}',
  // The printed sheet's root, hidden from screen readers (ADR-224).
  'Printed sheet': 'Лист для печати',
} satisfies Record<string, string>;
