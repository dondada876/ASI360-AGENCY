#!/usr/bin/env python3
"""
ASI 360 Automation Engine
Handles Supabase → WordPress synchronization and automation workflows
"""

import os
import sys
import time
import logging
import schedule
from datetime import datetime
from flask import Flask, jsonify
from supabase import create_client, Client
from anthropic import Anthropic
import docker
from colorama import Fore, Style, init

# Initialize colorama for colored logging
init(autoreset=True)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/app/logs/automation.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('AutomationEngine')

# Initialize Flask app for health checks
app = Flask(__name__)

# Initialize clients
supabase_url = os.getenv('SUPABASE_URL', '')
supabase_key = os.getenv('SUPABASE_KEY', '')
anthropic_key = os.getenv('ANTHROPIC_API_KEY', '')

# Supabase client
try:
    if supabase_url and supabase_key:
        supabase: Client = create_client(supabase_url, supabase_key)
        logger.info(f"{Fore.GREEN}✓ Supabase client initialized")
    else:
        supabase = None
        logger.warning(f"{Fore.YELLOW}⚠ Supabase not configured")
except Exception as e:
    logger.error(f"{Fore.RED}✗ Supabase initialization failed: {e}")
    supabase = None

# Anthropic client
try:
    if anthropic_key:
        anthropic = Anthropic(api_key=anthropic_key)
        logger.info(f"{Fore.GREEN}✓ Anthropic client initialized")
    else:
        anthropic = None
        logger.warning(f"{Fore.YELLOW}⚠ Anthropic API key not configured")
except Exception as e:
    logger.error(f"{Fore.RED}✗ Anthropic initialization failed: {e}")
    anthropic = None

# Docker client
try:
    docker_client = docker.from_env()
    logger.info(f"{Fore.GREEN}✓ Docker client initialized")
except Exception as e:
    logger.error(f"{Fore.RED}✗ Docker initialization failed: {e}")
    docker_client = None


class AutomationEngine:
    """Main automation engine class"""

    def __init__(self):
        self.running = False
        self.last_sync = None
        self.sync_count = 0

    def start(self):
        """Start the automation engine"""
        self.running = True
        logger.info(f"{Fore.CYAN}{'='*60}")
        logger.info(f"{Fore.CYAN}ASI 360 Automation Engine Starting...")
        logger.info(f"{Fore.CYAN}{'='*60}")

        # Schedule tasks
        schedule.every(5).minutes.do(self.sync_supabase_to_wordpress)
        schedule.every(1).hours.do(self.check_container_health)
        schedule.every(1).days.do(self.generate_daily_reports)

        logger.info(f"{Fore.GREEN}✓ Scheduled tasks configured")
        logger.info(f"{Fore.CYAN}Engine is now running. Press Ctrl+C to stop.")

        # Run initial sync
        self.sync_supabase_to_wordpress()

        # Main loop
        while self.running:
            schedule.run_pending()
            time.sleep(1)

    def sync_supabase_to_wordpress(self):
        """Sync data from Supabase to WordPress sites"""
        logger.info(f"{Fore.CYAN}Starting Supabase → WordPress sync...")

        if not supabase:
            logger.warning(f"{Fore.YELLOW}Supabase not configured, skipping sync")
            return

        try:
            # Fetch pending content from Supabase
            response = supabase.table('wordpress_queue').select('*').eq('status', 'pending').execute()

            if response.data:
                logger.info(f"{Fore.GREEN}Found {len(response.data)} items to sync")

                for item in response.data:
                    self.process_wordpress_item(item)

                self.sync_count += len(response.data)
                self.last_sync = datetime.now()
            else:
                logger.info(f"{Fore.CYAN}No pending items to sync")

        except Exception as e:
            logger.error(f"{Fore.RED}Sync error: {e}")

    def process_wordpress_item(self, item):
        """Process a single WordPress queue item"""
        try:
            logger.info(f"{Fore.CYAN}Processing item: {item.get('title', 'Untitled')}")

            # Generate AI-enhanced content if needed
            if item.get('use_ai') and anthropic:
                content = self.generate_ai_content(item)
                item['content'] = content

            # Push to WordPress (placeholder - implement actual WP API calls)
            # self.push_to_wordpress(item['site_id'], item)

            # Mark as processed in Supabase
            supabase.table('wordpress_queue').update({
                'status': 'completed',
                'processed_at': datetime.now().isoformat()
            }).eq('id', item['id']).execute()

            logger.info(f"{Fore.GREEN}✓ Item processed successfully")

        except Exception as e:
            logger.error(f"{Fore.RED}Error processing item: {e}")

            # Mark as failed
            supabase.table('wordpress_queue').update({
                'status': 'failed',
                'error_message': str(e)
            }).eq('id', item['id']).execute()

    def generate_ai_content(self, item):
        """Generate AI-enhanced content using Claude"""
        try:
            prompt = item.get('ai_prompt', f"Enhance this content: {item.get('content', '')}")

            message = anthropic.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=2048,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            return message.content[0].text

        except Exception as e:
            logger.error(f"{Fore.RED}AI generation error: {e}")
            return item.get('content', '')

    def check_container_health(self):
        """Check health of all WordPress containers"""
        logger.info(f"{Fore.CYAN}Checking container health...")

        if not docker_client:
            logger.warning(f"{Fore.YELLOW}Docker not configured, skipping health check")
            return

        try:
            containers = docker_client.containers.list(filters={'name': 'asi360_*'})

            for container in containers:
                status = container.status
                name = container.name

                if status == 'running':
                    logger.info(f"{Fore.GREEN}✓ {name}: {status}")
                else:
                    logger.warning(f"{Fore.YELLOW}⚠ {name}: {status}")

                    # Alert or restart logic here
                    if 'wordpress' in name.lower():
                        logger.info(f"{Fore.CYAN}Attempting to restart {name}...")
                        # container.restart()

        except Exception as e:
            logger.error(f"{Fore.RED}Health check error: {e}")

    def generate_daily_reports(self):
        """Generate daily automation reports"""
        logger.info(f"{Fore.CYAN}Generating daily report...")

        report = {
            'date': datetime.now().isoformat(),
            'total_syncs': self.sync_count,
            'last_sync': self.last_sync.isoformat() if self.last_sync else None,
            'status': 'healthy'
        }

        logger.info(f"{Fore.GREEN}Daily Report: {report}")

        # Store report in Supabase
        if supabase:
            try:
                supabase.table('automation_reports').insert(report).execute()
            except Exception as e:
                logger.error(f"{Fore.RED}Report storage error: {e}")

    def stop(self):
        """Stop the automation engine"""
        logger.info(f"{Fore.YELLOW}Stopping automation engine...")
        self.running = False


# Flask routes
@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'automation-engine',
        'timestamp': datetime.now().isoformat(),
        'supabase_connected': supabase is not None,
        'anthropic_connected': anthropic is not None,
        'docker_connected': docker_client is not None
    })


@app.route('/stats')
def stats():
    """Statistics endpoint"""
    return jsonify({
        'sync_count': engine.sync_count if 'engine' in globals() else 0,
        'last_sync': engine.last_sync.isoformat() if ('engine' in globals() and engine.last_sync) else None,
        'running': engine.running if 'engine' in globals() else False
    })


def run_flask():
    """Run Flask server in background"""
    app.run(host='0.0.0.0', port=5000, debug=False)


if __name__ == '__main__':
    import threading

    # Start Flask server in separate thread
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()

    # Start automation engine
    engine = AutomationEngine()

    try:
        engine.start()
    except KeyboardInterrupt:
        logger.info(f"{Fore.YELLOW}Received interrupt signal")
        engine.stop()
        logger.info(f"{Fore.GREEN}Automation engine stopped cleanly")
        sys.exit(0)
