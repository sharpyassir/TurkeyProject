#!/usr/bin/env sh
# pgcloud CLI installer — curl -fsSL https://get.pgcloud.example | sh
# Downloads the latest release binary for this OS/arch into /usr/local/bin (or ~/.local/bin).
set -eu

REPO="${PGCLOUD_CLI_REPO:-sharpyassir/Cloud}"
VERSION="${PGCLOUD_CLI_VERSION:-latest}"
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) ARCH=amd64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  *) echo "unsupported architecture: $ARCH" >&2; exit 1 ;;
esac
case "$OS" in linux|darwin) ;; *) echo "unsupported OS: $OS (use the Windows .zip from the releases page)" >&2; exit 1 ;; esac

if [ "$VERSION" = "latest" ]; then
  URL="https://github.com/$REPO/releases/latest/download/pgcloud_${OS}_${ARCH}.tar.gz"
else
  URL="https://github.com/$REPO/releases/download/${VERSION}/pgcloud_${OS}_${ARCH}.tar.gz"
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
echo "→ downloading $URL"
curl -fsSL "$URL" | tar -xz -C "$TMP"

DEST=/usr/local/bin
if [ ! -w "$DEST" ]; then
  DEST="$HOME/.local/bin"; mkdir -p "$DEST"
fi
install -m 0755 "$TMP/pgcloud" "$DEST/pgcloud"
echo "✓ installed to $DEST/pgcloud"
case ":$PATH:" in *":$DEST:"*) ;; *) echo "  add $DEST to your PATH" ;; esac
echo
echo "Next:  pgcloud login"
echo "       pgcloud servers create web-1 --image ubuntu-24-04 --wait"
echo "       pgcloud deploy https://github.com/you/app --wait"
