#!/usr/bin/env bash
# pnc-run.sh — declanșează suita "Android Unit Tests" din thekyng1/ParentalNightControl
# pe runner-ele GitHub, așteaptă concluzia și descarcă artifact-ul pnc-test-summary.
# Ieșire: codul de exit al CI-ului (0 = verde). Summary-ul JSON rămâne la $SUMMARY_PATH.
# Folosit de QA Console ca runner pentru suita "pnc-shared".

set -uo pipefail

REPO="thekyng1/ParentalNightControl"
WORKFLOW="Android Unit Tests"
REF="develop"
SUMMARY_DIR="/tmp/pnc-summary"
SUMMARY_PATH="${SUMMARY_DIR}/pnc-test-summary.json"

rm -rf "$SUMMARY_DIR"
mkdir -p "$SUMMARY_DIR"

echo "[pnc-run] declanșez workflow-ul '${WORKFLOW}' pe ${REPO}@${REF}"
gh workflow run "$WORKFLOW" --repo "$REPO" --ref "$REF"

# run-ul creat de workflow_dispatch nu apare instant — poll scurt până apare
BEFORE=$(gh run list --repo "$REPO" --workflow "$WORKFLOW" --limit 1 --json databaseId --jq '.[0].databaseId')
RUN_ID=""
for _ in $(seq 1 30); do
  RUN_ID=$(gh run list --repo "$REPO" --workflow "$WORKFLOW" --limit 1 --json databaseId --jq '.[0].databaseId')
  if [ -n "$RUN_ID" ] && [ "$RUN_ID" != "$BEFORE" ]; then break; fi
  sleep 2
done
if [ -z "$RUN_ID" ] || [ "$RUN_ID" = "$BEFORE" ]; then
  echo "[pnc-run] EROARE: noul run nu a apărut după 60s" >&2
  exit 1
fi
echo "[pnc-run] run CI id=${RUN_ID} — https://github.com/${REPO}/actions/runs/${RUN_ID}"

# urmărim run-ul; --exit-status întoarce codul de exit al CI-ului
gh run watch "$RUN_ID" --repo "$REPO" --exit-status
STATUS=$?
echo "[pnc-run] concluzie CI: exit=${STATUS}"

# descărcăm artifact-ul cu sumarul de teste (există la orice rezultat, if: always())
ARTIFACT_ID=$(gh api "repos/${REPO}/actions/runs/${RUN_ID}/artifacts" --jq '.artifacts[] | select(.name=="pnc-test-summary") | .id')
if [ -n "$ARTIFACT_ID" ]; then
  gh api "repos/${REPO}/actions/artifacts/${ARTIFACT_ID}/zip" > "${SUMMARY_DIR}/summary.zip"
  unzip -o -q "${SUMMARY_DIR}/summary.zip" -d "$SUMMARY_DIR"
  rm -f "${SUMMARY_DIR}/summary.zip"
  echo "[pnc-run] sumar: $(cat "$SUMMARY_PATH")"
else
  echo "[pnc-run] ATENȚIE: artifact pnc-test-summary lipsă" >&2
fi

exit $STATUS
