import requests
import sys
import json
from datetime import datetime

class SmartWardrobeAPITester:
    def __init__(self, base_url="https://outfit-genius-87.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.username = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_outfits = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test API health check"""
        return self.run_test("Health Check", "GET", "", 200)

    def test_register(self):
        """Test user registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        self.username = f"testuser_{timestamp}"
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={
                "username": self.username,
                "email": f"{self.username}@test.com",
                "password": "TestPass123!"
            }
        )
        
        if success and 'token' in response:
            self.token = response['token']
            print(f"   Token received: {self.token[:20]}...")
            return True
        return False

    def test_login(self):
        """Test user login"""
        if not self.username:
            print("❌ Cannot test login - no username available")
            return False
            
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={
                "username": self.username,
                "password": "TestPass123!"
            }
        )
        
        if success and 'token' in response:
            self.token = response['token']
            print(f"   Login token: {self.token[:20]}...")
            return True
        return False

    def test_init_sample_data(self):
        """Test sample data initialization"""
        return self.run_test(
            "Initialize Sample Data",
            "POST",
            "init-sample-data",
            200
        )

    def test_get_outfits(self):
        """Test getting user outfits"""
        success, response = self.run_test(
            "Get Outfits",
            "GET",
            "outfits",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} outfits")
            return True
        return False

    def test_create_outfit(self):
        """Test creating a new outfit"""
        outfit_data = {
            "name": "Test Outfit",
            "category": "casual",
            "season": "all",
            "color": "blue"
        }
        
        success, response = self.run_test(
            "Create Outfit",
            "POST",
            "outfits",
            200,
            data=outfit_data
        )
        
        if success and 'id' in response:
            self.created_outfits.append(response['id'])
            print(f"   Created outfit ID: {response['id']}")
            return True
        return False

    def test_outfit_stats(self):
        """Test getting outfit statistics"""
        success, response = self.run_test(
            "Get Outfit Stats",
            "GET",
            "outfits/stats",
            200
        )
        
        if success and 'most_used' in response and 'least_used' in response:
            print(f"   Most used: {len(response['most_used'])} outfits")
            print(f"   Least used: {len(response['least_used'])} outfits")
            return True
        return False

    def test_mark_outfit_used(self):
        """Test marking an outfit as used"""
        if not self.created_outfits:
            print("❌ Cannot test outfit usage - no outfits available")
            return False
            
        outfit_id = self.created_outfits[0]
        success, response = self.run_test(
            "Mark Outfit as Used",
            "POST",
            f"outfits/{outfit_id}/use",
            200
        )
        
        return success

    def test_ai_suggestions(self):
        """Test AI suggestions endpoint"""
        print("🤖 Testing AI suggestions (may take a few seconds)...")
        success, response = self.run_test(
            "Get AI Suggestions",
            "POST",
            "suggestions/ai",
            200
        )
        
        if success and 'suggestions' in response and 'reasoning' in response:
            print(f"   AI suggestions: {len(response['suggestions'])} items")
            print(f"   Reasoning: {response['reasoning'][:100]}...")
            return True
        return False

    def test_weather_suggestions(self):
        """Test weather-based suggestions"""
        success, response = self.run_test(
            "Get Weather Suggestions",
            "GET",
            "suggestions/weather?city=London",
            200
        )
        
        if success and 'suggestions' in response and 'reasoning' in response:
            print(f"   Weather suggestions: {len(response['suggestions'])} items")
            print(f"   Weather info: {response['reasoning']}")
            return True
        return False

    def test_invalid_token(self):
        """Test API with invalid token"""
        original_token = self.token
        self.token = "invalid_token_123"
        
        success, _ = self.run_test(
            "Invalid Token Test",
            "GET",
            "outfits",
            401
        )
        
        self.token = original_token
        return success

def main():
    print("🧥 Smart Wardrobe API Testing Suite")
    print("=" * 50)
    
    tester = SmartWardrobeAPITester()
    
    # Test sequence
    tests = [
        ("Health Check", tester.test_health_check),
        ("User Registration", tester.test_register),
        ("User Login", tester.test_login),
        ("Initialize Sample Data", tester.test_init_sample_data),
        ("Get Outfits", tester.test_get_outfits),
        ("Create Outfit", tester.test_create_outfit),
        ("Get Outfit Stats", tester.test_outfit_stats),
        ("Mark Outfit Used", tester.test_mark_outfit_used),
        ("AI Suggestions", tester.test_ai_suggestions),
        ("Weather Suggestions", tester.test_weather_suggestions),
        ("Invalid Token", tester.test_invalid_token),
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        try:
            if not test_func():
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} - Exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Print results
    print("\n" + "=" * 50)
    print("📊 TEST RESULTS")
    print("=" * 50)
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if failed_tests:
        print(f"\n❌ Failed tests: {', '.join(failed_tests)}")
        return 1
    else:
        print("\n✅ All tests passed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())