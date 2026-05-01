#!/usr/bin/env bash
# ============================================================
# fix-api-key-guard.sh
# Corrige: Property 'validateApiKey' does not exist on type 'ApiKeysService'
# Causa:   El servicio expone validate() pero el guard llama validateApiKey()
# Fix:     Renombra el método en api-keys.service.ts → validateApiKey
# ============================================================
set -euo pipefail

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✔ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠ $*${NC}"; }
err()  { echo -e "${RED}✖ $*${NC}"; exit 1; }

# ── Verificar que estamos en la raíz del proyecto backend
[ -f "nest-cli.json" ] || err "Ejecutá este script desde la raíz del proyecto NestJS (donde está nest-cli.json)"

SERVICE="src/api-keys/api-keys.service.ts"
GUARD="src/common/guards/api-key-auth.guard.ts"

[ -f "$SERVICE" ] || err "No se encontró $SERVICE"
[ -f "$GUARD"   ] || err "No se encontró $GUARD"

echo ""
echo "══════════════════════════════════════════════"
echo "  fix-api-key-guard — renombre validate → validateApiKey"
echo "══════════════════════════════════════════════"
echo ""

# ── 1. Backup de seguridad
BACKUP_DIR=".fix-backup-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp "$SERVICE" "$BACKUP_DIR/api-keys.service.ts.bak"
cp "$GUARD"   "$BACKUP_DIR/api-key-auth.guard.ts.bak"
ok "Backups en $BACKUP_DIR/"

# ── 2. Verificar que el método se llame 'validate' en el servicio
if grep -q "async validateApiKey" "$SERVICE"; then
  warn "El servicio ya tiene 'validateApiKey'. Verificando el guard..."
  if grep -q "\.validateApiKey(" "$GUARD"; then
    ok "Guard y servicio ya están alineados — sin cambios necesarios"
    echo ""
    echo "Probá: pnpm run build"
    exit 0
  fi
fi

# ── 3. Renombrar validate → validateApiKey en el servicio
#    Solo el método público (async validate), no afecta variables internas
if grep -q "async validate(" "$SERVICE"; then
  # Reemplazar la firma del método
  sed -i 's/async validate(rawKey: string)/async validateApiKey(rawKey: string)/g' "$SERVICE"
  ok "Renombrado: async validate() → async validateApiKey() en $SERVICE"
else
  warn "No se encontró 'async validate(' en $SERVICE — revisá manualmente"
fi

# ── 4. Verificar que el guard ya llame validateApiKey (no debería necesitar cambio)
if grep -q "\.validateApiKey(" "$GUARD"; then
  ok "Guard ya llama .validateApiKey() correctamente"
else
  warn "El guard NO llama .validateApiKey() — revisando..."
  # Si el guard llama .validate( en lugar de .validateApiKey(
  if grep -q "\.validate(" "$GUARD"; then
    sed -i 's/\.validate(rawKey)/\.validateApiKey(rawKey)/g' "$GUARD"
    ok "Guard actualizado: .validate() → .validateApiKey()"
  else
    err "El guard no llama ni .validate() ni .validateApiKey() — revisá $GUARD manualmente"
  fi
fi

# ── 5. Validar que los cambios quedaron bien
echo ""
echo "── Verificación post-fix ──"
grep -n "validateApiKey" "$SERVICE" | head -5 && ok "Método en servicio OK"
grep -n "validateApiKey" "$GUARD"   | head -3 && ok "Llamada en guard OK"

# ── 6. Build de verificación
echo ""
echo "── Ejecutando pnpm run build ──"
if pnpm run build; then
  echo ""
  ok "✅ Build exitoso — error corregido"
else
  echo ""
  err "Build falló — revisá los errores arriba. Tus backups están en $BACKUP_DIR/"
fi