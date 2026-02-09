import asyncio
from app.repositories.payment_repository import PaymentRepository
from app.repositories.program_repository import ProgramRepository

async def main():
    print("--- START DEBUG ---")
    
    # 1. Fetch Programs to get a valid ID
    prog_repo = ProgramRepository()
    programs = prog_repo.get_all_programs()
    
    if not programs:
        print("No programs found!")
        return

    # Use the first program
    p = programs[0]
    pid = p['program_id']
    name = p['program_name']
    fee = p.get('monthly_fee')
    print(f"Testing with Program: {name} (ID: {pid}), Fee: {fee}")
    
    # 2. Call Payment Status for current month
    pay_repo = PaymentRepository()
    month = 2 # Feb
    year = 2026
    
    print(f"Fetching status for {month}/{year}...")
    results = pay_repo.get_program_payment_status(pid, month, year)
    
    print(f"Results Count: {len(results)}")
    for r in results:
        print(r)
        
    print("--- END DEBUG ---")

if __name__ == "__main__":
    asyncio.run(main())
