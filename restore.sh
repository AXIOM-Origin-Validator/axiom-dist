#!/usr/bin/env bash
# AXIOM node restore — bring a backup tarball up on this machine.
#
#   curl -sL https://raw.githubusercontent.com/AXIOM-Origin-Validator/axiom-dist/main/restore.sh | bash -s -- axiom-backup-HOST-STAMP.tar.gz
#
# ══════════════════════════════════════════════════════════════════════
# ⚠⚠ ONE IDENTITY, ONE MACHINE. A node identity must NEVER run in two
#    places at once — two live copies fork one identity across divergent
#    state, and the mesh will treat it as misbehaving. Before restoring
#    on a NEW machine, UNINSTALL (or at minimum stop) the node on the OLD
#    machine. Migration order:
#       old machine:  curl .../uninstall.sh | bash        (keeps its backup value)
#       new machine:  curl .../update.sh | bash -s -- nabla   (binaries)
#                     curl .../restore.sh | bash -s -- <tarball>  (identity)
# ══════════════════════════════════════════════════════════════════════
set -u

TARBALL="${1:-}"
[ -z "$TARBALL" ] && { echo "usage: restore.sh <axiom-backup-....tar.gz>"; exit 1; }
[ -f "$TARBALL" ] || { echo "not found: $TARBALL"; exit 1; }

# Never restore over a RUNNING node.
for svc in axiom-nabla axiom-lambda axiom-antie; do
    systemctl --user stop "$svc" 2>/dev/null || true
    sudo systemctl stop  "$svc" 2>/dev/null || true
done
pkill -x nabla-node 2>/dev/null || true

# Keep any existing identity out of the way rather than deleting it.
if [ -d "$HOME/.axiom" ]; then
    MV="$HOME/.axiom.pre-restore-$(date -u +%Y%m%dT%H%M%SZ)"
    mv "$HOME/.axiom" "$MV"
    echo "existing ~/.axiom moved aside to $MV"
fi

tar xzf "$TARBALL" -C "$HOME"
echo "restored into \$HOME: $(tar tzf "$TARBALL" | awk -F/ '{print $1"/"$2}' | sort -u | tr '\n' ' ')"

echo ""
echo "next steps:"
echo "  1. Confirm the OLD machine's node is stopped/uninstalled (one identity, one machine)."
echo "  2. If binaries are not installed yet:  curl -sL .../update.sh | bash -s -- nabla"
echo "  3. Check ~/.axiom/node.toml external_port matches THIS machine's port-forward."
echo "  4. Start:  systemctl --user start axiom-nabla   (or your service manager)"
echo ""
echo "The node resyncs any state it is missing from the mesh automatically."
