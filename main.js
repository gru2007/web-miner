const DEFAULT_GAS = '0.22';

let selectedNetwork = localStorage.getItem('network') || 'mainnet';
let authMode = localStorage.getItem('authMode') || 'tonconnect';
let currentSeed = null;
let currentPowComplexity = null;
let currentAmount = null;
let currentTargetDelta = null;
let isMining = false;
let lastSentSeed = null;
let tonConnectUI = null;

function bytesToBase64(bytes) {
    let binary = '';
    bytes.forEach((byte) => binary += String.fromCharCode(byte));
    return btoa(binary);
}

async function initializeTon() {
    selectedNetwork = document.getElementById('networkSelect')?.value || selectedNetwork;
    localStorage.setItem('network', selectedNetwork);
    const endpoint = await tonAccess.getHttpEndpoint({ network: selectedNetwork });
    window.client = new tonton.TonClient({ endpoint });
}

function explorerAddress(address) {
    const host = selectedNetwork === 'testnet' ? 'testnet.tonscan.org' : 'tonscan.org';
    return `https://${host}/address/${address.toString()}`;
}

const wrapAddress = (address) => {
    const addressString = address.toString({ bounceable: false, urlSafe: true });
    return `${addressString.slice(0, 8)}...${addressString.slice(-8)}`;
}

function getConfiguredGivers() {
    return (localStorage.getItem('zkgrmGivers') || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function getRandomGiver() {
    const givers = getConfiguredGivers();
    if (givers.length === 0) {
        throw new Error('Add ZKGRM giver addresses first');
    }
    return givers[Math.floor(Math.random() * givers.length)];
}

function getGiverToMine() {
    const value = document.getElementById('giverSelect')?.value || 'random';
    return value === 'random' ? getRandomGiver() : value;
}

async function initializeJettonGiver(jettonGiverAddress) {
    const parsedAddress = tonton.Address.parse(jettonGiverAddress);
    window.jettonGiver = client.open(window.JettonGiver.createFromAddress(parsedAddress));
}

async function initializeLegacyWallet(seedphrase) {
    const seedWords = seedphrase.trim().split(/\s+/);
    const keyPair = await tonCrypto.mnemonicToPrivateKey(seedWords);
    const wallet = tonton.WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
    window.userWallet = client.open(wallet);
    window.userSender = userWallet.sender(keyPair.secretKey);
    setStatus(`Legacy wallet: ${wallet.address.toString({ bounceable: false })}`);
    renderAddress(wallet.address);
}

function getTonConnectManifestUrl() {
    const configured = localStorage.getItem('tonconnectManifestUrl');
    if (configured) return configured;
    const origin = window.location.origin === 'null' ? 'https://example.com' : window.location.origin;
    return `${origin}/tonconnect-manifest.json`;
}

async function initializeTonConnect() {
    if (!window.TON_CONNECT_UI?.TonConnectUI) {
        setStatus('TonConnect SDK is not loaded. Use HTTPS/local server and check index.html CDN script.');
        return;
    }
    if (!tonConnectUI) {
        tonConnectUI = new window.TON_CONNECT_UI.TonConnectUI({
            manifestUrl: getTonConnectManifestUrl(),
            buttonRootId: 'tonConnectButton',
        });
        tonConnectUI.onStatusChange((wallet) => {
            if (wallet?.account?.address) {
                renderAddress(tonton.Address.parse(wallet.account.address));
                setStatus('TonConnect wallet connected.');
            } else {
                setStatus('TonConnect wallet disconnected.');
            }
        });
    }
}

function getActiveAddress() {
    if (authMode === 'legacy' && window.userWallet) {
        return window.userWallet.address;
    }
    const account = tonConnectUI?.wallet?.account;
    if (authMode === 'tonconnect' && account?.address) {
        return tonton.Address.parse(account.address);
    }
    return null;
}

function renderAddress(address) {
    const container = document.getElementById('address');
    if (!container || !address) return;
    container.innerHTML = `Address: <a href="${explorerAddress(address)}" target="_blank" rel="noreferrer">${wrapAddress(address)}</a>`;
}

function setStatus(message) {
    const node = document.getElementById('status');
    if (node) node.textContent = message;
    console.log(message);
}

function renderGiverSelect() {
    const select = document.getElementById('giverSelect');
    if (!select) return;
    select.innerHTML = '';
    const randomOption = document.createElement('option');
    randomOption.value = 'random';
    randomOption.text = 'Random giver';
    select.appendChild(randomOption);
    getConfiguredGivers().forEach((address) => {
        const option = document.createElement('option');
        option.value = address;
        option.text = address;
        select.appendChild(option);
    });
}

async function updateGiver() {
    try {
        const giver = getGiverToMine();
        localStorage.setItem('jettonGiverAddress', giver);
        await initializeJettonGiver(giver);
        return true;
    } catch (error) {
        setStatus(error.message);
        return false;
    }
}

async function updatePowParameters() {
    if (!await updateGiver()) return;
    if (!window.jettonGiver) return;
    try {
        const [seed, powComplexity, amount, targetDelta] = await jettonGiver.getPowParameters();
        currentSeed = seed;
        currentPowComplexity = powComplexity;
        currentAmount = amount;
        currentTargetDelta = targetDelta;
        document.getElementById('powInfo').textContent = `seed ${seed.toString(16).slice(0, 8)}... | amount ${amount.toString()} | target ${targetDelta.toString()}s`;
    } catch (error) {
        setStatus(`Failed to fetch get_pow_params: ${error.message || error}`);
    }
}

async function simpleMine(myAddress) {
    const startMiningTime = Date.now();
    let lastLogTime = 0;
    let nonce = BigInt('0x' + (await tonCrypto.getSecureRandomBytes(16)).toString('hex'));
    const expire = Math.floor(Date.now() / 1000) + 900;
    const prefix = tonton.beginCell()
        .storeUint(0x4d696e65, 32)
        .storeInt(myAddress.workChain * 4, 8)
        .storeUint(expire, 32)
        .storeBuffer(myAddress.hash);

    while (isMining) {
        const cell = tonton.beginCell()
            .storeBuilder(prefix)
            .storeUint(nonce, 256)
            .storeUint(currentSeed, 128)
            .storeUint(nonce, 256)
            .endCell();
        const hashNumber = BigInt(`0x${cell.hash().toString('hex')}`);
        if (Date.now() - lastLogTime > 750) {
            lastLogTime = Date.now();
            setStatus(`Mining ${((Date.now() - startMiningTime) / 1000).toFixed(1)}s | hash ${hashNumber.toString(16).slice(0, 8)}...`);
        }
        if (hashNumber < currentPowComplexity) {
            return cell;
        }
        nonce++;
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return null;
}

async function sendMine(body) {
    const giverAddress = localStorage.getItem('jettonGiverAddress');
    if (authMode === 'legacy') {
        await jettonGiver.sendMine(userSender, tonton.toNano(DEFAULT_GAS), body);
        return;
    }
    const payload = bytesToBase64(body.toBoc());
    await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        network: selectedNetwork === 'testnet' ? '-3' : '-239',
        messages: [{
            address: giverAddress,
            amount: tonton.toNano(DEFAULT_GAS).toString(),
            payload,
        }],
    });
}

async function startMining() {
    const address = getActiveAddress();
    if (!address) {
        setStatus(authMode === 'tonconnect' ? 'Connect wallet with TonConnect first.' : 'Unlock legacy wallet first.');
        isMining = false;
        renderMiningButton();
        return;
    }
    setStatus('Mining started. Keep this tab open.');
    while (isMining) {
        if (!currentSeed || !currentPowComplexity) await updatePowParameters();
        if (lastSentSeed === currentSeed) {
            await updatePowParameters();
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
        }
        const body = await simpleMine(address);
        if (!body) continue;
        try {
            await sendMine(body);
            lastSentSeed = currentSeed;
            setStatus('Proof sent. Waiting for next seed.');
            await updatePowParameters();
        } catch (error) {
            setStatus(`Send failed: ${error.message || error}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
}

function stopMining() {
    isMining = false;
    renderMiningButton();
    setStatus('Mining stopped.');
}

function renderMiningButton() {
    const button = document.getElementById('miningButton');
    if (button) button.textContent = isMining ? 'Stop mining' : 'Start mining';
}

function renderApp() {
    authMode = localStorage.getItem('authMode') || authMode;
    selectedNetwork = localStorage.getItem('network') || selectedNetwork;
    document.getElementById('content').innerHTML = `
        <div class="panel-grid">
            <section class="card controls-card">
                <label>Network</label>
                <select id="networkSelect">
                    <option value="mainnet" ${selectedNetwork === 'mainnet' ? 'selected' : ''}>Mainnet</option>
                    <option value="testnet" ${selectedNetwork === 'testnet' ? 'selected' : ''}>Testnet</option>
                </select>

                <label>Wallet mode</label>
                <div class="segmented">
                    <button id="tonConnectMode" class="${authMode === 'tonconnect' ? 'active' : ''}">TonConnect</button>
                    <button id="legacyMode" class="${authMode === 'legacy' ? 'active' : ''}">Legacy seed</button>
                </div>

                <div id="tonConnectPane" class="mode-pane ${authMode === 'tonconnect' ? '' : 'hidden'}">
                    <p class="hint">Recommended. Your seed phrase never touches this page.</p>
                    <input id="manifestInput" placeholder="TonConnect manifest URL" value="${localStorage.getItem('tonconnectManifestUrl') || ''}">
                    <button id="saveManifestButton" class="secondary">Save manifest URL</button>
                    <div id="tonConnectButton"></div>
                </div>

                <div id="legacyPane" class="mode-pane ${authMode === 'legacy' ? '' : 'hidden'}">
                    <p class="warning">Legacy mode stores the mnemonic in localStorage. Use only on a trusted offline machine.</p>
                    <input type="password" id="seedphrase" placeholder="24-word seed phrase">
                    <button id="unlockLegacyButton">Unlock legacy wallet</button>
                    <button id="clearLegacyButton" class="secondary">Clear stored seed</button>
                </div>
            </section>

            <section class="card mining-card">
                <p id="address" class="address-line">Address: not connected</p>
                <label>ZKGRM givers</label>
                <textarea id="giversInput" rows="4" placeholder="EQ...,EQ...">${localStorage.getItem('zkgrmGivers') || ''}</textarea>
                <button id="saveGiversButton" class="secondary">Save givers</button>
                <label>Giver</label>
                <select id="giverSelect"></select>
                <p id="powInfo" class="pow-info">PoW params: not loaded</p>
                <button id="refreshButton" class="secondary">Refresh PoW params</button>
                <button id="miningButton">Start mining</button>
                <p id="status" class="status-line">Ready.</p>
            </section>
        </div>
    `;
    bindEvents();
    renderGiverSelect();
    renderMiningButton();
    initializeTonConnect();
    const storedSeed = localStorage.getItem('cryptoSeedphrase');
    if (authMode === 'legacy' && storedSeed) initializeLegacyWallet(storedSeed);
}

function bindEvents() {
    document.getElementById('networkSelect').addEventListener('change', async (event) => {
        selectedNetwork = event.target.value;
        await initializeTon();
        await updatePowParameters();
    });
    document.getElementById('tonConnectMode').addEventListener('click', () => {
        localStorage.setItem('authMode', 'tonconnect');
        renderApp();
    });
    document.getElementById('legacyMode').addEventListener('click', () => {
        localStorage.setItem('authMode', 'legacy');
        renderApp();
    });
    document.getElementById('saveManifestButton').addEventListener('click', () => {
        localStorage.setItem('tonconnectManifestUrl', document.getElementById('manifestInput').value.trim());
        tonConnectUI = null;
        initializeTonConnect();
    });
    document.getElementById('unlockLegacyButton').addEventListener('click', async () => {
        const seedphrase = document.getElementById('seedphrase').value.trim();
        if (!seedphrase) return setStatus('Enter seed phrase first.');
        localStorage.setItem('cryptoSeedphrase', seedphrase);
        await initializeLegacyWallet(seedphrase);
    });
    document.getElementById('clearLegacyButton').addEventListener('click', () => {
        localStorage.removeItem('cryptoSeedphrase');
        window.userWallet = null;
        window.userSender = null;
        setStatus('Legacy seed cleared.');
    });
    document.getElementById('saveGiversButton').addEventListener('click', async () => {
        localStorage.setItem('zkgrmGivers', document.getElementById('giversInput').value.trim());
        renderGiverSelect();
        await updatePowParameters();
    });
    document.getElementById('giverSelect').addEventListener('change', updatePowParameters);
    document.getElementById('refreshButton').addEventListener('click', updatePowParameters);
    document.getElementById('miningButton').addEventListener('click', () => {
        isMining = !isMining;
        renderMiningButton();
        if (isMining) startMining(); else stopMining();
    });
}

window.addEventListener('load', async function () {
    await initializeTon();
    renderApp();
    await updatePowParameters();
    setInterval(updatePowParameters, 5000);
});
