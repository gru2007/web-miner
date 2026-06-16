# Инструкция ZKGRM Web Miner

Web miner обновлён под ZKGRM и MainNet.

## Proof of Concept

Это Proof of Concept. В web miner могут быть ошибки, browser compatibility issues и UX/security недоработки. Я буду рад принять ваши исправления во благо всего коммьюнити.

## Как пользоваться

1. Откройте `index.html` через локальный web server.
2. Выберите `mainnet` или `testnet`.
3. Рекомендуемый режим - TonConnect. Legacy seed режим оставлен только для локальных экспериментов.
4. Введите список ZKGRM givers через запятую:

```text
EQ_GIVER_1,EQ_GIVER_2,EQ_GIVER_3
```

5. Нажмите `Start mining`.

## Что важно

- TonConnect безопаснее, потому что seed phrase не попадает на страницу.
- Legacy seed phrase хранится в `localStorage` браузера и используется локально. Не используйте основной кошелёк.
- Майнер работает на CPU в браузере, поэтому он медленнее native CPU/GPU miners.
- `get_pow_params` читается в формате `(seed, pow_complexity, amount, target_delta)`.
- В web miner награда отправляется на тот же кошелёк, который подписывает transaction.

## Givers

Используйте только новые ZKGRM Miner contract addresses. Старые GRM givers не подходят.

Для высокой нагрузки добавляйте несколько givers: браузер выбирает случайный giver из списка.
