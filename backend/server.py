from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, File, UploadFile, Form, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse, RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from io import BytesIO
import os
import logging
import json
import uuid
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import jwt
from passlib.hash import bcrypt
import httpx
from openai import AsyncOpenAI, RateLimitError
import traceback
import aiofiles
from PIL import Image
import io

# --- Configuration ---
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME","fashion")
mongo_client = AsyncIOMotorClient(MONGO_URI)
db = mongo_client[MONGO_DB_NAME]
gridfs_bucket = AsyncIOMotorGridFSBucket(db, bucket_name="outfit_images")
profile_bucket = AsyncIOMotorGridFSBucket(db, bucket_name="profile_images")

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your_jwt_secret_key_change_in_production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

# API Keys
OPENROUTER_API_KEY = os.environ.get('OPENROUTER_API_KEY')

# Frontend URL - HARDCODED FOR NETLIFY
FRONTEND_URL = "https://smartwardrobe-s91s.onrender.com"

# Image storage configuration
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_FILE_SIZE = 5 * 1024 * 1024  # Reduced to 5MB for free tier
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

# Security
security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# --- App and Router ---
app = FastAPI(title="Smart Wardrobe API")

# Add CORS middleware with explicit configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

api_router = APIRouter(prefix="/api")

# Mount static files for uploaded images
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# --- Pydantic Models ---
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: str
    password_hash: str
    gender: str  # Added gender field
    phone: Optional[str] = None  # Added phone field
    profile_pic_id: Optional[str] = None  # Added profile picture ID
    profile_pic_url: Optional[str] = None  # Added profile picture URL
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserRegister(BaseModel):
    username: str
    email: str
    password: str
    gender: str  # Added gender field

class UserLogin(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    token: str
    username: str

class UserProfile(BaseModel):
    username: str
    email: str
    gender: str
    phone: Optional[str] = None
    profile_pic_url: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class Outfit(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    category: str
    season: str
    color: str
    image_url: Optional[str] = None
    usage_count: int = 0
    last_used: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OutfitCreate(BaseModel):
    name: str
    category: str
    season: str
    color: str
    image_url: Optional[str] = None

class OutfitUsage(BaseModel):
    outfit_id: str
    used_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OutfitStats(BaseModel):
    most_used: List[dict]
    least_used: List[dict]

class SuggestionResponse(BaseModel):
    suggestions: List[dict]
    reasoning: str

class OutfitNameInput(BaseModel):
    name: str

# New models for sharing functionality
class SharedOutfit(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    outfit_id: str
    share_token: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(days=30))

class PublicOutfitView(BaseModel):
    id: str
    name: str
    category: str
    season: str
    color: str
    image_url: Optional[str] = None
    created_at: datetime

class ShareResponse(BaseModel):
    share_url: str
    expires_at: datetime

# New models for group functionality
class Group(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    creator_id: str
    members: List[str] = Field(default_factory=list)  # List of user IDs
    invite_code: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None

class GroupResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    creator_id: str
    creator_name: str
    members_count: int
    invite_code: str
    created_at: datetime
    is_member: bool = True

class GroupDetail(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    creator_id: str
    creator_name: str
    members: List[Dict[str, Any]]  # List of user info
    shared_outfits: List[Dict[str, Any]]  # Outfits with ratings
    invite_code: str
    created_at: datetime
    is_member: bool = True

class SharedOutfitToGroup(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    group_id: str
    outfit_id: str
    shared_by_user_id: str
    shared_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OutfitRating(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    group_id: str
    outfit_id: str
    user_id: str
    rating: int  # 1-5
    rated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RatingRequest(BaseModel):
    rating: int  # 1-5

class JoinGroupRequest(BaseModel):
    invite_code: str

# --- Helper Functions ---
def create_jwt_token(user_id: str, username: str) -> str:
    expiration = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {'user_id': user_id, 'username': username, 'exp': expiration}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_jwt_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = verify_jwt_token(token)
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def compress_image(image_data: bytes, file_format: str, max_width: int = 600, quality: int = 75) -> bytes:
    """
    Compresses an image, resizing it if necessary.
    Optimized for free hosting tiers.
    """
    img = Image.open(io.BytesIO(image_data))
    
    # Convert RGBA to RGB for JPEG format to avoid errors
    if file_format.upper() == "JPEG" and img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    # Resize if too wide (reduced from 800 to 600)
    if img.width > max_width:
        ratio = max_width / img.width
        new_height = int(img.height * ratio)
        img = img.resize((max_width, new_height), Image.LANCZOS)
    
    # Compress using the explicitly provided format (reduced quality)
    output = io.BytesIO()
    img.save(output, format=file_format, quality=quality)
    return output.getvalue()

async def validate_image(image_data: bytes) -> bool:
    try:
        img = Image.open(io.BytesIO(image_data))
        img.verify()  # Verify it's a valid image
        return True
    except Exception:
        return False

async def upload_to_gridfs(file: UploadFile):
    """Try uploading image to GridFS; return file_id or None if failed."""
    try:
        contents = await file.read()
        file_id = await gridfs_bucket.upload_from_stream(file.filename, BytesIO(contents))
        return str(file_id)
    except Exception as e:
        print(f"GridFS upload failed: {e}")
        return None

async def save_locally(file: UploadFile):
    """Save image to local uploads folder (fallback)."""
    import uuid
    file_ext = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{file_ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    async with aiofiles.open(filepath, "wb") as f:
        await f.write(await file.read())

    return f"/uploads/{filename}"

async def delete_image(image_id: str | None, local_path: str | None):
    """Delete from GridFS or local filesystem."""
    if image_id:
        try:
            await gridfs_bucket.delete(ObjectId(image_id))
        except Exception as e:
            print(f"GridFS delete failed: {e}")

    if local_path:
        local_file = local_path.lstrip("/")
        if os.path.exists(local_file):
            os.remove(local_file)

# --- Authentication Routes ---
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserRegister):
    existing_user = await db.users.find_one({"username": user_data.username}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    password_hash = bcrypt.hash(user_data.password)
    user = User(username=user_data.username, email=user_data.email, password_hash=password_hash, gender=user_data.gender)
    
    doc = user.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.users.insert_one(doc)
    
    token = create_jwt_token(user.id, user.username)
    return TokenResponse(token=token, username=user.username)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(login_data: UserLogin):
    user = await db.users.find_one({"username": login_data.username}, {"_id": 0})
    if not user or not bcrypt.verify(login_data.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_jwt_token(user['id'], user['username'])
    return TokenResponse(token=token, username=user['username'])

# --- Profile Routes ---
@api_router.get("/profile", response_model=UserProfile)
async def get_profile(current_user: dict = Depends(get_current_user)):
    """Get user profile information"""
    user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return UserProfile(
        username=user['username'],
        email=user['email'],
        gender=user['gender'],
        phone=user.get('phone'),
        profile_pic_url=user.get('profile_pic_url')
    )

@api_router.put("/profile", response_model=UserProfile)
async def update_profile(
    username: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """Update user profile information"""
    user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if username is already taken by another user
    if username and username != user['username']:
        existing_user = await db.users.find_one({"username": username, "id": {"$ne": current_user['id']}}, {"_id": 0})
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already exists")
    
    # Check if email is already taken by another user
    if email and email != user['email']:
        existing_user = await db.users.find_one({"email": email, "id": {"$ne": current_user['id']}}, {"_id": 0})
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already exists")
    
    # Update user information
    update_data = {}
    if username:
        update_data['username'] = username
    if email:
        update_data['email'] = email
    if phone is not None:  # Allow empty string to remove phone
        update_data['phone'] = phone
    
    if update_data:
        await db.users.update_one(
            {"id": current_user['id']},
            {"$set": update_data}
        )
    
    # Get updated user
    updated_user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
    
    return UserProfile(
        username=updated_user['username'],
        email=updated_user['email'],
        gender=updated_user['gender'],
        phone=updated_user.get('phone'),
        profile_pic_url=updated_user.get('profile_pic_url')
    )

@api_router.post("/profile/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: dict = Depends(get_current_user)
):
    """Change user password"""
    user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify current password
    if not bcrypt.verify(password_data.current_password, user['password_hash']):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Update password
    new_password_hash = bcrypt.hash(password_data.new_password)
    await db.users.update_one(
        {"id": current_user['id']},
        {"$set": {"password_hash": new_password_hash}}
    )
    
    return {"message": "Password changed successfully"}

@api_router.post("/profile/upload-pic")
async def upload_profile_pic(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload profile picture"""
    # Validate file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    try:
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large")
        
        if not await validate_image(content):
            raise HTTPException(status_code=400, detail="Invalid image file")
        
        # Map extension to Pillow format
        format_map = {
            ".jpg": "JPEG", ".jpeg": "JPEG", ".png": "PNG",
            ".gif": "GIF", ".webp": "WEBP"
        }
        pillow_format = format_map.get(file_ext, "JPEG")
        compressed_content = await compress_image(content, file_format=pillow_format)
        
        # Delete old profile picture if exists
        user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
        if user.get('profile_pic_id'):
            try:
                await profile_bucket.delete(ObjectId(user['profile_pic_id']))
            except Exception as e:
                print(f"Failed to delete old profile picture: {e}")
        
        # Upload new profile picture to GridFS
        gridfs_stream = BytesIO(compressed_content)
        file_id = await profile_bucket.upload_from_stream(file.filename, gridfs_stream)
        profile_pic_id = str(file_id)
        profile_pic_url = f"/api/profile-pic/{profile_pic_id}"
        
        # Update user with new profile picture
        await db.users.update_one(
            {"id": current_user['id']},
            {"$set": {"profile_pic_id": profile_pic_id, "profile_pic_url": profile_pic_url}}
        )
        
        return {"message": "Profile picture uploaded successfully", "profile_pic_url": profile_pic_url}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading profile picture: {str(e)}")

@api_router.get("/profile-pic/{file_id}")
async def get_profile_pic(file_id: str):
    """Serve profile picture stored in MongoDB GridFS"""
    try:
        grid_out = await profile_bucket.open_download_stream(ObjectId(file_id))
        contents = await grid_out.read()
        
        # Try to get content type from metadata, default to jpeg
        content_type = grid_out.metadata.get('contentType', 'image/jpeg') if grid_out.metadata else 'image/jpeg'
        
        return StreamingResponse(BytesIO(contents), media_type=content_type)
    
    except Exception as e:
        print(f"Profile picture retrieval failed: {e}")
        raise HTTPException(status_code=404, detail="Profile picture not found")

# --- Image Upload Endpoint ---
@api_router.post("/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    # Validate file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Generate unique filename
    unique_id = str(uuid.uuid4())
    filename = f"{unique_id}{file_ext}"
    file_path = UPLOAD_DIR / filename
    
    # Save file
    try:
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large")
        
        if not await validate_image(content):
            raise HTTPException(status_code=400, detail="Invalid image file")
        
        # Map extension to Pillow format
        format_map = {
            ".jpg": "JPEG", ".jpeg": "JPEG", ".png": "PNG",
            ".gif": "GIF", ".webp": "WEBP"
        }
        pillow_format = format_map.get(file_ext, "JPEG")
        compressed_content = await compress_image(content, file_format=pillow_format)
        
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(compressed_content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")
    
    # Return the URL for the uploaded image
    image_url = f"/uploads/{filename}"
    return {"filename": filename, "image_url": image_url}

# --- Outfit Management Routes ---
@api_router.get("/outfits", response_model=List[Outfit])
async def get_outfits(request: Request, current_user: dict = Depends(get_current_user)):
    outfits_cursor = db.outfits.find({"user_id": current_user['id']}, {"_id": 0})
    outfits = await outfits_cursor.to_list(1000)
    
    # Get the API base URL
    api_base_url = f"{request.url.scheme}://{request.url.netloc}"
    
    # Convert date strings back to datetime objects for the response model
    for outfit in outfits:
        if isinstance(outfit.get('created_at'), str):
            outfit['created_at'] = datetime.fromisoformat(outfit['created_at'])
        if outfit.get('last_used') and isinstance(outfit['last_used'], str):
            outfit['last_used'] = datetime.fromisoformat(outfit['last_used'])
        
        # Make image URLs absolute
        image_url = outfit.get('image_url')
        if image_url and not image_url.startswith(('http://', 'https://')):
            outfit['image_url'] = f"{api_base_url}{image_url}"
    
    return outfits

@api_router.post("/outfits", response_model=Outfit, status_code=status.HTTP_201_CREATED)
async def create_outfit(
    name: str = Form(...),
    category: str = Form(...),
    season: str = Form(...),
    color: str = Form(...),
    image_url: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user)
):
    # Check for duplicate outfit name for this user
    existing_outfit = await db.outfits.find_one({"name": name, "user_id": current_user['id']})
    if existing_outfit:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"An outfit named '{name}' already exists.")

    image_id = None
    final_image_url = None
    local_path = None
    storage_type = None  # Track where the image is stored

    # Handle image upload if provided
    if image:
        # Validate file extension
        file_ext = Path(image.filename).suffix.lower()
        if file_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
            )

        try:
            content = await image.read()
            if len(content) > MAX_FILE_SIZE:
                raise HTTPException(status_code=400, detail="File too large")

            if not await validate_image(content):
                raise HTTPException(status_code=400, detail="Invalid image file")

            # Map extension to Pillow format
            format_map = {
                ".jpg": "JPEG", ".jpeg": "JPEG", ".png": "PNG",
                ".gif": "GIF", ".webp": "WEBP"
            }
            pillow_format = format_map.get(file_ext, "JPEG")
            compressed_content = await compress_image(content, file_format=pillow_format)

            # Try saving to GridFS first
            try:
                from io import BytesIO
                gridfs_stream = BytesIO(compressed_content)
                file_id = await gridfs_bucket.upload_from_stream(image.filename, gridfs_stream)
                image_id = str(file_id)
                final_image_url = f"/api/images/{image_id}"
                storage_type = "gridfs"
            except Exception as e:
                print(f"GridFS upload failed, saving locally instead: {e}")
                # Fallback to local save
                unique_id = str(uuid.uuid4())
                filename = f"{unique_id}{file_ext}"
                file_path = UPLOAD_DIR / filename
                async with aiofiles.open(file_path, 'wb') as f:
                    await f.write(compressed_content)
                final_image_url = f"/uploads/{filename}"
                local_path = str(file_path)
                storage_type = "local"

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")

    else:
        # Use the image_url from form data if provided
        final_image_url = image_url
        storage_type = "url" if image_url else None

    # Create outfit document
    outfit = Outfit(
        user_id=current_user['id'],
        name=name,
        category=category,
        season=season,
        color=color,
        image_url=final_image_url
    )

    # Add storage information
    doc = outfit.model_dump()
    doc['image_id'] = image_id
    doc['local_path'] = local_path
    doc['storage_type'] = storage_type  # Track storage type
    doc['created_at'] = doc['created_at'].isoformat()
    if doc.get('last_used'):
        doc['last_used'] = doc['last_used'].isoformat()

    await db.outfits.insert_one(doc)
    return outfit

@api_router.get("/images/{file_id}")
async def get_image(file_id: str):
    """
    Serve an image stored in MongoDB GridFS or local filesystem.
    Falls back gracefully if the image isn't found.
    """
    # First, try to find if this is a GridFS ID
    try:
        grid_out = await gridfs_bucket.open_download_stream(ObjectId(file_id))
        contents = await grid_out.read()
        
        # Try to get content type from metadata, default to jpeg
        content_type = grid_out.metadata.get('contentType', 'image/jpeg') if grid_out.metadata else 'image/jpeg'
        
        return StreamingResponse(BytesIO(contents), media_type=content_type)
    
    except Exception as e:
        logging.error(f"GridFS image retrieval failed: {e}")
        
        # Check if this is a local file path
        if file_id.startswith('/uploads/'):
            # Extract just the filename
            filename = file_id.split('/')[-1]
            file_path = UPLOAD_DIR / filename
        else:
            # Try to find a local file with the same ID
            file_path = None
            for file in os.listdir(UPLOAD_DIR):
                if file.startswith(file_id):
                    file_path = UPLOAD_DIR / file
                    break
        
        if file_path and file_path.exists():
            # Determine content type
            if file_path.suffix.lower() in ('.jpg', '.jpeg'):
                content_type = 'image/jpeg'
            elif file_path.suffix.lower() == '.png':
                content_type = 'image/png'
            elif file_path.suffix.lower() == '.gif':
                content_type = 'image/gif'
            elif file_path.suffix.lower() == '.webp':
                content_type = 'image/webp'
            else:
                content_type = 'image/jpeg'  # Default
            
            return FileResponse(file_path, media_type=content_type)
        
        # If all else fails, return a placeholder image
        placeholder_url = f"https://picsum.photos/seed/{file_id}/600/800.jpg"
        return RedirectResponse(url=placeholder_url)

@api_router.put("/outfits/{outfit_id}", response_model=Outfit)
async def update_outfit(
    outfit_id: str,
    name: str = Form(...),
    category: str = Form(...),
    season: str = Form(...),
    color: str = Form(...),
    image_url: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user)
):
    # Check if outfit exists and belongs to user
    outfit = await db.outfits.find_one({"id": outfit_id, "user_id": current_user['id']}, {"_id": 0})
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")
    
    # Handle image upload if provided
    final_image_url = outfit.get('image_url')
    if image:
        # Validate file extension
        file_ext = Path(image.filename).suffix.lower()
        if file_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400, 
                detail=f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
            )
        
        # Generate unique filename
        unique_id = str(uuid.uuid4())
        filename = f"{unique_id}{file_ext}"
        file_path = UPLOAD_DIR / filename
        
        # Save file
        try:
            content = await image.read()
            if len(content) > MAX_FILE_SIZE:
                raise HTTPException(status_code=400, detail="File too large")
            
            if not await validate_image(content):
                raise HTTPException(status_code=400, detail="Invalid image file")
            
            # Map extension to Pillow format
            format_map = {
                ".jpg": "JPEG", ".jpeg": "JPEG", ".png": "PNG",
                ".gif": "GIF", ".webp": "WEBP"
            }
            pillow_format = format_map.get(file_ext, "JPEG")
            compressed_content = await compress_image(content, file_format=pillow_format)
            
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(compressed_content)
            final_image_url = f"/uploads/{filename}"
            
            # Delete old image if it exists
            if outfit.get('image_url'):
                # Note: This delete_image helper is for GridFS/local, not just local URLs.
                # You might need a more robust way to handle old image deletion.
                # For now, this is a simplified approach.
                old_path_str = outfit.get('image_url', '').lstrip('/uploads/')
                if old_path_str:
                    old_path = ROOT_DIR / "uploads" / old_path_str
                    if old_path.exists():
                        os.remove(old_path)

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")
    elif image_url:
        # Use the image_url from the form data if provided
        final_image_url = image_url

    # Update outfit
    update_data = {
        'name': name,
        'category': category,
        'season': season,
        'color': color,
        'image_url': final_image_url
    }
    
    await db.outfits.update_one(
        {"id": outfit_id},
        {"$set": update_data}
    )
    
    # Return updated outfit
    updated_outfit = await db.outfits.find_one({"id": outfit_id}, {"_id": 0})
    
    # Convert date strings back to datetime objects for the response model
    if isinstance(updated_outfit.get('created_at'), str):
        updated_outfit['created_at'] = datetime.fromisoformat(updated_outfit['created_at'])
    if updated_outfit.get('last_used') and isinstance(updated_outfit['last_used'], str):
        updated_outfit['last_used'] = datetime.fromisoformat(updated_outfit['last_used'])
    
    return updated_outfit

@api_router.delete("/outfits/{outfit_id}", status_code=status.HTTP_200_OK)
async def delete_outfit(outfit_id: str, current_user: dict = Depends(get_current_user)):
    """
    Delete an outfit and its associated image (GridFS or local fallback).
    """
    outfit = await db.outfits.find_one({
        "id": outfit_id,
        "user_id": current_user["id"]
    })

    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")

    # Delete image based on storage type
    storage_type = outfit.get("storage_type")
    
    if storage_type == "gridfs":
        image_id = outfit.get("image_id")
        if image_id:
            try:
                await gridfs_bucket.delete(ObjectId(image_id))
                print(f"✅ Deleted image from GridFS: {image_id}")
            except Exception as e:
                print(f"⚠ GridFS delete failed: {e}")
    elif storage_type == "local":
        local_path = outfit.get("local_path")
        if local_path:
            try:
                local_file = local_path.replace("\\", "/")
                if local_file.startswith("/"):
                    local_file = local_file[1:]
                if os.path.exists(local_file):
                    os.remove(local_file)
                    print(f"✅ Deleted local image: {local_file}")
            except Exception as e:
                print(f"⚠ Local file delete failed: {e}")

    # Delete the outfit document itself
    await db.outfits.delete_one({"id": outfit_id})

    return {"message": f"Outfit '{outfit.get('name')}' deleted successfully."}

@api_router.post("/outfits/{outfit_id}/use")
async def use_outfit(outfit_id: str, current_user: dict = Depends(get_current_user)):
    outfit = await db.outfits.find_one({"id": outfit_id, "user_id": current_user['id']}, {"_id": 0})
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")
    
    await db.outfits.update_one(
        {"id": outfit_id},
        {
            "$inc": {"usage_count": 1},
            "$set": {"last_used": datetime.now(timezone.utc).isoformat()}
        }
    )
    return {"message": "Outfit usage recorded"}

@api_router.get("/outfits/stats", response_model=OutfitStats)
async def get_outfit_stats(current_user: dict = Depends(get_current_user)):
    outfits = await db.outfits.find({"user_id": current_user['id']}, {"_id": 0}).to_list(1000)
    sorted_outfits = sorted(outfits, key=lambda x: x.get('usage_count', 0), reverse=True)
    return OutfitStats(most_used=sorted_outfits[:5], least_used=sorted_outfits[-5:])

# --- Share Outfit Routes ---
@api_router.post("/outfits/{outfit_id}/share", response_model=ShareResponse)
async def share_outfit(outfit_id: str, current_user: dict = Depends(get_current_user)):
    """
    Create a shareable link for an outfit.
    The link will be valid for 30 days.
    """
    # Check if outfit exists and belongs to user
    outfit = await db.outfits.find_one({"id": outfit_id, "user_id": current_user['id']}, {"_id": 0})
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")
    
    # Create a new share token
    share_token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    
    # Save share token to database
    shared_outfit = SharedOutfit(
        outfit_id=outfit_id,
        share_token=share_token,
        expires_at=expires_at
    )
    
    doc = shared_outfit.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['expires_at'] = doc['expires_at'].isoformat()
    
    await db.shared_outfits.insert_one(doc)
    
    # Create the share URL with the HARDCODED frontend domain
    # Just return the path part, not the full URL
    share_url = f"/shared-outfit/{share_token}"
    
    return ShareResponse(share_url=share_url, expires_at=expires_at)

@api_router.get("/shared-outfit/{share_token}", response_model=PublicOutfitView)
async def get_shared_outfit(share_token: str, request: Request):
    """
    Get a shared outfit's public details.
    This endpoint is accessible without authentication.
    """
    # Find the share token
    shared_outfit = await db.shared_outfits.find_one({"share_token": share_token}, {"_id": 0})
    if not shared_outfit:
        raise HTTPException(status_code=404, detail="Share link not found")
    
    # Check if the share link has expired
    expires_at = datetime.fromisoformat(shared_outfit['expires_at'])
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=410, detail="Share link has expired")
    
    # Get the outfit
    outfit = await db.outfits.find_one({"id": shared_outfit['outfit_id']}, {"_id": 0})
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")
    
    # Get the API base URL
    api_base_url = f"{request.url.scheme}://{request.url.netloc}"
    
    # Process image URL to ensure it's absolute
    image_url = outfit.get('image_url')
    if image_url and not image_url.startswith(('http://', 'https://')):
        # Make the URL absolute with the API domain
        image_url = f"{api_base_url}{image_url}"
    
    # Return only public information
    public_outfit = PublicOutfitView(
        id=outfit['id'],
        name=outfit['name'],
        category=outfit['category'],
        season=outfit['season'],
        color=outfit['color'],
        image_url=image_url,
        created_at=datetime.fromisoformat(outfit['created_at'])
    )
    
    return public_outfit

@api_router.get("/share/{share_token}")
async def redirect_shared_outfit(share_token: str):
    """
    Redirect to the shared outfit page with a cleaner URL.
    """
    return RedirectResponse(url=f"{FRONTEND_URL}/shared-outfit/{share_token}")

@api_router.post("/shared-outfit/{share_token}/add-to-wardrobe", response_model=Outfit)
async def add_shared_outfit_to_wardrobe(
    share_token: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Add a shared outfit to the current user's wardrobe.
    This endpoint requires authentication.
    """
    # Find the share token
    shared_outfit = await db.shared_outfits.find_one({"share_token": share_token}, {"_id": 0})
    if not shared_outfit:
        raise HTTPException(status_code=404, detail="Share link not found")
    
    # Check if the share link has expired
    expires_at = datetime.fromisoformat(shared_outfit['expires_at'])
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=410, detail="Share link has expired")
    
    # Get the original outfit
    original_outfit = await db.outfits.find_one({"id": shared_outfit['outfit_id']}, {"_id": 0})
    if not original_outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")
    
    # Check if user already has an outfit with the same name
    existing_outfit = await db.outfits.find_one({
        "name": original_outfit['name'], 
        "user_id": current_user['id']
    })
    if existing_outfit:
        raise HTTPException(
            status_code=409, 
            detail=f"You already have an outfit named '{original_outfit['name']}' in your wardrobe"
        )
    
    # Create a new outfit for the current user
    new_outfit = Outfit(
        user_id=current_user['id'],
        name=original_outfit['name'],
        category=original_outfit['category'],
        season=original_outfit['season'],
        color=original_outfit['color'],
        image_url=original_outfit.get('image_url')
    )
    
    doc = new_outfit.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.outfits.insert_one(doc)
    return new_outfit

# --- Group Management Routes ---
@api_router.post("/groups/create", response_model=GroupResponse)
async def create_group(
    group_data: GroupCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new group"""
    # Create group
    group = Group(
        name=group_data.name,
        description=group_data.description,
        creator_id=current_user['id'],
        members=[current_user['id']]  # Creator is automatically a member
    )
    
    doc = group.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.groups.insert_one(doc)
    
    # Get creator info
    creator = await db.users.find_one({"id": current_user['id']}, {"_id": 0, "password_hash": 0})
    
    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        creator_id=group.creator_id,
        creator_name=creator['username'],
        members_count=1,
        invite_code=group.invite_code,
        created_at=group.created_at
    )

@api_router.get("/groups", response_model=List[GroupResponse])
async def get_user_groups(current_user: dict = Depends(get_current_user)):
    """Get all groups the current user is a member of"""
    groups_cursor = db.groups.find({"members": current_user['id']}, {"_id": 0})
    groups = await groups_cursor.to_list(1000)
    
    result = []
    for group in groups:
        # Convert date strings back to datetime objects
        if isinstance(group.get('created_at'), str):
            group['created_at'] = datetime.fromisoformat(group['created_at'])
        
        # Get creator info
        creator = await db.users.find_one({"id": group['creator_id']}, {"_id": 0, "password_hash": 0})
        
        result.append(GroupResponse(
            id=group['id'],
            name=group['name'],
            description=group.get('description'),
            creator_id=group['creator_id'],
            creator_name=creator['username'],
            members_count=len(group['members']),
            invite_code=group['invite_code'],
            created_at=group['created_at']
        ))
    
    return result

@api_router.get("/groups/{group_id}", response_model=GroupDetail)
async def get_group_details(group_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    """Get group details with shared outfits and ratings"""
    # Check if group exists
    group = await db.groups.find_one({"id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Check if user is a member
    is_member = current_user['id'] in group['members']
    if not is_member:
        raise HTTPException(status_code=403, detail="You are not a member of this group")
    
    # Convert date strings back to datetime objects
    if isinstance(group.get('created_at'), str):
        group['created_at'] = datetime.fromisoformat(group['created_at'])
    
    # Get creator info
    creator = await db.users.find_one({"id": group['creator_id']}, {"_id": 0, "password_hash": 0})
    
    # Get member info
    members = []
    for member_id in group['members']:
        member = await db.users.find_one({"id": member_id}, {"_id": 0, "password_hash": 0})
        if member:
            members.append({
                "id": member['id'],
                "username": member['username'],
                "profile_pic_url": member.get('profile_pic_url')
            })
    
    # Get shared outfits
    shared_outfits = []
    shared_outfits_cursor = db.shared_outfits_to_group.find({"group_id": group_id}, {"_id": 0})
    shared_outfits_list = await shared_outfits_cursor.to_list(1000)
    
    # Get the API base URL
    api_base_url = f"{request.url.scheme}://{request.url.netloc}"
    
    for shared_outfit in shared_outfits_list:
        # Get outfit details
        outfit = await db.outfits.find_one({"id": shared_outfit['outfit_id']}, {"_id": 0})
        if not outfit:
            continue
            
        # Get sharer info
        sharer = await db.users.find_one({"id": shared_outfit['shared_by_user_id']}, {"_id": 0, "password_hash": 0})
        
        # Get ratings for this outfit in this group
        ratings_cursor = db.outfit_ratings.find({"group_id": group_id, "outfit_id": shared_outfit['outfit_id']}, {"_id": 0})
        ratings = await ratings_cursor.to_list(1000)
        
        # Calculate average rating
        avg_rating = 0
        if ratings:
            avg_rating = sum(r['rating'] for r in ratings) / len(ratings)
        
        # Check if current user has rated this outfit
        user_rating = None
        for rating in ratings:
            if rating['user_id'] == current_user['id']:
                user_rating = rating['rating']
                break
        
        # Convert date strings back to datetime objects
        if isinstance(outfit.get('created_at'), str):
            outfit['created_at'] = datetime.fromisoformat(outfit['created_at'])
        if isinstance(shared_outfit.get('shared_at'), str):
            shared_outfit['shared_at'] = datetime.fromisoformat(shared_outfit['shared_at'])
        
        # Make image URL absolute
        image_url = outfit.get('image_url')
        if image_url and not image_url.startswith(('http://', 'https://')):
            image_url = f"{api_base_url}{image_url}"
        
        shared_outfits.append({
            "id": outfit['id'],
            "name": outfit['name'],
            "category": outfit['category'],
            "season": outfit['season'],
            "color": outfit['color'],
            "image_url": image_url,
            "shared_by": {
                "id": sharer['id'],
                "username": sharer['username']
            },
            "shared_at": shared_outfit['shared_at'],
            "ratings_count": len(ratings),
            "average_rating": round(avg_rating, 1),
            "user_rating": user_rating
        })
    
    return GroupDetail(
        id=group['id'],
        name=group['name'],
        description=group.get('description'),
        creator_id=group['creator_id'],
        creator_name=creator['username'],
        members=members,
        shared_outfits=shared_outfits,
        invite_code=group['invite_code'],
        created_at=group['created_at']
    )

@api_router.post("/groups/join")
async def join_group(
    join_data: JoinGroupRequest,
    current_user: dict = Depends(get_current_user)
):
    """Join a group using invite code"""
    # Find group by invite code
    group = await db.groups.find_one({"invite_code": join_data.invite_code}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    
    # Check if user is already a member
    if current_user['id'] in group['members']:
        raise HTTPException(status_code=400, detail="You are already a member of this group")
    
    # Add user to group
    await db.groups.update_one(
        {"id": group['id']},
        {"$push": {"members": current_user['id']}}
    )
    
    return {"message": "Successfully joined the group"}

@api_router.post("/groups/{group_id}/share")
async def share_outfit_to_group(
    group_id: str,
    outfit_id: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Share an outfit to a group"""
    # Check if group exists and user is a member
    group = await db.groups.find_one({"id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if current_user['id'] not in group['members']:
        raise HTTPException(status_code=403, detail="You are not a member of this group")
    
    # Check if outfit exists and belongs to user
    outfit = await db.outfits.find_one({"id": outfit_id, "user_id": current_user['id']}, {"_id": 0})
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found or you don't have permission to share it")
    
    # Check if outfit is already shared to this group
    existing_share = await db.shared_outfits_to_group.find_one({
        "group_id": group_id,
        "outfit_id": outfit_id
    }, {"_id": 0})
    
    if existing_share:
        raise HTTPException(status_code=400, detail="This outfit is already shared to this group")
    
    # Share outfit to group
    shared_outfit = SharedOutfitToGroup(
        group_id=group_id,
        outfit_id=outfit_id,
        shared_by_user_id=current_user['id']
    )
    
    doc = shared_outfit.model_dump()
    doc['shared_at'] = doc['shared_at'].isoformat()
    
    await db.shared_outfits_to_group.insert_one(doc)
    
    return {"message": "Outfit shared to group successfully"}

@api_router.post("/groups/{group_id}/outfits/{outfit_id}/rate")
async def rate_outfit_in_group(
    group_id: str,
    outfit_id: str,
    rating_data: RatingRequest,
    current_user: dict = Depends(get_current_user)
):
    """Rate an outfit in a group"""
    # Validate rating
    if rating_data.rating < 1 or rating_data.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    # Check if group exists and user is a member
    group = await db.groups.find_one({"id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if current_user['id'] not in group['members']:
        raise HTTPException(status_code=403, detail="You are not a member of this group")
    
    # Check if outfit is shared to this group
    shared_outfit = await db.shared_outfits_to_group.find_one({
        "group_id": group_id,
        "outfit_id": outfit_id
    }, {"_id": 0})
    
    if not shared_outfit:
        raise HTTPException(status_code=404, detail="Outfit not found in this group")
    
    # Check if user has already rated this outfit
    existing_rating = await db.outfit_ratings.find_one({
        "group_id": group_id,
        "outfit_id": outfit_id,
        "user_id": current_user['id']
    }, {"_id": 0})
    
    if existing_rating:
        # Update existing rating
        await db.outfit_ratings.update_one(
            {"id": existing_rating['id']},
            {"$set": {"rating": rating_data.rating}}
        )
        message = "Rating updated successfully"
    else:
        # Create new rating
        rating = OutfitRating(
            group_id=group_id,
            outfit_id=outfit_id,
            user_id=current_user['id'],
            rating=rating_data.rating
        )
        
        doc = rating.model_dump()
        doc['rated_at'] = doc['rated_at'].isoformat()
        
        await db.outfit_ratings.insert_one(doc)
        message = "Rating submitted successfully"
    
    # Calculate new average rating
    ratings_cursor = db.outfit_ratings.find({"group_id": group_id, "outfit_id": outfit_id}, {"_id": 0})
    ratings = await ratings_cursor.to_list(1000)
    avg_rating = sum(r['rating'] for r in ratings) / len(ratings)
    
    return {
        "message": message,
        "average_rating": round(avg_rating, 1),
        "ratings_count": len(ratings)
    }

# --- AI Suggestion Routes ---
@api_router.post("/suggestions/ai", response_model=SuggestionResponse)
async def get_ai_suggestions(current_user: dict = Depends(get_current_user)):
    """
    Returns AI-powered outfit suggestions based on the user's least-worn outfits.
    """
    try:
        # Fetch least-worn outfits
        outfits = await db.outfits.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
        
        if not outfits:
            return SuggestionResponse(suggestions=[], reasoning="No outfits found in your wardrobe.")

        least_used = sorted(outfits, key=lambda x: x.get('usage_count', 0))[:10]
        
        if not least_used:
            return SuggestionResponse(suggestions=[], reasoning="Could not find least-worn outfits to base suggestions on.")

        # Prepare AI Prompt
        outfit_list = "\n".join([
            f"- {o['name']} ({o['category']}, {o['color']}, {o['season']} season, used {o.get('usage_count', 0)} times)"
            for o in least_used
        ])

        prompt = f"""
You are a fashion stylist assistant. Your task is to provide styling suggestions for underutilized outfits.

Here is a list of a user's least-worn outfits:
{outfit_list}

From the list above, select the *4 best outfits* that you believe have the most potential. For each of these 4 selected outfits, provide a creative styling tip, a suitable occasion, and if the outfit is a top (like a shirt, blouse, etc.), suggest a complementary bottom from the list.

Your response must be a single JSON object with a single key "suggestions".
The value of "suggestions" must be a JSON array containing exactly 4 suggestion objects.

Each object in the array must have these four keys:
- "outfit_name": The exact name of the outfit from the list.
- "styling_tip": A creative tip on how to wear it.
- "occasion": A suitable occasion for wearing it.
- "complementary_items": An array of items from the list that would pair well with this outfit. Empty if the outfit is already complete (like a saree or suit).

Example of the expected JSON format:
{{
  "suggestions": [
    {{
      "outfit_name": "White Shirt",
      "styling_tip": "Pair with a bold scarf and boots.",
      "occasion": "Casual Friday",
      "complementary_items": ["Blue Jeans"]
    }},
    {{
      "outfit_name": "Black Saree",
      "styling_tip": "Layer over a turtleneck for a chic look.",
      "occasion": "Weekend Brunch",
      "complementary_items": []
    }}
  ]
}}

Now, generate the suggestions for the provided outfit list.
"""

        # Check if API key is available
        api_key = os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            logging.error("OPENROUTER_API_KEY environment variable is not set!")
            # Return fallback suggestions
            fallback = [
                {
                    "outfit_name": o["name"],
                    "styling_tip": "Try pairing it with different accessories or layering it.",
                    "occasion": "Daily wear",
                    "complementary_items": []
                }
                for o in least_used[:4]
            ]
            return SuggestionResponse(
                suggestions=fallback,
                reasoning="AI service is not configured. Showing basic suggestions for your least-worn items."
            )

        # AI Call with improved error handling
        try:
            client_ai = AsyncOpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=api_key,
            )
            
            response = await client_ai.chat.completions.create(
                model="z-ai/glm-4.5-air:free",
                messages=[
                    {"role": "system", "content": "You are a helpful fashion stylist that always replies in valid JSON. Do not include any text before or after the JSON."},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
            )

            reply_text = response.choices[0].message.content
            logging.info(f"Received raw response from AI: {reply_text}")

            # Parse AI Response
            try:
                ai_data = json.loads(reply_text)
                final_suggestions = []

                if isinstance(ai_data, dict):
                    suggestions_list = ai_data.get("suggestions") or ai_data.get("data") or ai_data.get("results")
                    if isinstance(suggestions_list, list):
                        final_suggestions = suggestions_list
                elif isinstance(ai_data, list):
                    final_suggestions = ai_data

                # Ensure we only return the top 4
                if final_suggestions:
                    final_suggestions = final_suggestions[:4]

                if not final_suggestions:
                    logging.warning(f"AI returned a response, but no suggestions could be extracted. Response: {ai_data}")
                    raise ValueError("AI response did not contain a valid list of suggestions.")

                return SuggestionResponse(
                    suggestions=final_suggestions,
                    reasoning="AI-powered styling suggestions based on your least-worn outfits."
                )

            except json.JSONDecodeError as json_err:
                logging.error(f"Failed to parse AI response as JSON. Error: {json_err}")
                logging.error(f"Raw text that failed to parse: {reply_text}")
                # Return fallback on JSON parse error
                fallback = [
                    {
                        "outfit_name": o["name"],
                        "styling_tip": "Try pairing it with different accessories or layering it.",
                        "occasion": "Daily wear",
                        "complementary_items": []
                    }
                    for o in least_used[:4]
                ]
                return SuggestionResponse(
                    suggestions=fallback,
                    reasoning="AI service returned an invalid response. Showing basic suggestions for your least-worn items."
                )

        except Exception as ai_error:
            err_msg = str(ai_error)
            logging.error(f"AI SERVICE FAILED: {err_msg}\n{traceback.format_exc()}")
            
            # Return fallback suggestions
            fallback = [
                {
                    "outfit_name": o["name"],
                    "styling_tip": "Try pairing it with different accessories or layering it.",
                    "occasion": "Daily wear",
                    "complementary_items": []
                }
                for o in least_used[:4]
            ]
            return SuggestionResponse(
                suggestions=fallback,
                reasoning=f"AI service is currently unavailable: {err_msg}. Showing basic suggestions for your least-worn items."
            )

    except Exception as e:
        logging.error(f"Top-level server error in get_ai_suggestions: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="An internal server error occurred while fetching suggestions.")

@api_router.get("/suggestions/weather", response_model=SuggestionResponse)
async def get_ai_weather_suggestions(
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Provides AI-powered outfit suggestions based on the user's entire wardrobe and the current weather.
    """
    try:
        # Fetch all user outfits
        all_outfits = await db.outfits.find({"user_id": current_user['id']}, {"_id": 0}).to_list(50)
        
        if not all_outfits:
            return SuggestionResponse(suggestions=[], reasoning="No outfits found in your wardrobe.")

        # Get weather data
        temp = 20
        weather_desc = "clear sky"
        location_name = "Your Location"

        try:
            async with httpx.AsyncClient() as client:
                if lat and lon:
                    # Use Open-Meteo free API
                    weather_url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true"
                    weather_response = await client.get(weather_url)
                    weather_data = weather_response.json()
                    
                    # Get location name using reverse geocoding
                    geocode_url = f"https://geocode.maps.co/reverse?lat={lat}&lon={lon}"
                    try:
                        geocode_response = await client.get(geocode_url)
                        geocode_data = geocode_response.json()
                        city = geocode_data.get('address', {}).get('city') or geocode_data.get('address', {}).get('town') or geocode_data.get('address', {}).get('state', 'Your Location')
                        location_name = city
                    except:
                        location_name = f"Lat: {lat:.2f}, Lon: {lon:.2f}"
                    
                    # Parse Open-Meteo response
                    current = weather_data.get('current_weather', {})
                    temp = current.get('temperature', 20)
                    weather_code = current.get('weathercode', 0)
                    
                    # Map weather codes to descriptions
                    weather_descriptions = {
                        0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
                        45: "foggy", 48: "foggy", 51: "light drizzle", 53: "drizzle", 55: "heavy drizzle",
                        61: "light rain", 63: "rain", 65: "heavy rain", 71: "light snow", 73: "snow", 75: "heavy snow",
                        77: "snow grains", 80: "light showers", 81: "showers", 82: "heavy showers",
                        85: "light snow showers", 86: "snow showers", 95: "thunderstorm", 96: "thunderstorm with hail", 99: "heavy thunderstorm"
                    }
                    weather_desc = weather_descriptions.get(weather_code, "clear")
        
        except Exception as e:
            logging.warning(f"Could not fetch weather data: {e}. Using default weather.")

        # Prepare AI Prompt
        outfit_list = "\n".join([f"- {o['name']} ({o['category']}, {o['color']}, {o['season']} season)" for o in all_outfits])
        prompt = f"""You are a fashion stylist. The current weather is {temp}°C and {weather_desc}. Here is a list of all outfits in a user's wardrobe:

{outfit_list}

Your task is to select 3 to 5 outfits from this list that are most appropriate for the current weather conditions. Rank these outfits from "mostly recommended" to "least recommended" based on how well they match the current weather.

For each selected outfit, provide a brief styling tip, a suitable occasion, a recommendation level, and if the outfit is a top (like a shirt, blouse, etc.), suggest a complementary bottom from the list.

Your response must be a single JSON object with a single key "suggestions".
The value of "suggestions" must be a JSON array of objects.
Each object in the array must have these exact keys: "outfit_name", "styling_tip", "occasion", "recommendation_level", and "complementary_items".

The "recommendation_level" must be one of: "mostly recommended", "recommended", or "least recommended".
The "complementary_items" should be an array of items from the list that would pair well with this outfit. Empty if the outfit is already complete (like a saree or suit).

Example of the expected JSON format:
{{
  "suggestions": [
    {{
      "outfit_name": "Blue Denim Jacket",
      "styling_tip": "Perfect for layering over a hoodie.",
      "occasion": "Casual outing",
      "recommendation_level": "mostly recommended",
      "complementary_items": ["White Shirt", "Blue Jeans"]
    }}
  ]
}}

Please rank the suggestions with the most weather-appropriate outfit first (mostly recommended) and the least appropriate last (least recommended).
"""

        # Check if API key is available
        api_key = os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            logging.error("OPENROUTER_API_KEY environment variable is not set!")
            # Return fallback suggestions based on simple season filtering
            if temp < 10: season_filter = ['winter', 'fall', 'all']
            elif temp < 20: season_filter = ['fall', 'spring', 'all']
            else: season_filter = ['summer', 'spring', 'all']
            fallback_outfits = [o for o in all_outfits if o.get('season', 'all') in season_filter][:3]
            
            fallback_suggestions = []
            for i, o in enumerate(fallback_outfits):
                rec_level = "mostly recommended" if i == 0 else ("recommended" if i == 1 else "least recommended")
                fallback_suggestions.append({
                    "outfit_name": o['name'], 
                    "styling_tip": "A good choice for the current weather.", 
                    "occasion": "Daily wear", 
                    "recommendation_level": rec_level,
                    "complementary_items": []
                })
                
            return SuggestionResponse(
                suggestions=fallback_suggestions, 
                reasoning=f"Weather in {location_name}: {temp}°C, {weather_desc}. AI service is not configured."
            )

        # AI Call with improved error handling
        try:
            client_ai = AsyncOpenAI(base_url="https://openrouter.ai/api/v1", api_key=api_key)
            
            response = await client_ai.chat.completions.create(
                model="z-ai/glm-4.5-air:free",
                messages=[
                    {"role": "system", "content": "You are a helpful fashion stylist assistant that always replies in valid JSON. Do not include any text before or after the JSON."},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
            )
            
            reply_text = response.choices[0].message.content
            ai_data = json.loads(reply_text)

            # Parse AI Response and Add Weather Reason
            final_suggestions = []
            if isinstance(ai_data, dict):
                suggestions_list = ai_data.get("suggestions") or ai_data.get("data") or ai_data.get("results")
                if isinstance(suggestions_list, list):
                    # Add weather reason to each suggestion
                    for suggestion in suggestions_list:
                        suggestion['reason'] = f"Perfect for {temp}°C and {weather_desc}"
                        # Ensure complementary_items field exists
                        if 'complementary_items' not in suggestion:
                            suggestion['complementary_items'] = []
                    final_suggestions = suggestions_list
            elif isinstance(ai_data, list):
                for suggestion in ai_data:
                    suggestion['reason'] = f"Perfect for {temp}°C and {weather_desc}"
                    # Ensure complementary_items field exists
                    if 'complementary_items' not in suggestion:
                        suggestion['complementary_items'] = []
                final_suggestions = ai_data

            if not final_suggestions:
                logging.warning(f"AI returned a response, but no suggestions could be extracted. Response: {ai_data}")
                raise ValueError("AI response did not contain a valid list of suggestions.")

            return SuggestionResponse(
                suggestions=final_suggestions,
                reasoning=f"Weather in {location_name}: {temp}°C, {weather_desc}"
            )
        
        # Handle AI Exceptions
        except RateLimitError as e:
            logging.error(f"[/suggestions/weather] RATE LIMIT EXCEEDED: {e}")
            # Fallback suggestions based on simple season filtering
            if temp < 10: season_filter = ['winter', 'fall', 'all']
            elif temp < 20: season_filter = ['fall', 'spring', 'all']
            else: season_filter = ['summer', 'spring', 'all']
            fallback_outfits = [o for o in all_outfits if o.get('season', 'all') in season_filter][:3]
            
            # Add recommendation levels to fallback suggestions
            fallback_suggestions = []
            for i, o in enumerate(fallback_outfits):
                if i == 0:
                    rec_level = "mostly recommended"
                elif i == 1:
                    rec_level = "recommended"
                else:
                    rec_level = "least recommended"
                    
                fallback_suggestions.append({
                    "outfit_name": o['name'], 
                    "styling_tip": "A good choice for the current weather.", 
                    "occasion": "Daily wear", 
                    "reason": f"Perfect for {temp}°C and {weather_desc}",
                    "recommendation_level": rec_level,
                    "complementary_items": []
                })
                
            return SuggestionResponse(
                suggestions=fallback_suggestions, 
                reasoning="You've reached the free daily limit for AI suggestions. Please try again tomorrow or add credits to your account."
            )
        except Exception as ai_error:
            # Handle any other AI-related errors
            err_msg = str(ai_error)
            logging.error(f"[/suggestions/weather] AI SERVICE FAILED: {err_msg}\n{traceback.format_exc()}")
            return SuggestionResponse(suggestions=[], reasoning="AI service is currently unavailable.")

    except Exception as e:
        # This is the final safety net for non-AI related server errors (e.g., database connection)
        logging.error(f"Weather suggestion error: {e}")
        raise HTTPException(status_code=500, detail="An internal server error occurred.")

# --- Utility Routes ---
@api_router.get("/health")
async def health_check():
    """Health check endpoint for deployment platforms"""
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

@api_router.get("/")
async def root():
    return {"message": "Smart Wardrobe API is running"}

# --- App Initialization ---
app.include_router(api_router)

# Add error handling middleware
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logging.error(f"Global exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

@app.on_event("shutdown")
async def shutdown_db_client():
    mongo_client.close()

# Add this for Vercel/local development
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)