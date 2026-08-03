// Экранирование ячейки CSV. Помимо стандартного quoting (запятая/кавычка/
// перенос строки) нейтрализует ведущие =, +, -, @ — иначе Excel/Google
// Sheets/LibreOffice интерпретируют такую ячейку как формулу (formula/CSV
// injection): пользователь мог задать произвольный текст (например,
// milestone.title), который позже открывает уже ДРУГОЙ пользователь при
// экспорте (не тот, кто его вводил) — например фрилансер экспортирует
// счета по заказу и открывает CSV с заголовком этапа, который написал
// заказчик. Ведущий пробел перед формулой ломает формулу для Excel, не
// меняя видимое содержимое ячейки на глаз.
const FORMULA_TRIGGER_CHARS = new Set(['=', '+', '-', '@', '\t', '\r']);

export function escapeCsvCell(value: string): string {
  let safe = value;
  if (FORMULA_TRIGGER_CHARS.has(safe[0])) {
    safe = `'${safe}`;
  }
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}
