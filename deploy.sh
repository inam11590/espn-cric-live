#!/usr/bin/env bash
# ==============================================================================
# CricStream Live - Automated Production Deployment & SSL Orchestration Script
# ==============================================================================
set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${CYAN}"
echo "===================================================================="
echo "    🏏 CricStream Live - Production Deployment & SSL Setup         "
echo "===================================================================="
echo -e "${NC}"

# 1. Verify Prerequisites
command -v docker >/dev/null 2>&1 || {
    echo -e "${RED}[ERROR] Docker is not installed. Please install Docker first.${NC}" >&2
    exit 1
}

if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker-compose"
else
    echo -e "${RED}[ERROR] Docker Compose is not installed.${NC}" >&2
    exit 1
fi

echo -e "${GREEN}[✓] Docker and Docker Compose verified.${NC}"

# 2. Check or Create .env.production
ENV_FILE=".env.production"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}[!] No .env.production file found. Initializing interactive setup...${NC}"
    
    read -p "Enter your Domain Name (e.g., live.yourdomain.com): " DOMAIN_NAME
    read -p "Enter Let's Encrypt Admin Email for SSL renewal: " LETSENCRYPT_EMAIL
    read -p "Enter Admin Dashboard Username [default: admin]: " ADMIN_USERNAME
    ADMIN_USERNAME=${ADMIN_USERNAME:-admin}
    read -sp "Enter Admin Dashboard Password [default: CricStream#2026]: " ADMIN_PASSWORD
    echo ""
    ADMIN_PASSWORD=${ADMIN_PASSWORD:-CricStream#2026}

    # Generate secure 64-char JWT secret key
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))")

    cat <<EOF > "$ENV_FILE"
DOMAIN_NAME=${DOMAIN_NAME}
LETSENCRYPT_EMAIL=${LETSENCRYPT_EMAIL}
ADMIN_USERNAME=${ADMIN_USERNAME}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
JWT_SECRET_KEY=${JWT_SECRET}
DATABASE_URL=sqlite:////app/data/cricket.db
DEBUG=false
HOST=0.0.0.0
PORT=8000
SCRAPE_INTERVAL_SECONDS=20
SCRAPE_TIMEOUT_SECONDS=25
CACHE_LIVE_TTL=20
CACHE_DETAIL_TTL=86400
ACCESS_TOKEN_EXPIRE_MINUTES=1440
EOF
    echo -e "${GREEN}[✓] Generated .env.production successfully.${NC}"
else
    echo -e "${GREEN}[✓] Existing .env.production loaded.${NC}"
fi

# Load environment variables
set -a
source "$ENV_FILE"
set +a

if [ -z "$DOMAIN_NAME" ] || [ -z "$LETSENCRYPT_EMAIL" ]; then
    echo -e "${RED}[ERROR] DOMAIN_NAME and LETSENCRYPT_EMAIL must be set in .env.production${NC}"
    exit 1
fi

echo -e "${CYAN}[*] Target Domain: ${DOMAIN_NAME}${NC}"
echo -e "${CYAN}[*] Admin User:   ${ADMIN_USERNAME}${NC}"

# 3. Bootstrap Dummy Self-Signed SSL Certificate (prevents Nginx boot failure)
echo -e "${CYAN}[*] Checking SSL certificates volume...${NC}"
$DOCKER_COMPOSE -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true

# Create temporary container to initialize dummy certificate in the certbot_conf volume
docker volume create espncric_certbot_conf 2>/dev/null || true
docker volume create espncric_certbot_www 2>/dev/null || true

docker run --rm \
    -v espncric_certbot_conf:/etc/letsencrypt \
    alpine sh -c "
        if [ ! -f /etc/letsencrypt/live/live-cert/fullchain.pem ]; then
            echo 'Bootstrapping temporary self-signed SSL cert for initial Nginx launch...'
            mkdir -p /etc/letsencrypt/live/live-cert
            apk add --no-cache openssl >/dev/null 2>&1
            openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
                -keyout /etc/letsencrypt/live/live-cert/privkey.pem \
                -out /etc/letsencrypt/live/live-cert/fullchain.pem \
                -subj '/CN=localhost' >/dev/null 2>&1
        fi
    "

echo -e "${GREEN}[✓] SSL certificate bootstrap ready.${NC}"

# 4. Build and Start Application Stack
echo -e "${CYAN}[*] Building and starting multi-container application stack...${NC}"
$DOCKER_COMPOSE -f docker-compose.prod.yml up -d --build

# 5. Acquire Genuine Let's Encrypt Certificate via Certbot
echo -e "${CYAN}[*] Requesting Let's Encrypt certificate for ${DOMAIN_NAME}...${NC}"
set +e
$DOCKER_COMPOSE -f docker-compose.prod.yml run --rm --entrypoint "\
    certbot certonly --webroot -w /var/www/certbot \
    --email ${LETSENCRYPT_EMAIL} \
    -d ${DOMAIN_NAME} \
    --rsa-key-size 4096 \
    --agree-tos \
    --force-renewal \
    --non-interactive" certbot

CERTBOT_EXIT=$?
set -e

if [ $CERTBOT_EXIT -eq 0 ]; then
    echo -e "${GREEN}[✓] Real Let's Encrypt SSL certificate acquired! Linking to Nginx...${NC}"
    # Replace dummy certs with genuine certificates
    docker run --rm \
        -v espncric_certbot_conf:/etc/letsencrypt \
        alpine sh -c "
            mkdir -p /etc/letsencrypt/live/live-cert
            cp -L /etc/letsencrypt/live/${DOMAIN_NAME}/fullchain.pem /etc/letsencrypt/live/live-cert/fullchain.pem
            cp -L /etc/letsencrypt/live/${DOMAIN_NAME}/privkey.pem /etc/letsencrypt/live/live-cert/privkey.pem
        "
    # Reload Nginx gateway
    $DOCKER_COMPOSE -f docker-compose.prod.yml exec nginx nginx -s reload
    echo -e "${GREEN}[✓] Nginx gateway reloaded with genuine Let's Encrypt SSL certificates.${NC}"
else
    echo -e "${YELLOW}[!] Notice: Real SSL acquisition skipped or failed (common if DNS is not yet pointing to this server IP).${NC}"
    echo -e "${YELLOW}    Application is currently running with the bootstrap certificate on HTTPS.${NC}"
fi

echo ""
echo -e "${GREEN}====================================================================${NC}"
echo -e "${GREEN}    🚀 CricStream Live is Deployed and Running!                    ${NC}"
echo -e "${GREEN}====================================================================${NC}"
echo -e "Public Match Center:    ${CYAN}https://${DOMAIN_NAME}/${NC}"
echo -e "Admin Stream Dashboard: ${CYAN}https://${DOMAIN_NAME}/admin${NC}"
echo -e "Interactive API Docs:   ${CYAN}https://${DOMAIN_NAME}/docs${NC}"
echo -e "Admin Username:         ${YELLOW}${ADMIN_USERNAME}${NC}"
echo -e "Health Check:           ${CYAN}https://${DOMAIN_NAME}/api/v1/health${NC}"
echo ""
echo "Manage stack:"
echo "  Stop:   $DOCKER_COMPOSE -f docker-compose.prod.yml down"
echo "  Logs:   $DOCKER_COMPOSE -f docker-compose.prod.yml logs -f"
echo "  Status: $DOCKER_COMPOSE -f docker-compose.prod.yml ps"
echo "===================================================================="
