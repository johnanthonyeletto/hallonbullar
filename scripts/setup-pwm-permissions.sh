#!/bin/bash
#
# Setup script for PWM permissions on Linux
#
# This script configures udev rules to allow users in the 'gpio' group
# to access PWM sysfs files without sudo.
#
# Run with: sudo bash scripts/setup-pwm-permissions.sh

set -e

UDEV_RULE_FILE="/etc/udev/rules.d/99-pwm.rules"
UDEV_RULE_CONTENT='SUBSYSTEM=="pwm*", PROGRAM="/bin/sh -c '\''chown -R root:gpio /sys/class/pwm && chmod -R 770 /sys/class/pwm; chown -R root:gpio /sys/devices/platform/soc/*.pwm/pwm/pwmchip* 2>/dev/null; chmod -R 770 /sys/devices/platform/soc/*.pwm/pwm/pwmchip* 2>/dev/null'\''"'

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root (use sudo)${NC}" >&2
    exit 1
fi

echo "Setting up PWM permissions..."

# Check if user is in gpio group
CURRENT_USER=${SUDO_USER:-$USER}
if [ -z "$CURRENT_USER" ]; then
    CURRENT_USER=$(logname 2>/dev/null || echo "")
fi

if [ -z "$CURRENT_USER" ]; then
    echo -e "${YELLOW}Warning: Could not determine current user. You may need to add yourself to the gpio group manually.${NC}"
else
    if groups "$CURRENT_USER" | grep -q "\bgpio\b"; then
        echo -e "${GREEN}✓ User $CURRENT_USER is already in the gpio group${NC}"
        IN_GPIO_GROUP=true
    else
        echo -e "${YELLOW}User $CURRENT_USER is not in the gpio group${NC}"
        IN_GPIO_GROUP=false
    fi
fi

# Check if udev rule already exists
if [ -f "$UDEV_RULE_FILE" ]; then
    if grep -q "SUBSYSTEM==\"pwm\"" "$UDEV_RULE_FILE"; then
        echo -e "${GREEN}✓ udev rule already exists at $UDEV_RULE_FILE${NC}"
        UDEV_RULE_EXISTS=true
    else
        echo -e "${YELLOW}udev rule file exists but doesn't contain PWM rules${NC}"
        UDEV_RULE_EXISTS=false
    fi
else
    echo -e "${YELLOW}udev rule does not exist${NC}"
    UDEV_RULE_EXISTS=false
fi

# Install udev rule if needed
if [ "$UDEV_RULE_EXISTS" = false ]; then
    echo "Installing udev rule..."
    echo "$UDEV_RULE_CONTENT" > "$UDEV_RULE_FILE"
    chmod 644 "$UDEV_RULE_FILE"
    echo -e "${GREEN}✓ udev rule installed at $UDEV_RULE_FILE${NC}"
    UDEV_NEEDS_RELOAD=true
else
    UDEV_NEEDS_RELOAD=false
fi

# Add user to gpio group if needed
if [ "$IN_GPIO_GROUP" = false ] && [ -n "$CURRENT_USER" ]; then
    echo "Adding user $CURRENT_USER to gpio group..."
    if ! getent group gpio > /dev/null 2>&1; then
        echo "Creating gpio group..."
        groupadd gpio
    fi
    usermod -aG gpio "$CURRENT_USER"
    echo -e "${GREEN}✓ User $CURRENT_USER added to gpio group${NC}"
    GROUP_ADDED=true
else
    GROUP_ADDED=false
fi

# Reload udev rules if needed
if [ "$UDEV_NEEDS_RELOAD" = true ]; then
    echo "Reloading udev rules..."
    udevadm control --reload-rules
    udevadm trigger
    echo -e "${GREEN}✓ udev rules reloaded${NC}"
fi

# Summary
echo ""
echo -e "${GREEN}Setup complete!${NC}"
echo ""

if [ "$GROUP_ADDED" = true ]; then
    echo -e "${YELLOW}IMPORTANT: You must log out and log back in for group membership to take effect.${NC}"
    echo ""
fi

echo "After logging back in, you should be able to use PWM without sudo."
echo ""
echo "To test, try:"
echo "  bun run your-pwm-script.ts"
echo ""
echo "If you still get permission errors, check:"
echo "  1. You logged out and back in after running this script"
echo "  2. The gpio group exists: getent group gpio"
echo "  3. You're in the gpio group: groups"
echo "  4. PWM chip exists: ls -la /sys/class/pwm/"
echo ""

