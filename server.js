const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const session = require('express-session');
const bodyParser = require('body-parser');
const FileStore = require('session-file-store')(session);

const app = express();
const PORT = process.env.PORT || 3000;

// Path to data files
const keywordsPath = path.join(__dirname, 'keywords.json');
const commandsDataPath = path.join(__dirname, 'commandsData.json');
const videosCachePath = path.join(__dirname, 'videos_cache.json'); // New: Path for video cache

// Helper function to read JSON files
const readJsonFile = (filePath, defaultValue = []) => {
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf8');
            return defaultValue;
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error.message);
        return defaultValue;
    }
};

// Helper function to write JSON files
const writeJsonFile = (filePath, data) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error(`Error writing file ${filePath}:`, error.message);
    }
};

// Load keywords, commands data, and video cache
let keywords = readJsonFile(keywordsPath);
let commandsData = readJsonFile(commandsDataPath, {});
let videosCache = readJsonFile(videosCachePath, {}); // Default to empty object for video cache

// Middleware untuk session dengan FileStore
app.use(session({
    store: new FileStore({
        path: './sessions',
        ttl: 86400 * 7,
        retries: 5,
        logFn: function() {}
    }),
    secret: 'secret-key-super-rahasia-peex-2025-lebih-kuat',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        maxAge: 86400 * 7 * 1000
    }
}));

// Middleware untuk parsing body JSON
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Route untuk halaman utama (index.html akan menangani loading dan home)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route untuk video spesifik berdasarkan ID
// Ini sekarang akan mencoba mengambil dari cache terlebih dahulu
app.get('/v', async (req, res) => {
    const videoId = req.query.id;
    if (!videoId) {
        return res.redirect('/'); // Redirect to home if no ID provided
    }
    // Render index.html, script.js akan membaca videoId dari URL
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route untuk mendapatkan video secara acak atau video spesifik
app.get('/api/videos', async (req, res) => {
    const specificVideoId = req.query.id;

    if (keywords.length === 0) {
        return res.status(500).json({ error: 'Keywords not found or empty.' });
    }

    let videos = [];
    if (specificVideoId) {
        // First, try to get the video from our cache
        if (videosCache[specificVideoId]) {
            videos.push(videosCache[specificVideoId]);
            console.log(`Video ${specificVideoId} found in cache.`);
        } else {
            // If not in cache, try fetching from API (and add to cache if found)
            try {
                const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
                const apiUrl = `https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(randomKeyword)}`;
                const response = await axios.get(apiUrl);
                const foundVideo = response.data.data.videos.find(v => v.video_id === specificVideoId);
                if (foundVideo) {
                    videos.push(foundVideo);
                    videosCache[specificVideoId] = foundVideo; // Add to cache
                    writeJsonFile(videosCachePath, videosCache); // Save cache
                    console.log(`Video ${specificVideoId} fetched from API and added to cache.`);
                }
            } catch (error) {
                console.error(`Error fetching specific video ${specificVideoId} from API:`, error.message);
            }
        }
    }

    if (videos.length === 0) { // If no specific video found (or not requested), fetch random
        const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
        const apiUrl = `https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(randomKeyword)}`;
        try {
            const response = await axios.get(apiUrl);
            const fetchedVideos = response.data.data.videos;
            videos = fetchedVideos;

            // Add new fetched videos to cache
            fetchedVideos.forEach(v => {
                if (!videosCache[v.video_id]) {
                    videosCache[v.video_id] = v;
                }
            });
            writeJsonFile(videosCachePath, videosCache); // Save cache
            console.log(`Fetched random videos. Cache size: ${Object.keys(videosCache).length}`);
        } catch (error) {
            console.error('Error fetching random videos:', error.message);
            return res.status(500).json({ error: 'Failed to fetch videos.' });
        }
    }

    if (!req.session.favorites) {
        req.session.favorites = [];
    }
    if (!req.session.likes) {
        req.session.likes = {};
    }

    res.json({ videos, favorites: req.session.favorites, likes: req.session.likes });
});


// Route to proxy video download (handles CORS and ensures direct download)
app.get('/download-video', async (req, res) => {
    const videoUrl = req.query.url;
    const videoTitle = req.query.title || 'video';

    if (!videoUrl) {
        return res.status(400).send('Video URL is required.');
    }

    try {
        const response = await axios({
            method: 'GET',
            url: videoUrl,
            responseType: 'stream', // Get as stream to avoid loading entire file into memory
            headers: {
                // Mimic a browser to avoid some anti-bot measures from video hosts
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.tikwm.com/' // Sometimes useful to set a referer
            }
        });

        res.setHeader('Content-Type', response.headers['content-type'] || 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="${videoTitle}.mp4"`);
        res.setHeader('Content-Length', response.headers['content-length']); // Pass content-length if available

        response.data.pipe(res); // Pipe the video stream directly to the client
    } catch (error) {
        console.error(`Error proxying video download from ${videoUrl}:`, error.message);
        // Log more details for debugging
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response headers:', error.response.headers);
            // console.error('Response data:', error.response.data); // Don't log for streams
        }
        res.status(500).send('Failed to download video.');
    }
});


// Route untuk menyimpan command untuk video spesifik
app.post('/api/command', (req, res) => {
    const { video_id, username, command } = req.body;
    if (!video_id || !username || !command) {
        return res.status(400).json({ error: 'Video ID, username, and command are required.' });
    }

    if (!commandsData[video_id]) {
        commandsData[video_id] = [];
    }

    const newCommand = {
        id: Date.now(),
        username,
        command,
        timestamp: new Date().toISOString()
    };
    commandsData[video_id].push(newCommand);
    writeJsonFile(commandsDataPath, commandsData);
    res.status(201).json({ message: 'Command saved successfully!', command: newCommand });
});

// Route untuk mendapatkan semua command untuk video spesifik
app.get('/api/commands/:video_id', (req, res) => {
    const videoId = req.params.video_id;
    res.json(commandsData[videoId] || []);
});

// Route untuk like/unlike video
app.post('/api/like', (req, res) => {
    const { video_id, action } = req.body;
    if (!video_id || !action) {
        return res.status(400).json({ error: 'Video ID and action are required.' });
    }

    if (!req.session.likes) {
        req.session.likes = {};
    }

    if (action === 'like') {
        req.session.likes[video_id] = true;
    } else if (action === 'unlike') {
        delete req.session.likes[video_id];
    } else {
        return res.status(400).json({ error: 'Invalid action.' });
    }
    req.session.save(err => {
        if (err) console.error('Error saving session:', err);
        res.json({ success: true, likes: req.session.likes });
    });
});

// Route untuk menambahkan/menghapus video dari favorit
app.post('/api/favorite', (req, res) => {
    const { video_id, action, videoData } = req.body;
    if (!video_id || !action) {
        return res.status(400).json({ error: 'Video ID and action are required.' });
    }

    if (!req.session.favorites) {
        req.session.favorites = [];
    }

    if (action === 'add') {
        if (!req.session.favorites.some(fav => fav.video_id === video_id)) {
            // Only store necessary data to keep session size manageable
            const simplifiedVideoData = {
                video_id: videoData.video_id,
                title: videoData.title,
                cover: videoData.cover,
                play: videoData.play, // Keep play URL for direct access/download
                region: videoData.region,
                author: videoData.author
            };
            req.session.favorites.push(simplifiedVideoData);
        }
    } else if (action === 'remove') {
        req.session.favorites = req.session.favorites.filter(fav => fav.video_id !== video_id);
    } else {
        return res.status(400).json({ error: 'Invalid action.' });
    }
    req.session.save(err => {
        if (err) console.error('Error saving session:', err);
        res.json({ success: true, favorites: req.session.favorites });
    });
});

// Route untuk mendapatkan video favorit
app.get('/api/favorites', (req, res) => {
    if (!req.session.favorites) {
        req.session.favorites = [];
    }
    res.json({ favorites: req.session.favorites });
});

// Endpoint untuk "Human Check" (simulasi)
app.post('/human-check', (req, res) => {
    res.json({ success: true });
});

// 404 handler - This must be the last middleware
app.use((req, res, next) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});