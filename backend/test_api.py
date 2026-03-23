import requests

try:
    print("Testing /api/parts/tree/4:")
    r1 = requests.get("http://127.0.0.1:8000/api/parts/tree/4")
    print(r1.status_code, r1.text)
    
    print("\nTesting /api/parts/?project_id=4:")
    r2 = requests.get("http://127.0.0.1:8000/api/parts/?project_id=4")
    print(r2.status_code, len(r2.json()), "items")
    print(r2.json()[:1])
    
except Exception as e:
    print("Request failed:", e)
