export interface FraudFlagPayload {
  eventName: string;
  userId?: string;
  orderId?: string;
  riskScore: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reasons: string[];
}

export function severityFromScore(score: number): FraudFlagPayload['severity'] {
  if (score >= 85) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
}

/**
 * Репортит результат скоринга в основной апи (POST /internal/fraud/flags).
 * Раньше fraud-service писал только в свою изолированную БД, которую
 * никто не читал — теперь это единственный способ вывода. Best-effort:
 * если апи недоступен, флаг теряется (не блокирует обработку очереди
 * событий), но логируется явной ошибкой — это тот же trade-off, что уже
 * принят в EventBusService.publish() для очереди наружу.
 */
export async function reportFlag(payload: FraudFlagPayload | null): Promise<void> {
  if (!payload || payload.riskScore <= 0) return; // нулевой/отсутствующий риск — нечего репортить

  const apiUrl = process.env.API_INTERNAL_URL;
  const secret = process.env.FRAUD_INTERNAL_SECRET;
  if (!apiUrl || !secret) {
    console.error('[FRAUD_REPORT] API_INTERNAL_URL/FRAUD_INTERNAL_SECRET not configured, dropping flag', JSON.stringify(payload));
    return;
  }

  try {
    const res = await fetch(`${apiUrl}/internal/fraud/flags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': secret },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('[FRAUD_REPORT] api rejected flag', res.status, await res.text());
    } else {
      console.log('[FRAUD_REPORT] flag sent', JSON.stringify({ eventName: payload.eventName, riskScore: payload.riskScore, severity: payload.severity }));
    }
  } catch (err) {
    console.error('[FRAUD_REPORT] failed to reach api', (err as Error).message);
  }
}
