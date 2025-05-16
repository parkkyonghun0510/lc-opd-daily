import logging
import json
from datetime import datetime
import traceback
from typing import Dict, Any, Optional

class StructuredLogFormatter(logging.Formatter):
    """
    Custom formatter that outputs logs in a structured JSON format.
    """
    def format(self, record):
        log_data = {
            "timestamp": datetime.now().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # Add exception info if available
        if record.exc_info:
            log_data["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "traceback": traceback.format_exception(*record.exc_info)
            }
            
        # Add extra fields if available
        if hasattr(record, "extra") and record.extra:
            log_data.update(record.extra)
            
        return json.dumps(log_data)

def setup_structured_logger(name: str) -> logging.Logger:
    """
    Set up a logger with structured JSON formatting.
    
    Args:
        name: The name of the logger
        
    Returns:
        A configured logger instance
    """
    logger = logging.getLogger(name)
    
    # Only add handler if it doesn't already have one
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(StructuredLogFormatter())
        logger.addHandler(handler)
        
    return logger

def log_with_context(
    logger: logging.Logger, 
    level: int, 
    message: str, 
    context: Optional[Dict[str, Any]] = None,
    exc_info=None
):
    """
    Log a message with additional context data.
    
    Args:
        logger: The logger instance
        level: The log level (e.g., logging.INFO)
        message: The log message
        context: Additional context data to include in the log
        exc_info: Exception information to include
    """
    extra = {"extra": context or {}}
    logger.log(level, message, extra=extra, exc_info=exc_info)
