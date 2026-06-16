# ZKGRM Web Miner

Browser CPU proof-of-work miner for ZKGRM giver contracts.

## Proof Of Concept Notice

This repository is a Proof of Concept. It may contain bugs, browser compatibility issues, wallet UX problems, or mining inefficiencies. Contributions are welcome for the benefit of the whole community.

## Features

- Mainnet/testnet selector.
- TonConnect wallet mode, recommended for safety.
- Legacy seed phrase mode, kept for local/offline experiments.
- Dynamic ZKGRM giver list entered in the UI.
- GRM-compatible `get_pow_params`: `(seed, pow_complexity, amount, target_delta)`.

## Run Locally

Use a local web server. TonConnect requires a real origin and a manifest URL.

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## TonConnect Manifest

The demo manifest is `tonconnect-manifest.json`. For production, host the app and replace the manifest URL/icon with your real domain.

## Safety

- Prefer TonConnect.
- Do not enter a valuable wallet seed phrase in legacy mode.
- Use a dedicated wallet with limited TON.
- Browser mining is slow compared to native CPU/GPU miners.

## Russian Docs

See [INSTRUCTIONS_RU.md](INSTRUCTIONS_RU.md).
