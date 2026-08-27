#!/usr/bin/env bash
# AXIOM node uninstaller.
#
#   curl -sL https://raw.githubusercontent.com/AXIOM-Origin-Validator/axiom-dist/main/uninstall.sh | bash
#
# Default: stops + removes services and binaries, KEEPS your node identity
# (keys) and data so a reinstall resumes the same node.
#
#   ... | bash -s -- --purge     also delete keys + data (IRREVERSIBLE:
#                                the node identity cannot be recreated)
#
# Removing a node never harms the AXIOM mesh: your node's state is a replica,
# and the mesh routes around departed nodes automatically.
set -u

PURGE=0
for a in "$@"; do
    case "$a" in
        --purge) PURGE=1 ;;
        --help|-h)
            grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    esac
done

INSTALL_DIR="${AXIOM_DATA_DIR:-}"
if [ -z "$INSTALL_DIR" ]; then
    for d in "$HOME/axiom" "/opt/axiom" "$HOME/axiom-nabla"; do
        [ -d "$d/bin" ] && INSTALL_DIR="$d" && break
    done
fi
DATA_DIR="${DATA_DIR:-$HOME/.axiom}"

echo "AXIOM uninstall"
echo "  install dir : ${INSTALL_DIR:-<none found>}"
echo "  data dir    : $DATA_DIR $( [ $PURGE = 1 ] && echo '(WILL BE DELETED — --purge)' || echo '(kept)')"

# 1. Stop + disable services (user units first, then system; either may exist)
for svc in axiom-nabla axiom-lambda axiom-antie axiom-dashboard axiom-tot axiom-fatmama; do
    systemctl --user stop    "$svc" 2>/dev/null || true
    systemctl --user disable "$svc" 2>/dev/null || true
    sudo systemctl stop      "$svc" 2>/dev/null || true
    sudo systemctl disable   "$svc" 2>/dev/null || true
done
rm -f "$HOME/.config/systemd/user/axiom-"*.service 2>/dev/null || true
sudo rm -f /etc/systemd/system/axiom-*.service 2>/dev/null || true
systemctl --user daemon-reload 2>/dev/null || true
sudo systemctl daemon-reload 2>/dev/null || true
echo "  services stopped + unit files removed"

# 2. Kill any process launched outside systemd (setsid installs)
pkill -x nabla-node 2>/dev/null || true
pkill -x lambda     2>/dev/null || true
pkill -x antie      2>/dev/null || true

# 3. Remove binaries + install dir
if [ -n "$INSTALL_DIR" ] && [ -d "$INSTALL_DIR" ]; then
    rm -rf "$INSTALL_DIR"
    echo "  removed $INSTALL_DIR"
fi

# 4. Data + identity
if [ $PURGE = 1 ]; then
    rm -rf "$DATA_DIR"
    echo "  PURGED $DATA_DIR (keys + data gone — this node identity is finished)"
else
    echo "  kept $DATA_DIR — reinstall resumes this node; use --purge to delete"
fi

echo "done."
