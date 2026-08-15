#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
#  AXIOM Nabla citizen-node installer — 64-bit ARM (Raspberry Pi 4/5, arm64)
#
#    curl -fsSL https://raw.githubusercontent.com/AXIOM-Origin-Validator/axiom-dist/main/install-nabla.sh | bash
#
#  Installs the pinned nabla-node (CoreID 9f8015fd), the matching Core ELF and
#  the live mesh seed list, then runs the node in the FOREGROUND so you can
#  watch it obtain its NBC, arm, and attach to TARDIS. Daemonize afterwards
#  with the printed `systemctl` command.
#
#  Prompts for the mesh TCP port (default 6225). Preset AXIOM_PORT to skip the
#  prompt (non-interactive installs).
#
#  Overridable via env:
#    AXIOM_NODE_NAME   node name in the mesh   (default nabla-pi-<hostname>)
#    AXIOM_ADVERTISE   host:port peers dial you back on (default: public IP:PORT)
#    AXIOM_PORT        mesh TCP port           (default 6225; prompted if unset)
#    AXIOM_DATA_DIR    data dir                (default ~/.axiom)
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

REPO="AXIOM-Origin-Validator/axiom-dist"
DATA_DIR="${AXIOM_DATA_DIR:-$HOME/.axiom}"
NODE_NAME="${AXIOM_NODE_NAME:-nabla-pi-$(hostname -s 2>/dev/null || echo node)}"
PORT="${AXIOM_PORT:-}"
ADVERTISE="${AXIOM_ADVERTISE:-}"

say() { printf '\033[36m▸ %s\033[0m\n' "$*"; }
die() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# ── 1. arch guard — this build is aarch64 only (AXIOM refuses 32-bit) ──
arch="$(uname -m)"
case "$arch" in
  aarch64|arm64) : ;;
  *) die "This installer is for 64-bit ARM (aarch64). Detected '$arch'. Install 64-bit Raspberry Pi OS." ;;
esac
command -v curl >/dev/null || die "curl is required."
command -v tar  >/dev/null || die "tar is required."

# ── 1b. choose the mesh TCP port (prompt unless AXIOM_PORT preset) ──
#     Read from /dev/tty so the prompt works even under `curl ... | bash`,
#     where the script body itself occupies stdin.
if [ -z "$PORT" ]; then
  if [ -r /dev/tty ]; then
    printf '\033[36m▸ Mesh TCP port for this node [6225]: \033[0m' > /dev/tty
    read -r PORT < /dev/tty || PORT=""
  fi
  PORT="${PORT:-6225}"
fi
case "$PORT" in
  ''|*[!0-9]*) die "Port must be a number (got '$PORT')." ;;
esac
[ "$PORT" -ge 1 ] && [ "$PORT" -le 65535 ] || die "Port out of range: $PORT"
DASH_PORT="${AXIOM_DASHBOARD_PORT:-$((PORT + 1))}"
say "Using mesh port $PORT (dashboard $DASH_PORT)."

# ── 2. find + download the newest linux-arm64 nabla release asset ──
#     Scan ALL releases (newest first) rather than /releases/latest — the
#     wallet DMG owns the "latest" flag, and nabla ships as its own release.
say "Finding the newest AXIOM nabla arm64 release in $REPO ..."
asset_url="$(curl -fsSL "https://api.github.com/repos/$REPO/releases?per_page=30" \
  | grep -oE '"browser_download_url": *"[^"]*nabla-[^"]*-linux-arm64\.tar\.gz"' \
  | head -1 | sed 's/.*"browser_download_url": *"//; s/"$//')"
[ -n "$asset_url" ] || die "No linux-arm64 nabla asset found in $REPO releases."
say "Downloading $asset_url"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
curl -fSL# "$asset_url" -o "$tmp/nabla.tar.gz"
tar xzf "$tmp/nabla.tar.gz" -C "$tmp"
B="$tmp/axiom-nabla"
[ -x "$B/bin/nabla-node" ] || die "bundle missing bin/nabla-node"
[ -f "$B/zkvm/axiom-core.elf" ] || die "bundle missing zkvm/axiom-core.elf (Core ELF)"

# ── 3. install binary + Core ELF + config ──
say "Installing to $DATA_DIR (binary → /usr/local/bin) ..."
mkdir -p "$DATA_DIR/config" "$DATA_DIR/zkvm"
SUDO=""; [ -w /usr/local/bin ] || SUDO="sudo"
$SUDO install -m 0755 "$B/bin/nabla-node"     /usr/local/bin/nabla-node
[ -x "$B/bin/nabla-ceremony" ] && $SUDO install -m 0755 "$B/bin/nabla-ceremony" /usr/local/bin/nabla-ceremony || true
cp "$B/zkvm/axiom-core.elf" "$DATA_DIR/zkvm/axiom-core.elf"
[ -f "$DATA_DIR/node.toml" ]      || cp "$B/node.toml"      "$DATA_DIR/node.toml"
[ -f "$DATA_DIR/bootstrap.toml" ] || cp "$B/bootstrap.toml" "$DATA_DIR/bootstrap.toml"
# stamp the node name
if grep -q '^name' "$DATA_DIR/node.toml"; then
  sed -i "s/^name.*/name = \"$NODE_NAME\"/" "$DATA_DIR/node.toml"
fi

# ── 4. advertise address (peers dial this back; a wildcard bind must never leak) ──
if [ -z "$ADVERTISE" ]; then
  pubip="$(curl -fsSL https://api.ipify.org 2>/dev/null || true)"
  host="${pubip:-$(hostname -I 2>/dev/null | awk '{print $1}')}"
  ADVERTISE="${host}:${PORT}"
fi
ELF="$DATA_DIR/zkvm/axiom-core.elf"

cat <<EOF

  ✓ Installed.
      node name : $NODE_NAME
      advertise : $ADVERTISE   (peers dial you here — port-forward ${PORT}/tcp for inbound)
      data dir  : $DATA_DIR
      Core ELF  : $ELF   (pinned CoreID 9f8015fd)

EOF

# ── 5. write a systemd unit (NOT auto-started — watch it connect first) ──
UNIT=/etc/systemd/system/axiom-nabla.service
say "Writing $UNIT (disabled until you enable it) ..."
sudo tee "$UNIT" >/dev/null <<EOF
[Unit]
Description=AXIOM Nabla Node ($NODE_NAME)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$USER
ExecStart=/usr/local/bin/nabla-node \\
    --mode tcp --bind 0.0.0.0 \\
    --port $PORT --advertise $ADVERTISE \\
    --data $DATA_DIR --config $DATA_DIR/node.toml \\
    --bootstrap $DATA_DIR/bootstrap.toml \\
    --avm-elf $ELF \\
    --dashboard-port $DASH_PORT
Restart=on-failure
RestartSec=10
LimitNOFILE=65536
MemoryMax=1500M
Environment=RUST_LOG=info
StandardOutput=journal
StandardError=journal
SyslogIdentifier=axiom-nabla

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload

cat <<EOF
  ── Step 1: WATCH IT CONNECT (foreground; Ctrl-C to stop) ──
    nabla-node --mode tcp --bind 0.0.0.0 --port $PORT --advertise $ADVERTISE \\
      --data $DATA_DIR --config $DATA_DIR/node.toml \\
      --bootstrap $DATA_DIR/bootstrap.toml --avm-elf $ELF \\
      --dashboard-port $DASH_PORT

    Look for:  "Core pin OK"  →  "NBC obtained from peer"  →  "[ARMED]"  →  TARDIS attach.

  ── Step 2: once it connects, run it as a service ──
    sudo systemctl enable --now axiom-nabla
    journalctl -u axiom-nabla -f

EOF
say "Done. Run Step 1 to see it join the network."
