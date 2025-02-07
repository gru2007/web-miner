const core_1 = window.tonCore;
const crypto_1 = window.tonCrypto;
window.JettonGiver = class JettonGiver {
    constructor(address, init) {
        this.address = address;
        this.init = init;
    }
    static createFromAddress(address) {
        return new JettonGiver(address);
    }
    async sendMine(provider, via, value, message) {
        await provider.internal(via, {
            value,
            sendMode: core_1.SendMode.PAY_GAS_SEPARATELY,
            body: message,
        });
    }
    async sendRescale(provider, expire) {
        await provider.external((0, core_1.beginCell)().storeUint(0x5253636c, 32).storeUint(expire, 32).endCell());
    }
    async sendMessages(provider, seqno, secretKey, messages) {
        let signingMessage = (0, core_1.beginCell)().storeUint(seqno, 32);
        while (messages.length > 0) {
            const msg = messages.shift();
            signingMessage.storeUint(msg.sendMode, 8);
            signingMessage.storeRef((0, core_1.beginCell)().store((0, core_1.storeMessageRelaxed)(msg.message)));
        }
        let signature = (0, crypto_1.sign)(signingMessage.endCell().hash(), secretKey);
        await provider.external((0, core_1.beginCell)().storeBuffer(signature).storeBuilder(signingMessage).endCell());
    }
    async getPowParameters(provider) {
        let stack = (await provider.get('get_pow_params', [])).stack;
        return [stack.readBigNumber(), stack.readBigNumber(), stack.readBigNumber(), stack.readBigNumber()];
    }
}