import time
from collections import defaultdict
from typing import Dict, Tuple


class RateLimiter:
    """
    A simple in-memory rate limiter that limits requests based on a key (e.g., IP address)
    within a specified time frame.
    
    This implementation is suitable for single-instance applications. For distributed systems,
    consider using Redis or another shared storage solution.
    """
    
    def __init__(self, max_calls: int, time_frame: int):
        """
        Initialize a rate limiter.
        
        Args:
            max_calls: Maximum number of calls allowed within the time frame
            time_frame: Time frame in seconds
        """
        self.max_calls = max_calls
        self.time_frame = time_frame
        # Store a list of timestamps for each key
        self._cache: Dict[str, list] = defaultdict(list)
        # Last cleanup time to periodically remove expired entries
        self._last_cleanup = time.time()
        # Cleanup frequency (every 10 minutes)
        self._cleanup_interval = 600
    
    def check(self, key: str) -> bool:
        """
        Check if the request is allowed based on the rate limit.
        
        Args:
            key: The key to rate limit (e.g., IP address, user ID)
        
        Returns:
            bool: True if the request is allowed, False otherwise
        """
        now = time.time()
        
        # Periodically clean up expired entries
        if now - self._last_cleanup > self._cleanup_interval:
            self._cleanup(now)
        
        # Remove timestamps that are outside the time frame
        self._cache[key] = [
            timestamp for timestamp in self._cache[key] 
            if now - timestamp <= self.time_frame
        ]
        
        # Check if the number of recent calls exceeds the limit
        if len(self._cache[key]) >= self.max_calls:
            return False
        
        # Add current timestamp to the list
        self._cache[key].append(now)
        return True
    
    def _cleanup(self, now: float) -> None:
        """
        Remove expired entries from the cache to prevent memory leaks.
        
        Args:
            now: Current timestamp
        """
        # Get keys to delete (with no recent activity)
        keys_to_delete = []
        for key, timestamps in self._cache.items():
            valid_timestamps = [ts for ts in timestamps if now - ts <= self.time_frame]
            if not valid_timestamps:
                keys_to_delete.append(key)
            else:
                self._cache[key] = valid_timestamps
        
        # Delete expired keys
        for key in keys_to_delete:
            del self._cache[key]
        
        # Update last cleanup time
        self._last_cleanup = now
