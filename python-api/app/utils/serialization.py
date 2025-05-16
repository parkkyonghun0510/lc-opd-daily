from typing import List, Dict, Any, Optional, Union
from datetime import datetime, date
from sqlalchemy.orm import Query
from sqlalchemy.ext.declarative import DeclarativeMeta

def serialize_sqlalchemy_obj(obj: Any) -> Dict[str, Any]:
    """
    Serialize a SQLAlchemy model instance to a dictionary.
    Handles nested relationships and common data types.
    
    Args:
        obj: SQLAlchemy model instance
        
    Returns:
        Dictionary representation of the model
    """
    if obj is None:
        return None
        
    if isinstance(obj, (str, int, float, bool)) or obj is None:
        return obj
        
    if isinstance(obj, datetime):
        return obj.isoformat()
        
    if isinstance(obj, date):
        return obj.isoformat()
        
    if isinstance(obj, list):
        return [serialize_sqlalchemy_obj(item) for item in obj]
        
    if isinstance(obj, dict):
        return {key: serialize_sqlalchemy_obj(value) for key, value in obj.items()}
    
    # Handle SQLAlchemy model instances
    if hasattr(obj, '__table__'):
        data = {}
        for column in obj.__table__.columns:
            value = getattr(obj, column.name)
            data[column.name] = serialize_sqlalchemy_obj(value)
            
        # Handle relationships
        for relationship_name in getattr(obj, '__mapper__').relationships.keys():
            # Only include loaded relationships
            if relationship_name in obj.__dict__:
                relationship_value = getattr(obj, relationship_name)
                data[relationship_name] = serialize_sqlalchemy_obj(relationship_value)
                
        return data
        
    # Fallback for other types
    return str(obj)

def serialize_query_results(results: Union[List[Any], Query]) -> List[Dict[str, Any]]:
    """
    Serialize a list of SQLAlchemy model instances to a list of dictionaries.
    
    Args:
        results: List of SQLAlchemy model instances or SQLAlchemy Query object
        
    Returns:
        List of dictionary representations of the models
    """
    if isinstance(results, Query):
        results = results.all()
        
    return [serialize_sqlalchemy_obj(item) for item in results]
