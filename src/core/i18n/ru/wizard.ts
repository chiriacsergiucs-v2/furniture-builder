/** Russian text for the New-piece wizard engine and step summaries (ADR-153). Key: the English text. */
export const ru_wizard = {
  // Step summaries (suggestion cards and Review)
  '{w} × {h} × {d} mm': '{w} × {h} × {d} мм',
  open: 'открыто',
  'hanging rail': 'штанга для одежды',
  '{n|# drawer|# drawers}': '{n|# ящик|# ящика|# ящиков}',
  '{n|# shelf|# shelves}': '{n|# полка|# полки|# полок}',
  '{s|# shelf|# shelves} over {d|# drawer|# drawers}':
    '{s|# полка|# полки|# полок} над {d|# ящиком|# ящиками|# ящиками}',
  '{text} each': '{text} в каждой секции',
  '{n|# divider|# dividers}': '{n|# перегородка|# перегородки|# перегородок}',
  'no dividers': 'без перегородок',
  '{text} (custom widths)': '{text} (своя ширина)',
  'no doors': 'без дверец',
  'one door': 'одна дверца',
  'pair of doors': 'пара дверец',
  'sliding doors': 'раздвижные дверцы',
  'doors on {n|# compartment|# compartments}': 'дверцы на {n|# секции|# секциях|# секциях}',
  'on a plinth': 'на цоколе',
  'no plinth': 'без цоколя',
  'wall-hung': 'навесной',
  'back panel': 'задняя стенка',
  'set-in back': 'вставная задняя стенка',
  'open back': 'без задней стенки',
  'slatted top': 'крышка из ламелей',
  'panel top': 'крышка из панели',
  'box stretchers': 'проножки по периметру',
  'H stretchers': 'H-образные проножки',
  'lower shelf': 'нижняя полка',
  '{n} mm legs': 'ножки {n} мм',
  'pedestal left': 'тумба слева',
  'pedestal right': 'тумба справа',
  'two pedestals': 'две тумбы',
  '{ped}, {n|# drawer|# drawers} each': '{ped}, по {n|# ящику|# ящика|# ящиков} в каждой',
  'two gables': 'две боковые панели',
  'modesty panel': 'передняя панель',
  '{w} × {l} mattress': 'матрас {w} × {l}',
  'slats at {n} mm': 'ламели на {n} мм',
  'footboard {n} mm': 'изножье {n} мм',
  'low foot': 'низкое изножье',

  // Answer problems
  ' mm': ' мм',
  '{label}: give a name (up to 200 characters).': '{label}: укажите название (до 200 символов).',
  '{label} must be a whole number from {min} to {max}{unit}.':
    '{label}: должно быть целое число от {min} до {max}{unit}.',
  'Choose a construction type.': 'Выберите тип конструкции.',
  '{label}: choose one of the options.': '{label}: выберите один из вариантов.',
  '{label}: whole numbers from {min} to {max}{unit}.':
    '{label}: целые числа от {min} до {max}{unit}.',
  'Compartment {n}: choose what it holds.': 'Секция {n}: выберите наполнение.',
  'Compartment {n}: shelves must be a whole number from 0 to {max}.':
    'Секция {n}: число полок должно быть целым от 0 до {max}.',
  'Compartment {n}: drawers must be a whole number from 1 to 10.':
    'Секция {n}: число ящиков должно быть целым от 1 до 10.',
  'These answers cannot be built ({reason}).':
    'По этим ответам нельзя построить изделие ({reason}).',
  'unknown problem': 'неизвестная проблема',
} satisfies Record<string, string>;
