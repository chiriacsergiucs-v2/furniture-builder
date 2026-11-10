/** Russian text for the editing-flow fixes (ADR-243 to ADR-246). Key: the English text; value: the Russian text. */
export const ru_flows = {
  // Locks (ADR-243)
  '{name} is locked — unlock it to remove it.':
    '{name} закреплено — снимите закрепление, чтобы удалить.',
  'One of them has its size, turn, boards or construction locked; unlock it first.':
    'У одного из них закреплены размер, поворот, плиты или конструкция; сначала снимите закрепление.',
  'The project changed since this repair was worked out; pick it again.':
    'Проект изменился после расчёта этого исправления; выберите его снова.',
  'Not saved to the template; your draft waits on the Catalog page.':
    'Не сохранено в шаблон; черновик ждёт на странице «Каталог».',
  '{name}: locked': '{name}: закреплено',
  'boards@@lock': 'плиты',
  'construction@@lock': 'конструкция',
  'Keep the boards and edge bands of this piece as they are':
    'Оставить плиты и кромки этого изделия без изменений',
  'Keep how this piece is built as it is': 'Оставить конструкцию этого изделия без изменений',
  // State (ADR-245)
  'Rename…': 'Переименовать…',
  'Go back to the project to use its edit history':
    'Вернитесь в проект, чтобы пользоваться историей изменений',
  // Data-loss confirms (ADR-246)
  'Change what goes here? The {what} settings of this space are reset.':
    'Изменить содержимое? Настройки «{what}» этого пространства будут сброшены.',
  Change: 'Изменить',
  'Remove the last parts and what is in them?': 'Удалить последние части и их содержимое?',
  'Remove the dividers? Only the first part keeps what is in it.':
    'Удалить перегородки? Содержимое сохранится только у первой части.',
  "Use its group's board again": 'Снова использовать плиту группы',
  "{part}: back to its group's board.": '{part}: снова плита группы.',
} satisfies Record<string, string>;
