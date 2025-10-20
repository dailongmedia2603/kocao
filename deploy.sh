# Kocao API - Simple Deploy Script
echo "Starting Kocao API deployment..."

# Ensure we run from script directory to get correct relative paths
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Update system
echo "Updating system packages..."
apt update && apt upgrade -y

# Install Python and pip
echo "Installing Python..."
apt install -y python3 python3-pip python3-venv

# Install Node.js for PM2
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install PM2
echo "Installing PM2..."
npm install -g pm2

# Create virtual environment
echo "Setting up virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install dependencies
echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Create logs directory
mkdir -p logs

# Start with PM2
echo "Starting application with PM2..."
# Use full path to ecosystem to avoid CWD issues when resurrecting
pm2 start "$SCRIPT_DIR/ecosystem.config.js"

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup -u root --hp /root

echo "Deployment completed!"
echo "Check status: pm2 status"
echo "View logs: pm2 logs kocao"
echo "API running at: http://localhost:8000"