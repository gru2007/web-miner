async function initializeTon() {
    const endpoint = await tonAccess.getHttpEndpoint({network: "mainnet"});
    window.client = new tonton.TonClient({ endpoint: endpoint });
}

const wrapAddress = (address) => {
    const addressString = address.toString();
    return `${addressString.slice(0, 6)}...${addressString.slice(-6)}`;
}

const pageLang = document.documentElement.lang === 'en' ? 'en' : 'ru';
const i18n = {
    ru: {
        addressLabel: 'Ваш адрес:',
        title: '$ZKGRM Майнинг',
        description: 'Здесь вы можете протестировать майнинг $ZKGRM',
        placeholderSeed: 'Введите Сид-Фразу',
        buttonConnect: 'Начать Майнинг',
        secureLabel: 'Secure Min2 / Безопасный',
        secureDescription: 'proof привязан к получателю. Mempool copy не может украсть награду.',
        legacyLabel: 'Legacy Mine / Старый',
        legacyDescription: 'Совместим со старым $GRAM-style opcode, но recipient можно заменить фронтраном.',
        chooseGiver: 'Выберите раздатчик токенов',
        random: 'Случайный',
        disconnect: 'Отключиться',
        miningStart: 'Начать Майнинг',
        miningStop: 'Остановить Майнинг',
        alertSeed: 'Введите Сид-Фразу',
        proofText: 'Сид-фраза используется локально в вашем браузере. Она не будет никуда отправлена.',
        proofLink: 'Проверьте исходник на GitHub: <a href="https://github.com/gru2007/web-miner" target="_blank">gru2007/web-miner</a>.',
        logs: 'Логи о процессе майнинга доступны в консоли браузера.',
        needTon: 'Вам нужно хотя бы 0.2 TON на кошельке для начала майнинга.',
    },
    en: {
        addressLabel: 'Your address:',
        title: '$ZKGRM Mining',
        description: 'Test $ZKGRM mining',
        placeholderSeed: 'Enter seed phrase',
        buttonConnect: 'Start Mining',
        secureLabel: 'Secure Min2',
        secureDescription: 'Proof is bound to your reward address. Mempool copy cannot steal it.',
        legacyLabel: 'Legacy Mine',
        legacyDescription: 'Compatible with old $GRAM-style opcode, but recipient can be front-run.',
        chooseGiver: 'Choose token giver',
        random: 'Random',
        disconnect: 'Disconnect',
        miningStart: 'Start Mining',
        miningStop: 'Stop Mining',
        alertSeed: 'Enter seed phrase',
        proofText: 'Seed phrase is used locally in your browser and is not sent anywhere.',
        proofLink: 'See source on GitHub: <a href="https://github.com/gru2007/web-miner" target="_blank">gru2007/web-miner</a>.',
        logs: 'Mining logs are available in your browser console.',
        needTon: 'You need at least 0.2 TON in your wallet to start mining.',
    },
};
const t = i18n[pageLang];

const MINE_OP_LEGACY = 0x4d696e65;
const MINE_OP_SECURE = 0x4d696e32;

const bufferToBigInt = (buffer) => BigInt(`0x${buffer.toString('hex')}`);

const addressCellHash = (address) => bufferToBigInt(
    tonton.beginCell().storeAddress(address).endCell().hash()
);

async function initializeWallet(seedphrase) {
    // Splitting the seedphrase into an array of words
    let seedWords = seedphrase.split(' ');

    // Convert mnemonic to keyPair
    let keyPair = await tonCrypto.mnemonicToPrivateKey(seedWords);

    // Create wallet contract
    let workchain = 0; // Usually you need a workchain 0
    let wallet = tonton.WalletContractV4.create({
        workchain,
        publicKey: keyPair.publicKey,
    });
    window.userWallet = client.open(wallet);
    window.userSender = userWallet.sender(keyPair.secretKey);

    console.log('Wallet address:', userWallet.address.toString());

    // set address to view
    document.getElementById('address').innerHTML = `${t.addressLabel} <a href="https://tonscan.org/address/${userWallet.address.toString()}" 
                target="_blank">${wrapAddress(userWallet.address)}</a>`;

}

async function initializeJettonGiver(jettonGiverAddress) {
    const parsedAddress = tonton.Address.parse(jettonGiverAddress);
    window.jettonGiver = client.open(
        window.JettonGiver.createFromAddress(parsedAddress)
    );
}

const extraSmallGivers = [
    'EQCezJpvSdE6buylaR9P0zkAJeCQtMmPqV0_kcd-4czGn5N8',
    'EQAAbor-CQ7lutMjQo0XUH4f5ICpnNrfpqm3jSKYQrgGMxWa'
]

const isKnownGiver = (address) => extraSmallGivers.includes(address);

const getRandomGiver = () => {
    return extraSmallGivers[Math.floor(Math.random() * extraSmallGivers.length)];
}

const getGiverToMine = () => {
    const value = document.getElementById('extraSmallGivers').value
    if (value === 'random') {
        return getRandomGiver();
    }
    if (isKnownGiver(value)) {
        return value;
    }
    const stored = localStorage.getItem('jettonGiverAddress');
    return isKnownGiver(stored) ? stored : getRandomGiver();
}

const updateGiver = () => {
    if (!localStorage.getItem('cryptoSeedphrase')) {
        return false
    }
    const giver = getGiverToMine();
    localStorage.setItem('jettonGiverAddress', giver);
    console.log('Updated giver:', giver);
    initializeJettonGiver(giver); // Initialize JettonGiver with the new address
}

window.addEventListener('load', async function () {
    await initializeTon();
    updateView();
    let currentSeed = null;
    let currentPowComplexity = null;
    let isMining = false;
    let lastSentSeed = null;

    // Initialize pow parameters and start the update loop
    await updatePowParameters();
    setInterval(updatePowParameters, 5000); // Update parameters every 5 seconds, adjust as needed

    async function updatePowParameters() {
        updateGiver()
        if (!window.jettonGiver) {
            console.log('No JettonGiver found, skipping update.');
            return false;
        }
        if (!localStorage.getItem('jettonGiverAddress')) {
            console.log('No JettonGiver address found, skipping update.');
            return false;
        }
        try {
            const [seed, powComplexity, rewardAmount, targetDelta] = await jettonGiver.getPowParameters();
            currentSeed = seed;
            currentPowComplexity = powComplexity;
            console.log(
                'Updated pow parameters:',
                currentSeed,
                currentPowComplexity,
                'reward:',
                rewardAmount,
                'target delta:',
                targetDelta
            );
        } catch (error) {
            console.error('Error fetching pow parameters:', error);
        }
    }

    function createMineBody({ expire, nonce, seed, recipient, mode }) {
        const isSecure = mode === 'secure';
        const whom = isSecure ? addressCellHash(recipient) : bufferToBigInt(userWallet.address.hash);
        const body = tonton
            .beginCell()
            .storeUint(isSecure ? MINE_OP_SECURE : MINE_OP_LEGACY, 32)
            .storeInt(userWallet.address.workChain * 4, 8)
            .storeUint(expire, 32)
            .storeUint(whom, 256)
            .storeUint(nonce, 256)
            .storeUint(seed, 128)
            .storeUint(nonce, 256);

        if (recipient) {
            body.storeRef(tonton.beginCell().storeAddress(recipient).endCell());
        }

        return body.endCell();
    }

    async function simpleMine(myAddress, recipient, mode) {
        let startMiningTime = Date.now()
        let lastSentLogTime = 0

        let nonce = BigInt(
            '0x' + (await tonCrypto.getSecureRandomBytes(16)).toString('hex')
        );
        const expire = Math.floor(Date.now() / 1000) + 900;

        while (isMining) {
            const cell = createMineBody({
                expire,
                nonce,
                seed: currentSeed,
                recipient: mode === 'secure' ? recipient : null,
                mode,
            });
            const hash = cell.hash();
            const hashNumber = BigInt(`0x${hash.toString('hex')}`);
            const randomNumber = Math.floor(Math.random() * 700) + 300;
            if (Date.now() - lastSentLogTime > randomNumber) {
                lastSentLogTime = Date.now()
                console.log('Mining... Time left:', ((Date.now() - startMiningTime) / 1000).toFixed(2), 's', hashNumber)

            }
            if (hashNumber < currentPowComplexity) {
                console.log(
                    'Mining successful!',
                    hashNumber,
                    currentPowComplexity
                );
                console.log(
                    nonce,
                    expire,
                    userWallet.address.toString(),
                    currentSeed.toString(),
                    currentPowComplexity.toString(),
                    cell.toString()
                );
                return { expire, nonce, seed: currentSeed };
            }
            nonce++;

            // Optional: Insert a short delay or perform other tasks
            await new Promise((resolve) => setTimeout(resolve, 0)); // Non-blocking delay
        }

        // If mining stopped, return null
        return null;
    }

    // Function to update the view based on connection status
    function updateView() {
        var storedSeedphrase = localStorage.getItem('cryptoSeedphrase');
        var storedJettonGiverAddress =
            localStorage.getItem('jettonGiverAddress');
        if (storedSeedphrase && storedJettonGiverAddress) {
            if (!isKnownGiver(storedJettonGiverAddress)) {
                storedJettonGiverAddress = getRandomGiver();
                localStorage.setItem('jettonGiverAddress', storedJettonGiverAddress);
            }
            initializeWallet(storedSeedphrase);
            initializeJettonGiver(storedJettonGiverAddress); // Initialize JettonGiver with stored address


            document.getElementById('content').innerHTML = `
                <p id="address">${t.addressLabel} ...</p>
                <p class="small"><b>${t.secureLabel}:</b> ${t.secureDescription}</p>
                <p class="small"><b>${t.legacyLabel}:</b> ${t.legacyDescription}</p>
                <select id="miningMode">
                    <option value="secure" selected>${t.secureLabel}</option>
                    <option value="legacy">${t.legacyLabel}</option>
                </select>
                <select id="extraSmallGivers"></select>
                <!--input type="text" id="jettonGiverAddress" value="${storedJettonGiverAddress}"-->
                <button id="miningButton">${t.miningStart}</button>
                <button id="disconnectButton">${t.disconnect}</button>
                <p class="small">${t.proofLink}</p>
                <p class="small">${t.logs}</p>
            `;
            const select = document.getElementById('extraSmallGivers');
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.disabled = true;
            defaultOption.text = 'Выберите раздатчик токенов';
            select.appendChild(defaultOption);
            // add option random giver
            const optionRandom = document.createElement('option');
            optionRandom.value = 'random';
            optionRandom.text = 'Случайный';
            select.appendChild(optionRandom);
            extraSmallGivers.forEach((address) => {
                const option = document.createElement('option');
                option.value = address;
                option.text = address;
                option.selected = address === storedJettonGiverAddress;
                select.appendChild(option);
            });
            // change giver when select
            select.addEventListener('change', updateGiver);
            document
                .getElementById('disconnectButton')
                .addEventListener('click', function () {
                    localStorage.removeItem('cryptoSeedphrase');
                    stopMining(); // Stop mining when disconnecting
                    updateView();
                });

            document
                .getElementById('miningButton')
                .addEventListener('click', function () {
                    updateGiver()
                    isMining = !isMining;
                    updateMiningButton();
                    if (isMining) {
                        startMining();
                    } else {
                        stopMining();
                    }
                });


            // document.getElementById('jettonGiverAddress').addEventListener('change', function () {
            //     var jettonGiverAddress = document.getElementById('jettonGiverAddress').value;
            //     if (jettonGiverAddress) {
            //         localStorage.setItem('jettonGiverAddress', jettonGiverAddress);
            //         initializeJettonGiver(jettonGiverAddress); // Initialize JettonGiver with the new address
            //         updateView();
            //     } else {
            //         alert('Please enter a JettonGiver address');
            //     }
            // })
        } else {
            document.getElementById('content').innerHTML = `
                <input type="text" id="seedphrase" placeholder="${t.placeholderSeed}">
                <!--input type="text" id="jettonGiverAddress" placeholder="Enter JettonGiver Address"-->
                <button id="connectButton">${t.buttonConnect}</button>
            `;
            document
                .getElementById('connectButton')
                .addEventListener('click', function () {
                    var seedphrase =
                        document.getElementById('seedphrase').value;
                    // var jettonGiverAddress =
                    //     document.getElementById('jettonGiverAddress').value;
                    if (seedphrase/* && jettonGiverAddress*/) {
                        const jettonGiverAddress = getRandomGiver();
                        localStorage.setItem('cryptoSeedphrase', seedphrase);
                        localStorage.setItem(
                            'jettonGiverAddress',
                          jettonGiverAddress
                        );
                        initializeJettonGiver(jettonGiverAddress); // Initialize JettonGiver with the new address
                        updateView();
                        // miningButton click
                        updateGiver()
                        document.getElementById('miningButton').click();
                    } else {
                        alert(
                            t.alertSeed
                        );
                    }
                });
        }
    }

    function updateMiningButton() {
        var miningButton = document.getElementById('miningButton');
        miningButton.textContent = isMining ? t.miningStop : t.miningStart;
    }

    async function startMining() {
        console.log('Mining started...');

        updateGiver()

        while (isMining) {
            if (lastSentSeed === currentSeed) {
                console.log('Mining unsuccessful, trying again...');
                await new Promise((resolve) => setTimeout(resolve, 1000)); // Delay to prevent blocking
                continue;
            }

            const mode = document.getElementById('miningMode')?.value || 'secure';
            const result = await simpleMine(userWallet.address, userWallet.address, mode);
            if (result) {
                const { expire, nonce, seed } = result;
                const cell = createMineBody({ expire, nonce, seed, recipient: userWallet.address, mode });
                console.log(`Mining successful: Nonce - ${nonce}`, cell);
                try {
                    await jettonGiver.sendMine(
                        userSender,
                        tonton.toNano('0.19'),
                        cell
                    );
                    lastSentSeed = currentSeed;
                    console.log('Sent!');
                } catch (error) {
                    console.error('Error sending mined data:', error);
                }
            } else {
                console.log('Mining unsuccessful, trying again...');
            }

            await new Promise((resolve) => setTimeout(resolve, 1000)); // Delay to prevent blocking
        }
        console.log('Mining stopped.');
    }

    function stopMining() {
        console.log('Mining stopped.');
    }
});
