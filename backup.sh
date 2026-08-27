#!/usr/bin/env bash
# AXIOM node backup — identity, config, and state in one tarball.
#
#   curl -sL https://raw.githubusercontent.com/AXIOM-Origin-Validator/axiom-dist/main/backup.sh | bash
#
# Writes ./axiom-backup-<host>-<UTCstamp>.tar.gz and prints the path.
#
#   ... | bash -s -- --cold      stop services first for a guaranteed-
#                                consistent state snapshot, restart after.
#                                (Hot backups are always safe for KEYS and
#                                CONFIG; node state is resynced from the mesh
#                                on restore anyway, so hot is the default.)
#
# What is captured (whatever exists):
#   ~/.axiom            node identity (keys), node.toml, bootstrap, state
#   ~/axiom/config      validator-layout keys + config
#   ~/axiom-nabla/config, /opt/axiom/config (alternate layouts)
# Logs and zkvm artifacts are excluded (re-downloadable / not identity).
set -u

COLD=0
for a in "$@"; do case "$a" in --cold) COLD=1 ;; esac; done

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$PWD/axiom-backup-$(hostname -s)-$STAMP.tar.gz"

SRCS=()
[ -d "$HOME/.axiom" ]            && SRCS+=(".axiom")
[ -d "$HOME/axiom/config" ]      && SRCS+=("axiom/config")
[ -d "$HOME/axiom-nabla/config" ] && SRCS+=("axiom-nabla/config")
[ ${#SRCS[@]} -eq 0 ] && { echo "nothing to back up (no ~/.axiom or */config found)"; exit 1; }

if [ $COLD = 1 ]; then
    echo "cold backup: stopping services..."
    for svc in axiom-nabla axiom-lambda axiom-antie; do
        systemctl --user stop "$svc" 2>/dev/null || true
        sudo systemctl stop  "$svc" 2>/dev/null || true
    done
fi

tar czf "$OUT" -C "$HOME" \
    --exclude='*/logs' --exclude='*/logs/*' \
    --exclude='*/zkvm/*' \
    "${SRCS[@]}"

if [ $COLD = 1 ]; then
    for svc in axiom-nabla axiom-lambda axiom-antie; do
        systemctl --user start "$svc" 2>/dev/null || true
        sudo systemctl start  "$svc" 2>/dev/null || true
    done
    echo "services restarted."
fi

echo ""
echo "backup written: $OUT  ($(du -h "$OUT" | cut -f1))"
echo "contains: ${SRCS[*]}"
echo ""
echo "⚠ This tarball IS your node identity. Store it like a private key."
