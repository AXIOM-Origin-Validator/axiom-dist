# AXIOM Distribution

Pre-built binaries for the AXIOM network.

## Quick Install

```bash
# Download the updater
curl -sL https://raw.githubusercontent.com/AXIOM-Origin-Validator/axiom-dist/main/update.sh -o update.sh
chmod +x update.sh

# Install Nabla node (lightweight, citizen infrastructure)
./update.sh nabla

# OR install full validator (Lambda + ANTIE + Nabla + Console)
./update.sh validator
```

## Update

Same command — always gets the latest build:

```bash
./update.sh
```

## Platforms

| Platform | Architecture | Validator | Nabla |
|----------|-------------|-----------|-------|
| Linux    | x86_64      | Yes       | Yes   |
| Linux    | aarch64 (Pi)| Yes       | Yes   |
| macOS    | Apple Silicon| Yes       | Yes   |
| Windows  | x86_64      | —         | Yes   |

## What's in each package

**Validator** — full node operator package:
- `lambda` — consensus engine
- `antie` — email gateway
- `nabla-node` — citizen infrastructure node
- `axiom-console` — operator monitoring dashboard
- `nabla-ceremony` — NBC provisioning tool
- `validator-setup` — key generation
- zkVM artifacts (DMAP ELF + image ID)

**Nabla** — lightweight citizen node:
- `nabla-node` — citizen infrastructure node
- `nabla-ceremony` — NBC provisioning tool

## Notes

- 64-bit platforms only (Y2038 safety requirement)
- Config files are never overwritten during updates
- The updater auto-detects your platform and installation type
- Use `./update.sh --check` to preview without installing
