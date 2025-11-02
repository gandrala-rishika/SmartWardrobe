## What is Smart Wardrobe?

Smart Wardrobe is a web application that transforms your clothing collection into an intelligent, interactive fashion database. It helps you organize, track, and make the most of every piece you own with AI-powered suggestions and social features.

## Key Features

📊 **Digital Wardrobe Management**
- Upload and catalog all your outfits with photos
- Track usage frequency to identify your favorites
- Filter by category, season, color, and more

🤖 **AI-Powered Suggestions**
- Get personalized outfit recommendations based on your least-worn items
- Receive weather-appropriate outfit suggestions
- Learn creative styling tips for clothes you already own

👥 **Social Features**
- Share outfits with friends via shareable links
- Create fashion groups and collaborate
- Rate and get feedback on shared outfits

📈 **Analytics & Insights**
- Discover your most and least worn items
- Track your fashion patterns over time
- Make informed decisions about future purchases

## Tech Stack

**Backend:**
- FastAPI (Python web framework)
- MongoDB with GridFS for image storage
- JWT authentication
- OpenRouter API for AI suggestions
- Open-Meteo for weather data
- Render for Backend deployment

**Frontend:**
- HTML5 for page structure
- JavaScript for functionality
- JSX for UI components
- Render for Frontend deployment

## Quick Start Guide

### Prerequisites
- Python 3.8+
- MongoDB (local or cloud)
- OpenRouter API key (for AI features)

### Installation Steps

1. **Clone the repository**

2. **Set up virtual environment**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies**
```bash
cd backend
pip install -r requirements.txt
```

4. **Run the backend server**
```bash
uvicorn server:app --reload
```

5. **Open a new terminal and open the same virtual environment here as well**
  ```bash
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

6. **Start frontend**
```bash
cd frontend
yarn start
```


## API Endpoints

**Authentication:**
- POST /api/auth/register - Create new account
- POST /api/auth/login - User login

**Outfit Management:**
- GET /api/outfits - View all outfits
- POST /api/outfits - Add new outfit
- PUT /api/outfits/{id} - Update outfit
- DELETE /api/outfits/{id} - Remove outfit

**AI Features:**
- POST /api/suggestions/ai - Get AI recommendations
- GET /api/suggestions/weather - Weather-based suggestions

**Social Features:**
- POST /api/outfits/{id}/share - Share outfit
- POST /api/groups/create - Create group
- POST /api/groups/join - Join group with code


## Configuration Details

**MongoDB Setup:**
- Local: Install MongoDB Community Server
- Cloud: Use MongoDB Atlas (free tier available)

**OpenRouter API:**
1. Sign up at openrouter.ai
2. Get API key from dashboard
3. Add to .env file
4. Free tier provides good limits for testing


## Acknowledgments

Thanks to OpenRouter for AI models, MongoDB for the database, FastAPI for the web framework, and Render for deployment. We thank you from the bottom of our hearts for helping us complete this project
