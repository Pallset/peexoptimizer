// ------------- Asupan - PeeX ------------- \\
// ------------- Simply Express.js Site ------------- \\
// ------------- Credit On @LO_POO [ TELEGRAM ] ------------- \\


const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const session = require('express-session');
const bodyParser = require('body-parser');
const FileStore = require('session-file-store')(session);
const app = express();
const PORT = process.env.PORT || 3000;
const sessionsDir = path.join(__dirname, 'sessions');
if (!fs.existsSync(sessionsDir)) {
  fs.mkdirSync(sessionsDir, { recursive: true });
}
const keywordsPath = path.join(__dirname, 'keywords.json');
const commandsDataPath = path.join(__dirname, 'commandsData.json');
const videosCachePath = path.join(__dirname, 'videos_cache.json');
const readJsonFile = (filePath, defaultValue = []) => {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf8');
      return defaultValue;
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return defaultValue;
  }
};
const writeJsonFile = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
};
let keywords = readJsonFile(keywordsPath, []);
let commandsData = readJsonFile(commandsDataPath, {});
let videosCache = readJsonFile(videosCachePath, {});

// =====> USE <===== \\
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  store: new FileStore({
    path: sessionsDir,
    ttl: 86400 * 7,
    retries: 5,
    logFn: function() {}
  }),
  secret: 'secret-key-super-rahasia-peex-2025-lebih-kuat',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 86400 * 7 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'public')));


 // =====> GET <===== \\
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/v', (req, res) => {
  const videoId = req.query.id;
  if (!videoId) {
    return res.redirect('/');
  }

  if (!videosCache[videoId]) {
    return res.status(404).send(`<h1>404 Video not found</h1><p>Video ID ${videoId} tidak ditemukan di cache.</p>`);
  }

  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/api/videos', async (req, res) => {
  try {
    const specificVideoId = req.query.id;
    let videos = [];

    if (!keywords || keywords.length === 0) {
      return res.status(500).json({ error: 'Keywords not found.' });
    }

    if (specificVideoId) {
      if (videosCache[specificVideoId]) {
        videos.push(videosCache[specificVideoId]);
      } else {
        const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
        const apiUrl = `https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(randomKeyword)}`;
        const { data } = await axios.get(apiUrl);
        const foundVideo = data?.data?.videos?.find(v => v.video_id === specificVideoId);
        if (foundVideo) {
          videosCache[specificVideoId] = foundVideo;
          writeJsonFile(videosCachePath, videosCache);
          videos.push(foundVideo);
        }
      }
    }

    if (videos.length === 0) {
      const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
      const apiUrl = `https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(randomKeyword)}`;
      const { data } = await axios.get(apiUrl);
      videos = data?.data?.videos || [];
      videos.forEach(v => {
        if (!videosCache[v.video_id]) {
          videosCache[v.video_id] = v;
        }
      });
      writeJsonFile(videosCachePath, videosCache);
    }

    if (!req.session.favorites) req.session.favorites = [];
    if (!req.session.likes) req.session.likes = {};

    res.json({
      videos,
      favorites: req.session.favorites,
      likes: req.session.likes
    });
  } catch (err) {
    console.error('Error in /api/videos:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});
app.get('/download-video', async (req, res) => {
  const videoUrl = req.query.url;
  const videoTitle = req.query.title || 'video';

  if (!videoUrl) {
    return res.status(400).send('Video URL is required.');
  }

  try {
    const response = await axios({
      url: videoUrl,
      method: 'GET',
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://www.tikwm.com/'
      }
    });

    res.setHeader('Content-Type', response.headers['content-type'] || 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${videoTitle}.mp4"`);
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
    response.data.pipe(res);
  } catch (err) {
    console.error(`Error download proxy:`, err.message);
    res.status(500).send('Failed to proxy download.');
  }
});
app.get('/api/commands/:video_id', (req, res) => {
  const videoId = req.params.video_id;
  res.json(commandsData[videoId] || []);
});
app.get('/script.js', (req, res) => {
  res.redirect('/');
});
app.get('/style.css', (req, res) => {
  res.redirect('/');
});


// =====> POST <===== \\
app.post('/api/command', (req, res) => {
  const { video_id, username, command } = req.body;
  if (!video_id || !username || !command) {
    return res.status(400).json({ error: 'Video ID, username, and command are required.' });
  }

  if (!commandsData[video_id]) commandsData[video_id] = [];

  const newCommand = {
    id: Date.now(),
    username,
    command,
    timestamp: new Date().toISOString()
  };

  commandsData[video_id].push(newCommand);
  writeJsonFile(commandsDataPath, commandsData);

  res.status(201).json({ message: 'Command saved!', command: newCommand });
});
app.post('/api/like', (req, res) => {
  const { video_id, action } = req.body;
  if (!video_id || !action) {
    return res.status(400).json({ error: 'Video ID and action are required.' });
  }

  if (!req.session.likes) req.session.likes = {};

  if (action === 'like') {
    req.session.likes[video_id] = true;
  } else if (action === 'unlike') {
    delete req.session.likes[video_id];
  } else {
    return res.status(400).json({ error: 'Invalid action.' });
  }

  req.session.save(err => {
    if (err) console.error(err);
    res.json({ success: true, likes: req.session.likes });
  });
});
app.post('/human-check', (req, res) => {
  res.json({ success: true });
});
app.post('/api/favorite', (req, res) => {
  const { video_id, action, videoData } = req.body;
  if (!video_id || !action) {
    return res.status(400).json({ error: 'Video ID and action are required.' });
  }

  if (!req.session.favorites) req.session.favorites = [];

  if (action === 'add') {
    if (!req.session.favorites.some(f => f.video_id === video_id)) {
      req.session.favorites.push({
        video_id: videoData.video_id,
        title: videoData.title,
        cover: videoData.cover,
        play: videoData.play,
        region: videoData.region,
        author: videoData.author
      });
    }
  } else if (action === 'remove') {
    req.session.favorites = req.session.favorites.filter(f => f.video_id !== video_id);
  } else {
    return res.status(400).json({ error: 'Invalid action.' });
  }

  req.session.save(err => {
    if (err) console.error(err);
    res.json({ success: true, favorites: req.session.favorites });
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
