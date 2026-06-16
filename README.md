# web-miner

based on $GRAM miner

## Mining modes

EN: `Secure Min2` is the default mode. The proof is hashed together with the reward recipient, so copying the transaction body from the mempool cannot redirect the reward.

RU: `Secure Min2` используется по умолчанию. Proof хешируется вместе с адресом получателя, поэтому копирование body из mempool не позволяет украсть награду.

EN: `Legacy Mine` is kept only for old giver contracts. It is compatible with the old `$GRAM`-style opcode, but the recipient is not protected and a front-runner can replace it.

RU: `Legacy Mine` оставлен только для старых контрактов-раздатчиков. Он совместим со старым `$GRAM` opcode, но recipient не защищён и фронтранер может заменить получателя.

## How to use

EN: Use a testnet wallet seed phrase only. The seed phrase stays in the browser, but do not paste a mainnet wallet seed into a miner page.

RU: Используйте только testnet seed phrase. Фраза остаётся в браузере, но нельзя вставлять mainnet seed phrase на страницу майнера.

EN: Browser mining is CPU-only and is intended for small/easy givers. GPU miners will outperform browsers on hard givers.

RU: Браузерный майнинг работает на CPU и подходит для маленьких/лёгких givers. На сложных givers видеокарты будут быстрее.

EN: GPU/CLI miners must build exactly the same body as the selected mode: `Min2` for secure mode, `Mine` for legacy mode.

RU: GPU/CLI майнеры должны собирать точно такой же body, как выбранный режим: `Min2` для безопасного режима, `Mine` для legacy.
