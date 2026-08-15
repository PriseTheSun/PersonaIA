#!/usr/bin/env bash
set -u

# Testes black-box tenant-safe. Não executa mutações por padrão.
# Requisitos: curl. jq é opcional.
# Use exclusivamente em ambiente autorizado. Tokens nunca são impressos.

PASS=0
FAIL=0
SKIP=0

BASE_URL="${BASE_URL:-}"
WEB_BASE_URL="${WEB_BASE_URL:-}"
TENANT_A_TOKEN="${TENANT_A_TOKEN:-}"
TENANT_B_TOKEN="${TENANT_B_TOKEN:-}"
SUPER_TOKEN="${SUPER_TOKEN:-}"
TENANT_A_ID="${TENANT_A_ID:-}"
TENANT_B_ID="${TENANT_B_ID:-}"
PROJECT_A_ID="${PROJECT_A_ID:-}"
PROJECT_B_ID="${PROJECT_B_ID:-}"
RUN_MUTATING="${RUN_MUTATING:-0}"
CROSS_TENANT_EXPECTED_STATUS="${CROSS_TENANT_EXPECTED_STATUS:-404}"

# Os templates aceitam {id} e {tenantId}.
PROTECTED_PATH="${PROTECTED_PATH:-/api/v1/projects}"
PROJECT_RESOURCE_TEMPLATE="${PROJECT_RESOURCE_TEMPLATE:-/api/v1/projects/{id}}"
TENANT_PROJECTS_TEMPLATE="${TENANT_PROJECTS_TEMPLATE:-/api/v1/tenants/{tenantId}/projects}"
PROJECT_LIST_PATH="${PROJECT_LIST_PATH:-/api/v1/projects}"
SUPER_TENANTS_PATH="${SUPER_TENANTS_PATH:-/api/v1/tenants}"

if [[ -z "$BASE_URL" ]]; then
  echo "ERRO: defina BASE_URL (ex.: https://staging.example.test)" >&2
  exit 2
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "ERRO: curl não encontrado" >&2
  exit 2
fi

BASE_URL="${BASE_URL%/}"
WEB_BASE_URL="${WEB_BASE_URL%/}"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/personaia-blackbox.XXXXXX")"

cleanup() {
  case "$TMP_DIR" in
    "${TMPDIR:-/tmp}"/personaia-blackbox.*) rm -rf -- "$TMP_DIR" ;;
    *) echo "AVISO: diretório temporário inesperado; limpeza ignorada" >&2 ;;
  esac
}
trap cleanup EXIT INT TERM

pass() { PASS=$((PASS + 1)); printf 'PASS  %s\n' "$1"; }
fail() { FAIL=$((FAIL + 1)); printf 'FAIL  %s\n' "$1"; }
skip() { SKIP=$((SKIP + 1)); printf 'SKIP  %s\n' "$1"; }

render_path() {
  local template="$1"
  local id="${2:-}"
  local tenant_id="${3:-}"
  template="${template//\{id\}/$id}"
  template="${template//\{tenantId\}/$tenant_id}"
  printf '%s' "$template"
}

# request NAME METHOD PATH TOKEN [BODY]
# Define RESPONSE_STATUS, RESPONSE_BODY e RESPONSE_HEADERS sem expor credenciais.
request() {
  local name="$1"
  local method="$2"
  local path="$3"
  local token="$4"
  local body="${5:-}"
  local body_file="$TMP_DIR/${name}.body"
  local header_file="$TMP_DIR/${name}.headers"
  local -a args

  args=(--silent --show-error --connect-timeout 5 --max-time 20
    --request "$method" --output "$body_file" --dump-header "$header_file"
    --write-out '%{http_code}' --header 'Accept: application/json')
  if [[ -n "$token" ]]; then
    args+=(--header "Authorization: Bearer $token")
  fi
  if [[ -n "$body" ]]; then
    args+=(--header 'Content-Type: application/json' --data "$body")
  fi

  RESPONSE_STATUS="$(curl "${args[@]}" "$BASE_URL$path" 2>"$TMP_DIR/${name}.curl-error")" || {
    RESPONSE_STATUS="000"
  }
  RESPONSE_BODY="$body_file"
  RESPONSE_HEADERS="$header_file"
}

expect_status() {
  local name="$1"
  local expected="$2"
  if [[ "$RESPONSE_STATUS" == "$expected" ]]; then
    pass "$name retornou $expected"
  else
    local preview
    preview="$(head -c 160 "$RESPONSE_BODY" 2>/dev/null | tr '\n\r' '  ')"
    fail "$name esperava $expected, recebeu $RESPONSE_STATUS; body=${preview}"
  fi
}

expect_absent() {
  local name="$1"
  local marker="$2"
  if [[ -z "$marker" ]]; then
    skip "$name sem marcador configurado"
  elif grep -Fqi -- "$marker" "$RESPONSE_BODY"; then
    fail "$name encontrou marcador proibido na resposta"
  else
    pass "$name não contém marcador proibido"
  fi
}

echo "Black-box security checks em $BASE_URL"

request "unauthenticated" GET "$PROTECTED_PATH" ""
expect_status "rota protegida sem autenticação" 401

request "malformed-token" GET "$PROTECTED_PATH" "not-a-valid-token"
expect_status "token malformado" 401

if [[ -n "$TENANT_A_TOKEN" && -n "$PROJECT_A_ID" ]]; then
  own_path="$(render_path "$PROJECT_RESOURCE_TEMPLATE" "$PROJECT_A_ID")"
  request "own-project" GET "$own_path" "$TENANT_A_TOKEN"
  expect_status "admin A lê projeto A" 200
else
  skip "leitura do próprio projeto requer TENANT_A_TOKEN e PROJECT_A_ID"
fi

if [[ -n "$TENANT_A_TOKEN" && -n "$PROJECT_B_ID" ]]; then
  foreign_path="$(render_path "$PROJECT_RESOURCE_TEMPLATE" "$PROJECT_B_ID")"
  request "foreign-project" GET "$foreign_path" "$TENANT_A_TOKEN"
  expect_status "admin A não lê projeto B" "$CROSS_TENANT_EXPECTED_STATUS"
else
  skip "IDOR de projeto requer TENANT_A_TOKEN e PROJECT_B_ID"
fi

if [[ -n "$TENANT_B_TOKEN" && -n "$PROJECT_A_ID" ]]; then
  foreign_reverse_path="$(render_path "$PROJECT_RESOURCE_TEMPLATE" "$PROJECT_A_ID")"
  request "foreign-project-reverse" GET "$foreign_reverse_path" "$TENANT_B_TOKEN"
  expect_status "admin B não lê projeto A" "$CROSS_TENANT_EXPECTED_STATUS"
else
  skip "IDOR reverso requer TENANT_B_TOKEN e PROJECT_A_ID"
fi

if [[ -n "$TENANT_A_TOKEN" ]]; then
  request "tenant-a-project-list" GET "$PROJECT_LIST_PATH" "$TENANT_A_TOKEN"
  expect_status "admin A lista projetos" 200
  expect_absent "lista de A não contém tenant B" "$TENANT_B_ID"
  expect_absent "lista de A não contém projeto B" "$PROJECT_B_ID"
else
  skip "escopo de listagem requer TENANT_A_TOKEN"
fi

if [[ -n "$TENANT_A_TOKEN" && -n "$TENANT_B_ID" ]]; then
  tenant_b_path="$(render_path "$TENANT_PROJECTS_TEMPLATE" "" "$TENANT_B_ID")"
  request "foreign-tenant-path" GET "$tenant_b_path" "$TENANT_A_TOKEN"
  expect_status "tenant em path não amplia acesso" "$CROSS_TENANT_EXPECTED_STATUS"
else
  skip "tenant path requer TENANT_A_TOKEN e TENANT_B_ID"
fi

if [[ -n "$TENANT_A_TOKEN" ]]; then
  request "client-global-tenants" GET "$SUPER_TENANTS_PATH" "$TENANT_A_TOKEN"
  if [[ "$RESPONSE_STATUS" == "403" || "$RESPONSE_STATUS" == "404" ]]; then
    pass "Client Admin não acessa listagem global ($RESPONSE_STATUS)"
  else
    fail "Client Admin acessou/obteve status inesperado na rota global ($RESPONSE_STATUS)"
  fi
else
  skip "BFLA global requer TENANT_A_TOKEN"
fi

if [[ -n "$SUPER_TOKEN" ]]; then
  request "super-global-tenants" GET "$SUPER_TENANTS_PATH" "$SUPER_TOKEN"
  expect_status "Super Admin acessa listagem global" 200
else
  skip "teste positivo global requer SUPER_TOKEN"
fi

if [[ "$RUN_MUTATING" == "1" ]]; then
  if [[ -n "$TENANT_A_TOKEN" && -n "$PROJECT_A_ID" && -n "$TENANT_B_ID" ]]; then
    own_mass_assignment_path="$(render_path "$PROJECT_RESOURCE_TEMPLATE" "$PROJECT_A_ID")"
    request "mass-assignment-project" PATCH "$own_mass_assignment_path" "$TENANT_A_TOKEN" \
      "{\"tenantId\":\"$TENANT_B_ID\"}"
    expect_status "API rejeita tenantId em payload tenant-scoped" 400
  else
    skip "mass assignment requer TENANT_A_TOKEN, PROJECT_A_ID e TENANT_B_ID"
  fi

  if [[ -n "$TENANT_A_TOKEN" && -n "$PROJECT_B_ID" ]]; then
    mutating_foreign_path="$(render_path "$PROJECT_RESOURCE_TEMPLATE" "$PROJECT_B_ID")"
    request "patch-foreign-project" PATCH "$mutating_foreign_path" "$TENANT_A_TOKEN" \
      '{"name":"cross-tenant-probe","tenantId":"forbidden"}'
    expect_status "admin A não altera projeto B" "$CROSS_TENANT_EXPECTED_STATUS"
  else
    skip "PATCH IDOR requer TENANT_A_TOKEN e PROJECT_B_ID"
  fi

  if [[ -n "$TENANT_A_TOKEN" && -n "$TENANT_B_ID" ]]; then
    create_foreign_path="$(render_path "$TENANT_PROJECTS_TEMPLATE" "" "$TENANT_B_ID")"
    request "create-foreign-project" POST "$create_foreign_path" "$TENANT_A_TOKEN" \
      '{"name":"cross-tenant-probe"}'
    expect_status "admin A não cria projeto no tenant B" "$CROSS_TENANT_EXPECTED_STATUS"
  else
    skip "POST cross-tenant requer TENANT_A_TOKEN e TENANT_B_ID"
  fi
else
  skip "testes mutáveis desativados (RUN_MUTATING=1 somente em ambiente descartável)"
fi

# CORS: origem maliciosa nunca pode ser refletida como permitida.
origin="https://evil.invalid"
cors_headers="$TMP_DIR/cors.headers"
cors_status="$(curl --silent --show-error --connect-timeout 5 --max-time 20 \
  --request OPTIONS --header "Origin: $origin" \
  --header 'Access-Control-Request-Method: GET' \
  --dump-header "$cors_headers" --output /dev/null --write-out '%{http_code}' \
  "$BASE_URL$PROTECTED_PATH" 2>"$TMP_DIR/cors.curl-error")" || cors_status="000"
if [[ "$cors_status" == "000" ]]; then
  fail "não foi possível validar CORS"
elif grep -Eqi "^access-control-allow-origin:[[:space:]]*${origin//./\.}[[:space:]]*$" "$cors_headers"; then
  fail "CORS refletiu origem não confiável"
else
  pass "CORS não permite origem não confiável"
fi
if grep -Eqi '^access-control-allow-origin:[[:space:]]*\*[[:space:]]*$' "$cors_headers" && \
   grep -Eqi '^access-control-allow-credentials:[[:space:]]*true[[:space:]]*$' "$cors_headers"; then
  fail "CORS combina wildcard com credenciais"
else
  pass "CORS não combina wildcard com credenciais"
fi

if [[ -n "$WEB_BASE_URL" ]]; then
  web_headers="$TMP_DIR/web.headers"
  curl --silent --show-error --connect-timeout 5 --max-time 20 \
    --dump-header "$web_headers" --output /dev/null "$WEB_BASE_URL/" || true
  for header in content-security-policy x-content-type-options referrer-policy; do
    if grep -Eqi "^${header}:" "$web_headers"; then
      pass "frontend envia header $header"
    else
      fail "frontend não envia header $header"
    fi
  done
  if [[ "$WEB_BASE_URL" == https://* ]]; then
    if grep -Eqi '^strict-transport-security:' "$web_headers"; then
      pass "frontend HTTPS envia HSTS"
    else
      fail "frontend HTTPS não envia HSTS"
    fi
  fi
else
  skip "headers do frontend requerem WEB_BASE_URL"
fi

printf '\nResumo: %d PASS, %d FAIL, %d SKIP\n' "$PASS" "$FAIL" "$SKIP"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
exit 0
