#!/usr/bin/env bash
# Compile the backend, compile and run the test suite, and bundle the frontend.
#
# `./mvnw test` is the real gate and should be what CI runs. This script exists because Maven
# Central answers 403 from this network, so the wrapper cannot fetch Maven itself; it drives javac
# directly against the jars already vendored in .m2-superadmin.
#
# Two things it works around, both worth knowing:
#   - Compiling across the mounted Windows filesystem took >4 minutes and did not finish. Copying
#     the tree to local disk first brings it to ~20 seconds, so that is what this does.
#   - junit-platform-launcher is not in the vendored repo and is not published as a GitHub release
#     asset, so tools/tinyrunner runs the suite instead. It is a stopgap, not surefire.
#
# Usage:  ./tools/verify.sh            # everything
#         ./tools/verify.sh backend    # compile + tests only
#         ./tools/verify.sh frontend   # bundle only

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="${WORK_DIR:-$HOME/.caffio-build}"
JAVA_HOME="${JAVA_HOME:-$HOME/jdks/jdk-17.0.13+11}"

if [[ ! -x "$JAVA_HOME/bin/javac" ]]; then
  echo "No JDK 17 at $JAVA_HOME." >&2
  echo "Set JAVA_HOME, or fetch one (github.com is reachable where Adoptium's CDN is not):" >&2
  echo "  curl -L -o /tmp/jdk17.tgz https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.13%2B11/OpenJDK17U-jdk_x64_linux_hotspot_17.0.13_11.tar.gz" >&2
  echo "  mkdir -p ~/jdks && tar xzf /tmp/jdk17.tgz -C ~/jdks" >&2
  exit 1
fi

backend() {
  echo "── backend ────────────────────────────────────────────"
  rm -rf "$WORK/src" "$WORK/out" "$WORK/tout"
  mkdir -p "$WORK"
  cp -r "$ROOT/src" "$WORK/"

  # The vendored repository, not ~/.m2 — the checked-in classpath file points at Windows paths.
  find "$ROOT/.m2-superadmin" -name '*.jar' | tr '\n' ':' > "$WORK/cp.txt"

  find "$WORK/src/main/java" -name '*.java' > "$WORK/srcs.txt"
  find "$WORK/src/test/java" -name '*.java' > "$WORK/tsrcs.txt"

  # .m2-superadmin is a PARTIAL repository - it was assembled for a subset of the build and does
  # not carry every dependency the pom declares. Rather than fail with an opaque "package does not
  # exist", name what is missing and exclude only the sources that need it, so the rest is still
  # checked and the gap is visible instead of silent.
  PARTIAL=""
  if ! grep -q 'flyway-core' "$WORK/cp.txt"; then
    PARTIAL="flyway-core"
    # Every source that imports flyway, not just FlywayConfig — the Java migrations under
    # db/migration extend BaseJavaMigration and fail the same way, and one unexcluded file
    # aborts the whole compile.
    grep -vFf <(grep -rl 'org\.flywaydb' "$WORK/src/main/java" || true) "$WORK/srcs.txt" > "$WORK/srcs.tmp"
    mv "$WORK/srcs.tmp" "$WORK/srcs.txt"
    echo "NOTE: flyway-core is not in .m2-superadmin, so the sources that import it are excluded here."
    echo "      It is a normal pom dependency and compiles under ./mvnw against the real ~/.m2."
    echo "      To close the gap, copy org/flywaydb/flyway-core into .m2-superadmin."
  fi

  # -parameters matters: Spring reads @RequestParam names from it, and without it every unnamed
  # binding fails at runtime with "Name for argument of type [java.lang.String] not specified".
  "$JAVA_HOME/bin/javac" -parameters -nowarn -d "$WORK/out" \
      -cp "$(cat "$WORK/cp.txt")" "@$WORK/srcs.txt"
  echo "main:  $(wc -l < "$WORK/srcs.txt") sources OK"

  "$JAVA_HOME/bin/javac" -parameters -nowarn -d "$WORK/tout" \
      -cp "$WORK/out:$(cat "$WORK/cp.txt")" "@$WORK/tsrcs.txt"
  echo "tests: $(wc -l < "$WORK/tsrcs.txt") sources OK"

  "$JAVA_HOME/bin/javac" -d "$WORK/runner" "$ROOT/tools/tinyrunner/TinyRunner.java"
  "$JAVA_HOME/bin/java" \
      -cp "$WORK/runner:$WORK/tout:$WORK/out:$WORK/src/test/resources:$(cat "$WORK/cp.txt")" \
      TinyRunner "$WORK/tout"
}

frontend() {
  echo "── frontend ───────────────────────────────────────────"
  # The checked-in node_modules are Windows binaries; oxlint and vite both fail under Linux with
  # "Cannot find module './oxlint.linux-x64-gnu.node'". Use a separately installed esbuild.
  ESBUILD="${ESBUILD:-$(command -v esbuild || true)}"
  if [[ -z "$ESBUILD" ]]; then
    echo "esbuild not found. Install one:  mkdir -p ~/tools && cd ~/tools && npm i esbuild" >&2
    echo "then re-run with ESBUILD=~/tools/node_modules/.bin/esbuild" >&2
    exit 1
  fi

  # Copy the sources to local disk (the mount is slow), but symlink node_modules rather than
  # copying 140 MB of it — esbuild resolves bare imports like 'react-router-dom' through it.
  rm -rf "$WORK/fe"
  mkdir -p "$WORK/fe"
  cp -r "$ROOT/frontend/src" "$WORK/fe/"
  ln -sfn "$ROOT/frontend/node_modules" "$WORK/fe/node_modules"

  "$ESBUILD" "$WORK/fe/src/main.jsx" --bundle --format=esm --outfile="$WORK/bundle.js" \
    --loader:.js=jsx --loader:.jsx=jsx \
    --loader:.svg=dataurl --loader:.png=dataurl \
    --loader:.woff=dataurl --loader:.woff2=dataurl --loader:.ttf=dataurl --loader:.eot=dataurl \
    --define:process.env.NODE_ENV='"production"'
}

case "${1:-all}" in
  backend)  backend ;;
  frontend) frontend ;;
  all)      backend; echo; frontend ;;
  *)        echo "usage: $0 [all|backend|frontend]" >&2; exit 2 ;;
esac

echo
if [[ -n "${PARTIAL:-}" ]]; then
  echo "Green, but PARTIAL: $PARTIAL missing from .m2-superadmin (see the note above)."
  echo "./mvnw test remains the only run that covers everything."
else
  echo "All green."
fi
