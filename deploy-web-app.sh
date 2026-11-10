#!/usr/bin/env bash
# Publishes the site to https://ppcmarketing.web.app
# (Firebase Hosting site "ppcmarketing" in project automation-0105; the old domain ppcmarketing.pro expired 07.11.2026).
#
# Only files known to git go out (their current working-tree versions), so ignored folders such as
# Resumes/, design/ and drafts never become public. A new file must be at least `git add`-ed to be published.
# Unchanged files are not re-uploaded, so a run takes seconds.
#
#   bash deploy-web-app.sh
set -euo pipefail
cd "$(dirname "$0")"

OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT
mkdir -p "$OUT/public"

git ls-files -z \
  | while IFS= read -r -d '' f; do [ -f "$f" ] && printf '%s\0' "$f"; done \
  | /usr/bin/grep -zvE '^(CNAME|\.gitignore|deploy-web-app\.sh)$' \
  | /usr/bin/tar --null -T - -cf - \
  | /usr/bin/tar -xf - -C "$OUT/public"

cat > "$OUT/firebase.json" <<'JSON'
{
  "hosting": {
    "site": "ppcmarketing",
    "public": "public",
    "ignore": ["firebase.json", "**/.*"],
    "headers": [
      { "source": "**/*.@(jpg|jpeg|png|webp|svg|ico|mp4|webm|mp3|woff2)",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=86400" }] }
    ]
  }
}
JSON

FB="$(command -v firebase || echo "$HOME/.nvm/versions/node/v24.11.1/bin/firebase")"
(cd "$OUT" && "$FB" deploy --only hosting:ppcmarketing --project automation-0105 --non-interactive)
