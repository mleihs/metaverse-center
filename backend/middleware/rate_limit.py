from slowapi import Limiter
from slowapi.util import get_remote_address

# Rate limiter instance using client IP as key
limiter = Limiter(key_func=get_remote_address)

# Rate limit constants
RATE_LIMIT_AI_GENERATION = "120/hour"
RATE_LIMIT_AI_CHAT = "10/minute"
RATE_LIMIT_EXTERNAL_API = "5/minute"
RATE_LIMIT_STANDARD = "100/minute"
RATE_LIMIT_AI_ENTITY = "360/hour"
RATE_LIMIT_ADMIN_MUTATION = "10/minute"
