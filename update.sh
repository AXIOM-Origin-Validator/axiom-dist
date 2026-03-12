#!/bin/bash
# ══════════════════════════════════════════════════════════════
# AXIOM — One-Command Updater
#
# Downloads the latest AXIOM binaries and installs them.
# Auto-detects platform and package type (validator or nabla).
#
# Usage:
#   ./update.sh                     # auto-detect everything
#   ./update.sh nabla               # force nabla-only package
#   ./update.sh validator            # force full validator package
#   ./update.sh --check             # show what would change
#
# First-time install:
#   curl -sL https://raw.githubusercontent.com/AXIOM-Origin-Validator/axiom-dist/master/update.sh -o update.sh
#   chmod +x update.sh
#   ./update.sh nabla               # or: ./update.sh validator
# ══════════════════════════════════════════════════════════════

set -e

DIST_REPO="https://github.com/AXIOM-Origin-Validator/axiom-dist"
DIST_RELEASES="$DIST_REPO/releases/latest/download"

# ── Colors ──
if [ -t 1 ]; then
    RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
    CYAN='\033[0;36m'; DIM='\033[2m'; NC='\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; CYAN=''; DIM=''; NC=''
fi

# ── Detect platform ──
detect_platform() {
    local os arch

    case "$(uname -s)" in
        Linux)  os="linux" ;;
        Darwin) os="macos" ;;
        MINGW*|MSYS*|CYGWIN*) os="windows" ;;
        *)
            echo -e "${RED}Unsupported OS: $(uname -s)${NC}" >&2
            exit 1
            ;;
    esac

    case "$(uname -m)" in
        x86_64|amd64)   arch="x86_64" ;;
        aarch64|arm64)   arch="aarch64" ;;
        *)
            echo -e "${RED}Unsupported architecture: $(uname -m)${NC}" >&2
            echo -e "${YELLOW}AXIOM requires 64-bit platforms (Y2038 safety).${NC}" >&2
            exit 1
            ;;
    esac

    echo "${os}-${arch}"
}

# ── Detect package type from existing installation ──
detect_package() {
    # Check explicit argument first
    if [ "$1" = "validator" ] || [ "$1" = "nabla" ]; then
        echo "$1"
        return
    fi

    # Check existing installation
    for dir in "$HOME/axiom" "/opt/axiom" "$AXIOM_DATA_DIR"; do
        [ -z "$dir" ] && continue
        if [ -f "$dir/bin/lambda" ] || [ -f "$dir/config/vbc.json" ]; then
            echo "validator"
            return
        fi
    done

    for dir in "$HOME/axiom" "$HOME/axiom-nabla" "/opt/axiom" "$AXIOM_DATA_DIR"; do
        [ -z "$dir" ] && continue
        if [ -f "$dir/bin/nabla-node" ] || [ -f "$dir/config/nbc.json" ]; then
            echo "nabla"
            return
        fi
    done

    # No existing installation — require explicit type
    echo ""
}

# ── Main ──
CHECK_ONLY=false
PACKAGE_TYPE=""
EXTRA_ARGS=()

for arg in "$@"; do
    case "$arg" in
        --check)    CHECK_ONLY=true ;;
        validator)  PACKAGE_TYPE="validator" ;;
        nabla)      PACKAGE_TYPE="nabla" ;;
        --help|-h)
            echo "AXIOM Updater — downloads and installs latest binaries"
            echo ""
            echo "Usage: ./update.sh [validator|nabla] [--check]"
            echo ""
            echo "  validator   Full validator package (Lambda + ANTIE + Nabla + Console)"
            echo "  nabla       Nabla-only package (nabla-node + nabla-ceremony)"
            echo "  --check     Show what would be downloaded without installing"
            echo ""
            echo "Auto-detects platform and package type from existing installation."
            exit 0
            ;;
        *)
            EXTRA_ARGS+=("$arg")
            ;;
    esac
done

PLATFORM=$(detect_platform)

if [ -z "$PACKAGE_TYPE" ]; then
    PACKAGE_TYPE=$(detect_package)
fi

if [ -z "$PACKAGE_TYPE" ]; then
    echo -e "${RED}Cannot detect installation type.${NC}"
    echo "Please specify: ./update.sh validator  OR  ./update.sh nabla"
    exit 1
fi

# Build download URL
EXT="tar.gz"
if [[ "$PLATFORM" == windows-* ]]; then
    EXT="zip"
fi
FILENAME="axiom-${PACKAGE_TYPE}-${PLATFORM}-latest.${EXT}"
URL="${DIST_RELEASES}/${FILENAME}"

echo ""
echo -e "${CYAN}AXIOM Updater${NC}"
echo -e "${DIM}─────────────${NC}"
echo -e "  Platform: ${GREEN}$PLATFORM${NC}"
echo -e "  Package:  ${GREEN}$PACKAGE_TYPE${NC}"
echo -e "  URL:      ${DIM}$URL${NC}"
echo ""

if [ "$CHECK_ONLY" = true ]; then
    echo -e "${YELLOW}Check mode — would download: $FILENAME${NC}"
    exit 0
fi

# ── Download ──
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

echo -e "Downloading ${GREEN}$FILENAME${NC}..."

if command -v curl &>/dev/null; then
    HTTP_CODE=$(curl -sL -w "%{http_code}" -o "$TMPDIR/$FILENAME" "$URL")
    if [ "$HTTP_CODE" != "200" ]; then
        echo -e "${RED}Download failed (HTTP $HTTP_CODE).${NC}"
        echo -e "${YELLOW}URL: $URL${NC}"
        echo ""
        echo "Possible causes:"
        echo "  - No release has been published yet"
        echo "  - Platform '$PLATFORM' not available"
        echo "  - Network issue"
        exit 1
    fi
elif command -v wget &>/dev/null; then
    wget -q -O "$TMPDIR/$FILENAME" "$URL" || {
        echo -e "${RED}Download failed.${NC}"
        exit 1
    }
else
    echo -e "${RED}Neither curl nor wget found. Cannot download.${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Downloaded ($(du -h "$TMPDIR/$FILENAME" | cut -f1))"
echo ""

# ── Extract ──
echo "Extracting..."
cd "$TMPDIR"

if [[ "$FILENAME" == *.tar.gz ]]; then
    tar xzf "$FILENAME"
elif [[ "$FILENAME" == *.zip ]]; then
    unzip -q "$FILENAME"
fi

# Find the extracted directory (should contain install.sh)
EXTRACTED=$(find . -name "install.sh" -maxdepth 2 -print -quit)
if [ -z "$EXTRACTED" ]; then
    echo -e "${RED}Error: No install.sh found in package.${NC}"
    exit 1
fi
EXTRACTED_DIR=$(dirname "$EXTRACTED")

echo -e "${GREEN}✓${NC} Extracted"
echo ""

# ── Run installer ──
chmod +x "$EXTRACTED_DIR/install.sh"
bash "$EXTRACTED_DIR/install.sh" "${EXTRA_ARGS[@]}"
