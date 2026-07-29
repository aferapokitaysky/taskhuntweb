/**
 * Веса скоринга вынесены отдельно от логики намеренно: это не обученная
 * модель (нет ни размеченных данных, ни истории исходов, чтобы её обучить),
 * а прозрачный детерминированный скоринг — многофакторный, но объяснимый
 * (см. `reasons` в возвращаемых из MatchingService объектах). Когда
 * накопится история реальных исходов (принят бид / не принят, отклик ->
 * оплата), эти константы — первое, что заменяется на веса из модели, сама
 * форма API (score + reasons) для этого уже готова.
 *
 * Все *_MAX_POINTS — верхняя граница вклада фактора в итоговый score по
 * шкале ~0-100. PROMOTION_BOOST_MAX сознательно ограничен небольшой долей
 * от максимума — платное продвижение должно поднимать в выдаче, но не
 * должно полностью забивать релевантность органическим позициям
 * (иначе продвижение убивает доверие к ленте, а доверие — то, на чём
 * держится маркетплейс).
 */

export const FEED_WEIGHTS = {
  base: 45,
  recencyMaxPoints: 20,
  recencyHalfLifeHours: 72,
  urgencyMaxPoints: 10,
  urgencyWindowHours: 72,
  promotionBoostMax: 20,
  definedBudgetMaxPoints: 5,
};

export const FREELANCER_DIRECTORY_WEIGHTS = {
  base: 25,
  categoryAffinityMaxPoints: 30, // заполняется только когда есть контекст конкретного заказа
  ratingMaxPoints: 20,
  completionRateMaxPoints: 10,
  responseTimeMaxPoints: 10,
  disputePenaltyPerIncident: 6,
  disputePenaltyMax: 30,
  lateDeliveryPenaltyPerIncident: 3,
  lateDeliveryPenaltyMax: 15,
  subscriptionBoost: { PREMIUM: 15, PRO: 7, STARTER: 0 } as Record<string, number>,
  responseTimeFullCreditMinutes: 15,
  responseTimeZeroCreditMinutes: 24 * 60,
};

export const ORDER_RECOMMEND_WEIGHTS = {
  base: 20,
  categoryAffinityMaxPoints: 40,
  rateFitMaxPoints: 15,
  recencyMaxPoints: 15,
  urgencyMaxPoints: 10,
};
