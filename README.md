# AXIOM Distribution

Pre-built binaries for the AXIOM network.

> **Current release: `core-d3f9641a-20260827` (devnet).** These builds join the
> AXIOM **development network** — artifacts are labeled `-devnet` and are not
> mainnet binaries. Mainnet releases will follow the key ceremony.

## Quick Install

One line — downloads the updater, installs a Nabla node, and starts it:

```bash
curl -sL https://raw.githubusercontent.com/AXIOM-Origin-Validator/axiom-dist/main/update.sh | bash -s -- nabla
```

Or step by step:

```bash
# Download the updater
curl -sL https://raw.githubusercontent.com/AXIOM-Origin-Validator/axiom-dist/main/update.sh -o update.sh
chmod +x update.sh

# Install Nabla node (lightweight, citizen infrastructure)
./update.sh nabla

# OR install full validator (Lambda + ANTIE + Nabla + Console)
./update.sh validator
```

## Uninstall

One line — stops services, removes binaries, **keeps your node identity**
(keys + data) so a reinstall resumes the same node:

```bash
curl -sL https://raw.githubusercontent.com/AXIOM-Origin-Validator/axiom-dist/main/uninstall.sh | bash
```

To also delete keys and data (irreversible — the node identity is finished):

```bash
curl -sL https://raw.githubusercontent.com/AXIOM-Origin-Validator/axiom-dist/main/uninstall.sh | bash -s -- --purge
```

Removing a node never harms the mesh: your node's state is a replica and the
network routes around departed nodes automatically.

## Backup & Restore / Migration

**Backup** (one line — writes `./axiom-backup-<host>-<stamp>.tar.gz`; keys +
config + state, hot-safe; add `-s -- --cold` for a stop-snapshot-restart):

```bash
curl -sL https://raw.githubusercontent.com/AXIOM-Origin-Validator/axiom-dist/main/backup.sh | bash
```

**Restore / migrate to another machine:**

```bash
curl -sL https://raw.githubusercontent.com/AXIOM-Origin-Validator/axiom-dist/main/restore.sh | bash -s -- axiom-backup-<host>-<stamp>.tar.gz
```

> ⚠ **One identity, one machine.** Never run the same node identity in two
> places at once. Migration order: uninstall (or stop) on the old machine →
> install binaries on the new one → restore the backup there. The node
> resyncs any missing state from the mesh automatically; the tarball is your
> identity — store it like a private key.

## Update

Same command — always gets the latest build:

```bash
./update.sh
```

## Requirements for a serving node

- **`node.toml` with `external_port` is required** — the node refuses to start
  without it. Set it to a TCP port that your router actually forwards to the
  machine.
- **Port-forward that TCP port** (inbound) on your router. Without a working
  inbound path, peers observe your address as unreachable and your node runs
  **read-only** (it follows the mesh and serves local queries, but takes no
  registrations). That is by design — see the §5.6a peer-observed addressing
  rules.
- 64-bit platform, outbound TCP allowed.

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
- Nabla builds are pinned to the network's current CoreID (in the artifact
  name) and carry the blessed prior accept-set — an out-of-date node keeps
  verifying history across rotations until it updates
