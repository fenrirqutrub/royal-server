

# 🚀 Backend Server Setup Guide (Step by Step)

Production-ready **Node.js + Express + MongoDB + Cloudinary** backend API setup instructions.

---

# 📌 Step 1: Clone Repository

```bash
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name
```

---

# 📌 Step 2: Install Dependencies

```bash
npm install
```

---

# 📌 Step 3: Create Environment File

Project root এ `.env` নামে একটি ফাইল তৈরি করো।

```bash
touch .env
```

তারপর নিচের configuration paste করো:

```env
# ==============================
# 🌍 Application Configuration
# ==============================

NODE_ENV=production
PORT=5000

# ==============================
# 🗄 Database Configuration
# ==============================

MONGODB_URI=your_mongodb_connection_string

# ==============================
# ☁ Cloudinary Configuration
# ==============================

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# ==============================
# 🔐 Security & CORS
# ==============================

ALLOWED_ORIGINS=http://localhost:5173
TRUST_PROXY=1
```

---

# 📌 Step 4: Setup MongoDB

### Option 1: MongoDB Atlas (Recommended)

1. Go to MongoDB Atlas
2. Create a cluster
3. Create a database user
4. Whitelist IP address (0.0.0.0/0 for development)
5. Copy connection string
6. Paste inside:

```
MONGODB_URI=your_connection_string
```

Example:

```
mongodb+srv://username:password@cluster.mongodb.net/dbname
```

---

# 📌 Step 5: Setup Cloudinary

1. Create account on Cloudinary
2. Go to Dashboard
3. Copy:

* Cloud Name
* API Key
* API Secret

4. Paste them inside `.env`

---

# 📌 Step 6: Run the Server

## 🛠 Development Mode

```bash
npm run dev
```

## 🚀 Production Mode

```bash
npm start
```

Server will run at:

```
http://localhost:5000
```

---

# 📌 Step 7: Test API

You can test using:

* Postman
* Thunder Client
* Browser (for GET routes)

---

# 📌 Step 8: Prepare for Deployment

Before deploying:

✔ Set `NODE_ENV=production`
✔ Add all environment variables in hosting dashboard
✔ Never upload `.env` file
✔ Add `.env` in `.gitignore`

`.gitignore` example:

```
node_modules
.env
```

---

# 📌 Step 9: Deploy (Render / Railway / VPS)

### Render / Railway:

1. Connect GitHub repository
2. Add environment variables manually
3. Set build command:

```
npm install
```

4. Set start command:

```
npm start
```

5. Deploy

---

# 📌 Step 10: Production Notes

If using reverse proxy (Nginx / Render / Railway):

```
TRUST_PROXY=1
```

If frontend is deployed:

```
ALLOWED_ORIGINS=https://yourfrontenddomain.com
```

---

# 🔒 Security Checklist

* Never commit `.env`
* Never expose MongoDB URI
* Never expose Cloudinary API Secret
* Always use HTTPS in production
* Use strong database password

---

# 📁 Example Project Structure

```
├── src/
│   ├── controllers/
│   ├── routes/
│   ├── models/
│   ├── middleware/
│   └── config/
├── .env
├── package.json
└── server.js
```

---

# ✅ Complete Setup Flow Summary

1. Clone repo
2. Install dependencies
3. Create `.env`
4. Setup MongoDB
5. Setup Cloudinary
6. Run server
7. Test API
8. Deploy
9. Configure production environment

