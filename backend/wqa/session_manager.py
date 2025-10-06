import uuid
import shutil
from pathlib import Path
from datetime import datetime, timedelta
from threading import Lock
import json
import logging
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)

class SessionManager:
    _instance = None
    _lock = Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
            
        self.base_sessions_dir = Path("media/temp/sessions")
        self.sessions_file = self.base_sessions_dir / "active_sessions.json"
        self.lock = Lock()
        
        # Session timeout settings
        self.default_timeout_minutes = 30  # 30 minutes timeout
        self.cleanup_interval_minutes = 5   # Check for expired sessions every 5 minutes
        
        self.base_sessions_dir.mkdir(parents=True, exist_ok=True)
        self._load_sessions()
        self._initialized = True
        
        # Cleanup expired sessions on startup
        self.cleanup_expired_sessions()
    
    def _load_sessions(self):
        if self.sessions_file.exists():
            try:
                with open(self.sessions_file, 'r') as f:
                    data = json.load(f)
                    self.sessions = {}
                    for k, v in data.items():
                        self.sessions[k] = {
                            **v, 
                            'created_at': datetime.fromisoformat(v['created_at']),
                            'expires_at': datetime.fromisoformat(v['expires_at'])
                        }
            except Exception as e:
                logger.error(f"Failed to load sessions: {e}")
                self.sessions = {}
        else:
            self.sessions = {}
    
    def _save_sessions(self):
        try:
            data = {}
            for k, v in self.sessions.items():
                data[k] = {
                    **v, 
                    'created_at': v['created_at'].isoformat(),
                    'expires_at': v['expires_at'].isoformat()
                }
            with open(self.sessions_file, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save sessions: {e}")
    
    def create_session(self, user_id=None, year=None, timeout_minutes=None):
        """Create new session with 30-minute timeout"""
        if timeout_minutes is None:
            timeout_minutes = self.default_timeout_minutes
            
        session_id = str(uuid.uuid4())
        
        with self.lock:
            # Create session directory structure
            session_root = self.base_sessions_dir / session_id
            temp_dir = session_root / "temp"
            output_dir = session_root / "output"
            interpolated_dir = session_root / "interpolated_rasters"
            
            if year:
                output_dir = output_dir / str(year)
            
            # Create all directories
            temp_dir.mkdir(parents=True, exist_ok=True)
            output_dir.mkdir(parents=True, exist_ok=True)
            interpolated_dir.mkdir(parents=True, exist_ok=True)
            
            # Set expiration to 30 minutes from now
            created_at = datetime.now()
            expires_at = created_at + timedelta(minutes=timeout_minutes)
            
            self.sessions[session_id] = {
                'id': session_id,
                'user_id': user_id,
                'year': year,
                'created_at': created_at,
                'expires_at': expires_at,
                'last_accessed': created_at,
                'temp_dir': str(temp_dir),
                'output_dir': str(output_dir),
                'interpolated_dir': str(interpolated_dir),
                'session_root': str(session_root),
                'status': 'active',
                'timeout_minutes': timeout_minutes
            }
            
            self._save_sessions()
            
            logger.info(f"Created session {session_id} with {timeout_minutes}min timeout")
            logger.info(f"Session structure: temp={temp_dir}, output={output_dir}, interpolated={interpolated_dir}")
            return session_id
    
    def get_session(self, session_id):
        """Get session if it exists and is not expired"""
        with self.lock:
            if session_id not in self.sessions:
                raise ValueError(f"Session {session_id} not found")
            
            session = self.sessions[session_id]
            
            # Check if session is expired
            if datetime.now() > session['expires_at']:
                logger.info(f"Session {session_id} has expired, cleaning up")
                self.cleanup_session(session_id)
                raise ValueError(f"Session {session_id} has expired")
            
            # Update last accessed time
            session['last_accessed'] = datetime.now()
            self._save_sessions()
            
            return session.copy()
    
    def get_paths(self, session_id):
        """Get session paths if session is valid"""
        session = self.get_session(session_id)
        return {
            'temp_dir': Path(session['temp_dir']),
            'output_dir': Path(session['output_dir']),
            'interpolated_dir': Path(session['interpolated_dir']),
            'session_root': Path(session['session_root']),
            'session_id': session_id
        }
    
    def is_session_expired(self, session_id):
        """Check if session has expired"""
        if session_id not in self.sessions:
            return True
            
        session = self.sessions[session_id]
        return datetime.now() > session['expires_at']
    
    def extend_session(self, session_id, additional_minutes=None):
        """Extend session expiration time"""
        if additional_minutes is None:
            additional_minutes = self.default_timeout_minutes
            
        with self.lock:
            if session_id in self.sessions:
                current_time = datetime.now()
                new_expires = current_time + timedelta(minutes=additional_minutes)
                
                self.sessions[session_id]['expires_at'] = new_expires
                self.sessions[session_id]['last_accessed'] = current_time
                self._save_sessions()
                
                logger.info(f"Extended session {session_id} by {additional_minutes} minutes")
                return new_expires
        return None
    
    def get_session_time_remaining(self, session_id):
        """Get remaining time for session in minutes"""
        if session_id not in self.sessions:
            return 0
        
        expires_at = self.sessions[session_id]['expires_at']
        remaining = expires_at - datetime.now()
        return max(0, remaining.total_seconds() / 60)  # Return minutes
    
    def cleanup_session(self, session_id):
        """Clean up specific session - removes entire session directory tree"""
        with self.lock:
            if session_id not in self.sessions:
                logger.warning(f"Session {session_id} not found for cleanup")
                return False
            
            session = self.sessions[session_id]
            session_root = Path(session['session_root'])
            
            # Remove entire session directory tree
            try:
                if session_root.exists():
                    shutil.rmtree(session_root)
                    logger.info(f"Removed session directory tree: {session_root}")
            except Exception as e:
                logger.error(f"Failed to remove session directory {session_root}: {e}")
            
            # Remove from active sessions
            del self.sessions[session_id]
            self._save_sessions()
            
            logger.info(f"Session {session_id} cleaned up successfully")
            return True
    
    def cleanup_expired_sessions(self):
        """Clean up all expired sessions automatically"""
        expired_sessions = []
        current_time = datetime.now()
        
        with self.lock:
            for session_id, session in self.sessions.items():
                if current_time > session['expires_at']:
                    expired_sessions.append(session_id)
        
        cleanup_count = 0
        for session_id in expired_sessions:
            try:
                self.cleanup_session(session_id)
                cleanup_count += 1
                logger.info(f"Auto-cleaned expired session: {session_id}")
            except Exception as e:
                logger.error(f"Failed to cleanup expired session {session_id}: {e}")
        
        if cleanup_count > 0:
            logger.info(f"Cleaned up {cleanup_count} expired sessions")
        
        return cleanup_count
    
    def cleanup_old_sessions(self, max_age_minutes=None):
        """Clean up sessions older than specified minutes"""
        if max_age_minutes is None:
            max_age_minutes = self.default_timeout_minutes
            
        cutoff = datetime.now() - timedelta(minutes=max_age_minutes)
        sessions_to_cleanup = []
        
        with self.lock:
            for session_id, session in self.sessions.items():
                if session['created_at'] < cutoff:
                    sessions_to_cleanup.append(session_id)
        
        cleanup_count = 0
        for session_id in sessions_to_cleanup:
            try:
                self.cleanup_session(session_id)
                cleanup_count += 1
            except Exception as e:
                logger.error(f"Failed to cleanup old session {session_id}: {e}")
        
        return cleanup_count
    
    def cleanup_all_sessions(self):
        """Emergency cleanup - remove all sessions"""
        with self.lock:
            session_ids = list(self.sessions.keys())
        
        cleanup_count = 0
        for session_id in session_ids:
            try:
                self.cleanup_session(session_id)
                cleanup_count += 1
            except Exception as e:
                logger.error(f"Failed to cleanup session {session_id}: {e}")
        
        logger.warning(f"Emergency cleanup: removed {cleanup_count} sessions")
        return cleanup_count
    
    def get_session_stats(self):
        """Get statistics about active sessions"""
        with self.lock:
            now = datetime.now()
            stats = {
                'total_sessions': len(self.sessions),
                'sessions_by_age': {'< 5min': 0, '5-15min': 0, '15-30min': 0, '> 30min': 0},
                'sessions_by_expiry': {'< 5min': 0, '5-15min': 0, '15-30min': 0, 'expired': 0},
                'oldest_session': None,
                'newest_session': None,
                'expired_count': 0
            }
            
            if self.sessions:
                ages = []
                expiry_times = []
                
                for session in self.sessions.values():
                    # Calculate age
                    age_minutes = (now - session['created_at']).total_seconds() / 60
                    ages.append(age_minutes)
                    
                    # Calculate time until expiry
                    expiry_minutes = (session['expires_at'] - now).total_seconds() / 60
                    expiry_times.append(expiry_minutes)
                    
                    # Categorize by age
                    if age_minutes < 5:
                        stats['sessions_by_age']['< 5min'] += 1
                    elif age_minutes < 15:
                        stats['sessions_by_age']['5-15min'] += 1
                    elif age_minutes < 30:
                        stats['sessions_by_age']['15-30min'] += 1
                    else:
                        stats['sessions_by_age']['> 30min'] += 1
                    
                    # Categorize by expiry time
                    if expiry_minutes < 0:
                        stats['sessions_by_expiry']['expired'] += 1
                        stats['expired_count'] += 1
                    elif expiry_minutes < 5:
                        stats['sessions_by_expiry']['< 5min'] += 1
                    elif expiry_minutes < 15:
                        stats['sessions_by_expiry']['5-15min'] += 1
                    elif expiry_minutes < 30:
                        stats['sessions_by_expiry']['15-30min'] += 1
                
                stats['oldest_session'] = f"{max(ages):.1f} min"
                stats['newest_session'] = f"{min(ages):.1f} min"
            
            return stats
    
    def get_active_sessions(self):
        """Get list of all active (non-expired) sessions"""
        active_sessions = []
        current_time = datetime.now()
        
        with self.lock:
            for session_id, session in self.sessions.items():
                if current_time <= session['expires_at']:
                    session_info = session.copy()
                    session_info['time_remaining_minutes'] = (
                        session['expires_at'] - current_time
                    ).total_seconds() / 60
                    active_sessions.append(session_info)
        
        return active_sessions

# Global instance
session_manager = SessionManager()

# Django Management Command Class
class CleanupSessionsCommand(BaseCommand):
    """Django management command for session cleanup"""
    help = 'Cleanup old GWQI sessions'

    def add_arguments(self, parser):
        parser.add_argument('--minutes', type=int, default=30, 
                          help='Age in minutes for cleanup (default: 30)')
        parser.add_argument('--expired-only', action='store_true',
                          help='Clean only expired sessions')
        parser.add_argument('--all', action='store_true', 
                          help='Clean all sessions (emergency)')
        parser.add_argument('--stats', action='store_true', 
                          help='Show session statistics')

    def handle(self, *args, **options):
        if options['stats']:
            stats = session_manager.get_session_stats()
            self.stdout.write("Session Statistics:")
            self.stdout.write(f"  Total: {stats['total_sessions']}")
            self.stdout.write(f"  By age: {stats['sessions_by_age']}")
            self.stdout.write(f"  By expiry: {stats['sessions_by_expiry']}")
            if stats['oldest_session']:
                self.stdout.write(f"  Oldest: {stats['oldest_session']}")
                self.stdout.write(f"  Newest: {stats['newest_session']}")
            self.stdout.write(f"  Expired: {stats['expired_count']}")
            return
        
        if options['all']:
            count = session_manager.cleanup_all_sessions()
            self.stdout.write(
                self.style.WARNING(f'Emergency cleanup: removed ALL {count} sessions')
            )
        elif options['expired_only']:
            count = session_manager.cleanup_expired_sessions()
            self.stdout.write(
                self.style.SUCCESS(f'Cleaned {count} expired sessions')
            )
        else:
            minutes = options['minutes']
            count = session_manager.cleanup_old_sessions(max_age_minutes=minutes)
            self.stdout.write(
                self.style.SUCCESS(f'Cleaned {count} sessions older than {minutes} minutes')
            )

# Periodic cleanup function (can be called by cron or Celery)
def periodic_session_cleanup():
    """Function to be called periodically for automatic cleanup"""
    try:
        expired_count = session_manager.cleanup_expired_sessions()
        old_count = session_manager.cleanup_old_sessions(max_age_minutes=60)  # Clean 1hr+ old
        
        if expired_count > 0 or old_count > 0:
            logger.info(f"Periodic cleanup: {expired_count} expired, {old_count} old sessions")
        
        return expired_count + old_count
    except Exception as e:
        logger.error(f"Periodic cleanup failed: {e}")
        return 0