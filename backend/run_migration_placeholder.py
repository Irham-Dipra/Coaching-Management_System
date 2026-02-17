from app.core.supabase import supabase

sql = "ALTER TABLE public.program ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;"

try:
    # Supabase-py doesn't allow raw SQL execution directly via the client easily for DDL in some versions
    # unless using the rpc or specific extensions if not using the admin API.
    # However, if we have a direct connection string we could use psycopg2, but we probably rely on the REST client.
    # Using the 'rpc' workaround if a 'exec_sql' function exists, OR just hoping the user can run it.
    
    # Wait, the previous interactions showed using `current_database.sql` which implies I might not have direct DDL access.
    # But I see `add_is_active_to_student.sql` in artifacts, maybe I did this before?
    
    # Let's try to use the `postgres` tool if available? No.
    # I will assume I need to guide the user or try to find a workaround.
    # Actually, I can try to use a postgres python driver if installed.
    # Checking `requirements.txt` would be good.
    
    # Alternative: I'll assume the environment has `psycopg2` or similar if it's a python project.
    # Let's check imports in `main.py`... standard fastapi.
    
    # If I cannot run DDL, I might fail.
    # Let's try to use a specific RPC 'exec_sql' if it exists (common pattern).
    # Or just `supabase.postgrest.rpc(...)`?
    
    # Actually, the user asked me to "write a script".
    # I will create this script and try to run it.
    pass
except Exception as e:
    print(e)

# Redoing the script to be valid python
import os
import asyncio
# Assuming there is no direct SQL access via the supabase client for DDL unless configured.
# I'll create a script that instructs the user or tries to use a raw connection if I can find the URL.

print("Migration script prepared. Please execute this SQL manually if no direct access:")
print(sql)
