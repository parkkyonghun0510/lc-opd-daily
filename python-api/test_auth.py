import requests
import json

# Base URL for the API
BASE_URL = "http://127.0.0.1:8000/api"

def test_auth_flow():
    """Test the authentication flow from login to accessing protected endpoints"""
    
    # Step 1: Login to get a token
    login_url = f"{BASE_URL}/auth/login"
    login_data = {
        "username": "admin",  # Replace with a valid username
        "password": "password123"   # Replace with a valid password
    }
    
    print(f"Attempting login at {login_url}...")
    login_response = requests.post(
        login_url, 
        data=login_data,  # Note: Using data instead of json for form data
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    
    print(f"Login response status: {login_response.status_code}")
    
    if login_response.status_code != 200:
        print(f"Login failed: {login_response.text}")
        return
    
    token_data = login_response.json()
    print(f"Login successful. Token type: {token_data.get('token_type')}")
    
    # Extract the token
    access_token = token_data.get("access_token")
    token_type = token_data.get("token_type", "bearer")
    
    if not access_token:
        print("No access token received")
        return
    
    # Step 2: Access the /me endpoint with the token
    me_url = f"{BASE_URL}/auth/me"
    auth_header = {"Authorization": f"{token_type} {access_token}"}
    
    print(f"\nAttempting to access {me_url} with token...")
    print(f"Using Authorization header: {auth_header}")
    
    me_response = requests.get(me_url, headers=auth_header)
    
    print(f"Me endpoint response status: {me_response.status_code}")
    
    if me_response.status_code == 200:
        user_data = me_response.json()
        print(f"User data retrieved successfully:")
        print(json.dumps(user_data, indent=2))
    else:
        print(f"Failed to retrieve user data: {me_response.text}")
        
    # Step 3: Try a request without a token to verify it fails
    print("\nTrying without token (should fail)...")
    no_auth_response = requests.get(me_url)
    print(f"Response without token: {no_auth_response.status_code}")
    print(f"Error message: {no_auth_response.text}")

if __name__ == "__main__":
    test_auth_flow()
