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
#    AXIOM_TXID_MODE   bloom | hashmap         (default bloom/standard; prompted if unset)
#    AXIOM_DATA_DIR    data dir                (default ~/.axiom)
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

REPO="AXIOM-Origin-Validator/axiom-dist"
DATA_DIR="${AXIOM_DATA_DIR:-$HOME/.axiom}"
NODE_NAME="${AXIOM_NODE_NAME:-nabla-pi-$(hostname -s 2>/dev/null || echo node)}"
PORT="${AXIOM_PORT:-}"
ADVERTISE="${AXIOM_ADVERTISE:-}"
TXID_MODE="${AXIOM_TXID_MODE:-}"   # bloom (standard) | hashmap (recording)

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

# ── 1c. storage mode: standard (bloom) vs recording (hashmap) ──
#     Standard keeps a compact bloom txid filter (tens of MB). Recording keeps
#     an exact hashmap of every network txid — it earns ~5x more CC but its disk
#     use grows with the whole network's transaction history (plan a big disk).
if [ -z "$TXID_MODE" ]; then
  if [ -r /dev/tty ]; then
    {
      printf '\n  Storage mode for this node:\n'
      printf '    1) Standard   — bloom txid filter, low disk (~tens of MB).           [default]\n'
      printf '    2) Recording  — exact hashmap: earns ~5x more CC, but needs MUCH more\n'
      printf '                    disk (grows with ALL network txids — use a large SSD/HDD).\n'
      printf '  \033[36m▸ Choose [1]: \033[0m'
    } > /dev/tty
    read -r _m < /dev/tty || _m=""
  fi
  case "${_m:-1}" in
    2|hashmap|recording) TXID_MODE=hashmap ;;
    *)                   TXID_MODE=bloom ;;
  esac
fi
case "$TXID_MODE" in bloom|hashmap) ;; *) die "AXIOM_TXID_MODE must be bloom or hashmap (got '$TXID_MODE')." ;; esac
if [ "$TXID_MODE" = hashmap ]; then
  say "Storage mode: RECORDING (hashmap) — ~5x CC, large disk required."
else
  say "Storage mode: standard (bloom)."
fi

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
# status CLI (read-only client; fetched from the repo so it updates independently)
if curl -fsSL "https://raw.githubusercontent.com/$REPO/main/nabla" -o "$tmp/nabla-cli" 2>/dev/null; then
  $SUDO install -m 0755 "$tmp/nabla-cli" /usr/local/bin/nabla && say "Installed 'nabla' status CLI → /usr/local/bin/nabla"
fi
cp "$B/zkvm/axiom-core.elf" "$DATA_DIR/zkvm/axiom-core.elf"
[ -f "$DATA_DIR/node.toml" ]      || cp "$B/node.toml"      "$DATA_DIR/node.toml"
[ -f "$DATA_DIR/bootstrap.toml" ] || cp "$B/bootstrap.toml" "$DATA_DIR/bootstrap.toml"
# stamp the node name
if grep -q '^name' "$DATA_DIR/node.toml"; then
  sed -i "s/^name.*/name = \"$NODE_NAME\"/" "$DATA_DIR/node.toml"
fi
# keep node.toml ports in sync with the chosen values (the `nabla` CLI reads dashboard_port from here)
sed -i "s/^port.*/port = $PORT/"                          "$DATA_DIR/node.toml" 2>/dev/null || true
sed -i "s/^dashboard_port.*/dashboard_port = $DASH_PORT/" "$DATA_DIR/node.toml" 2>/dev/null || true

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
    --txid-mode $TXID_MODE \\
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

# ── 6. launch + guided connect trace (built for someone new to this) ──
RUN_CMD=(/usr/local/bin/nabla-node --mode tcp --bind 0.0.0.0
  --port "$PORT" --advertise "$ADVERTISE"
  --data "$DATA_DIR" --config "$DATA_DIR/node.toml"
  --bootstrap "$DATA_DIR/bootstrap.toml" --avm-elf "$ELF"
  --txid-mode "$TXID_MODE" --dashboard-port "$DASH_PORT")

cat <<EOF

  Your node is ready. It will run as:
    ${RUN_CMD[*]}

EOF

ans="y"
if [ -r /dev/tty ]; then
  printf '\033[36m▸ Start it now and watch it connect to the network? [Y/n]: \033[0m' > /dev/tty
  read -r ans < /dev/tty || ans="y"
fi
case "${ans:-y}" in
  n|N|no|NO|No)
    say "Not started. When you're ready:  sudo systemctl enable --now axiom-nabla   (then check with: nabla)"
    exit 0 ;;
esac

RUNLOG="$DATA_DIR/first-run.log"
: > "$RUNLOG"
say "Starting the node. Joining the network takes about 1–3 minutes — watching progress:"
echo
"${RUN_CMD[@]}" > "$RUNLOG" 2>&1 &
NPID=$!
trap 'kill "$NPID" 2>/dev/null || true' INT TERM

# watch_step <regex> <friendly label> <timeout-seconds>
watch_step() {
  local rx="$1" label="$2" to="$3" t=0
  printf '  \033[2m…\033[0m %s' "$label"
  while [ "$t" -lt "$to" ]; do
    if ! kill -0 "$NPID" 2>/dev/null; then printf '\r  \033[1;31m✗\033[0m %s — the node stopped unexpectedly\n' "$label"; return 1; fi
    if grep -qiE "$rx" "$RUNLOG" 2>/dev/null; then printf '\r  \033[1;32m✓\033[0m %s%*s\n' "$label" 12 ''; return 0; fi
    sleep 2; t=$((t + 2))
    printf '\r  \033[2m…\033[0m %s  \033[2m(%ss)\033[0m' "$label" "$t"
  done
  printf '\r  \033[1;31m✗\033[0m %s — timed out\n' "$label"; return 1
}

ok=1
watch_step "Core pin OK|loaded ELF matches"        "Core software verified"            25  || ok=0
if [ "$ok" = 1 ]; then watch_step "NBC obtained from peer|NBC written" "Joined — got a network identity"   120 || ok=0; fi
if [ "$ok" = 1 ]; then watch_step '\[ARMED\]'                          "Synced and armed (ready to serve)" 200 || ok=0; fi

if [ "$ok" != 1 ]; then
  echo
  printf '  \033[1;31mCouldn'\''t fully connect.\033[0m Last few log lines:\n'
  tail -n 6 "$RUNLOG" 2>/dev/null | sed 's/^/    /'
  cat <<EOF

  Things to check (no experience needed — go top to bottom):
    • Is the Pi online? It must reach the internet to find the AXIOM network.
    • Is the Pi on the SAME home network as the mesh? The public addresses may not
      loop back — edit  $DATA_DIR/bootstrap.toml  to use the mesh box's LAN IP.
    • Full log is here:  $RUNLOG
  The node has been stopped. Fix the above and re-run the installer to try again.
EOF
  kill "$NPID" 2>/dev/null || true
  exit 1
fi

echo
say "✓ CONNECTED — your nabla node is live on the AXIOM network. Here's its status:"
sleep 3
/usr/local/bin/nabla --port "$DASH_PORT" 2>/dev/null || true

keep="y"
if [ -r /dev/tty ]; then
  printf '\n\033[36m▸ Keep it running on every boot (recommended — installs a background service)? [Y/n]: \033[0m' > /dev/tty
  read -r keep < /dev/tty || keep="y"
fi
case "${keep:-y}" in
  n|N|no|NO|No)
    say "OK — not installing the service. It is running now but will stop when this session ends."
    say "To start it yourself later:  ${RUN_CMD[*]}"
    kill "$NPID" 2>/dev/null || true ;;
  *)
    say "Installing the background service (it will restart on boot/crash) ..."
    kill "$NPID" 2>/dev/null || true
    wait "$NPID" 2>/dev/null || true
    if sudo systemctl enable --now axiom-nabla; then
      sleep 5
      /usr/local/bin/nabla --port "$DASH_PORT" 2>/dev/null || true
      say "Running as a service ✓   Live logs:  journalctl -u axiom-nabla -f    Status card:  nabla"
    else
      say "Service install needs sudo — run it yourself:  sudo systemctl enable --now axiom-nabla"
    fi ;;
esac
