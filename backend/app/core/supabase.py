import os
""" We use it to read sensitive information (like passwords)
    from your computer's environment variables,
    so we don't have to hardcode them in the script where everyone can see."""
from supabase import create_client, Client
#This pulls in the specific tools provided by Supabase.
# Client is the type of object we are creating,
# and create_client is the factory function that makes it.
from dotenv import load_dotenv
#This is a Python library that helps us load environment variables
# from a .env file.
load_dotenv()
#This line loads the environment variables from the .env file.
# It's a common practice to load environment variables at the start of a program.
from supabase import create_client, Client, ClientOptions

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")

# Increase timeout to prevent disconnects on large queries
# timeout is in seconds
supabase: Client = create_client(
    url, 
    key,
    options=ClientOptions(postgrest_client_timeout=60)
)

#1. Why use os.environ if we have a 
#.env
# file?
#This is a very clever trick we use to make our code work everywhere (on your laptop AND on a professional server).

#The Problem:
#On your LAPTOP, you keep secrets in a 
#.env
# file.
#On a REAL SERVER (like when we deploy this website later), there are no text files allowed for secrets (it's dangerous). Instead, servers have a special settings area called "Environment Variables".
#The Solution:
#Step 1: load_dotenv() looks for your 
#.env
# file. If it finds one, it reads the variables inside and injects them temporarily into Python's "invisible memory" (the Environment Variables).
#Step 2: os.environ.get("...") reads from that "invisible memory".
#So effectively:

#Locally: Code reads 
#.env
# $\rightarrow$ Memory $\rightarrow$ os.environ.get.
#On Server: Server sets Memory directly $\rightarrow$ os.environ.get.