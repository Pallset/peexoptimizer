document.addEventListener('DOMContentLoaded', () => {
    // --- Elements for Loading Screen ---
    const loadingContainer = document.getElementById('loading-container');
    const loadingText = document.querySelector('.loading-text');
    const spinner = document.querySelector('.spinner');
    const humanCheckBox = document.getElementById('human-check-box');
    const checkbox = document.getElementById('human-checkbox');
    const continueButton = document.getElementById('continue-button');

    // --- Elements for Main Content ---
    const mainContent = document.getElementById('main-content');
    const videoContainer = document.getElementById('video-container');
    const showFavoritesBtn = document.getElementById('show-favorites-btn');
    const showCommandsBtn = document.getElementById('show-commands-btn');
    const showHomeBtn = document.getElementById('show-home-btn');
    const commandModal = document.getElementById('command-modal');
    const favoritesModal = document.getElementById('favorites-modal');
    const closeButtons = document.querySelectorAll('.close-button');
    const commandInput = document.getElementById('command-input');
    const sendCommandBtn = document.getElementById('send-command-btn');
    const commandsList = document.getElementById('commands-list');
    const favoritesList = document.getElementById('favorites-list');
    const loadingMoreVideos = document.getElementById('loading-more-videos');
    const modalCommandTitle = commandModal.querySelector('h2');

    let videosData = [];
    let favorites = [];
    let likes = {};
    let currentPlayingVideo = null;
    let currentVideoIdForCommands = null;
    let fetchingMore = false; // Flag to prevent multiple concurrent fetch calls

    // Ensure loading container is active and main content is hidden initially
    loadingContainer.classList.add('active');
    mainContent.classList.add('hidden');

    // --- Anti-DevMode and View Source (client-side, easily bypassable) ---
    // This is more for casual users; determined individuals can bypass this.
    document.addEventListener('contextmenu', event => event.preventDefault());
    document.onkeydown = function(e) {
        if (e.keyCode == 123) return false; // F12
        if (e.ctrlKey && e.shiftKey && e.keyCode == 'I'.charCodeAt(0)) return false; // Ctrl+Shift+I
        if (e.ctrlKey && e.shiftKey && e.keyCode == 'J'.charCodeAt(0)) return false; // Ctrl+Shift+J
        if (e.ctrlKey && e.keyCode == 'U'.charCodeAt(0)) return false; // Ctrl+U
    };

    // --- Loading Screen Logic ---
    let loadingProgress = 0;
    const totalLoadingTime = 2500; // Adjusted for a slightly faster load before check
    const intervalTime = 50;

    const loadingInterval = setInterval(() => {
        loadingProgress += intervalTime;
        if (loadingProgress >= totalLoadingTime) {
            clearInterval(loadingInterval);
            spinner.style.display = 'none';
            loadingText.textContent = 'Verification Complete';
            humanCheckBox.style.display = 'flex'; // Show the checkbox
        }
    }, intervalTime);

    checkbox.addEventListener('change', () => {
        continueButton.disabled = !checkbox.checked;
    });

    continueButton.addEventListener('click', async () => {
        if (checkbox.checked) {
            try {
                // Simulate server-side human check (replace with actual backend call if needed)
                // This is a placeholder; a real DDoS protection would involve server-side validation.
                const response = await fetch('/human-check', { // Your server needs to handle this POST request
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isHuman: true })
                });
                const data = await response.json();
                
                if (data.success) { // Assuming your server returns { success: true }
                    // Fade out loading screen
                    loadingContainer.classList.remove('active');
                    loadingContainer.classList.add('hidden');

                    // After the loading screen transition, show main content and fetch videos
                    setTimeout(() => {
                        mainContent.classList.remove('hidden');
                        mainContent.classList.add('active'); // Add active class if you have CSS transitions for main-content
                        
                        const urlParams = new URLSearchParams(window.location.search);
                        const initialVideoId = urlParams.get('id');
                        fetchVideos(initialVideoId); // Fetch the specific video or random
                    }, 500); // This delay should match the CSS transition duration for loading-container.hidden
                } else {
                    alert('Human verification failed. Please try again.');
                }
            } catch (error) {
                console.error('Error during human check:', error);
                alert('An error occurred during verification. Please try again.');
            }
        }
    });

    // --- Video Loading and Display ---
    async function fetchVideos(specificVideoId = null) {
        if (fetchingMore) return;
        fetchingMore = true;
        loadingMoreVideos.style.display = 'flex'; // Show loading indicator with flex for centering spinner

        try {
            let url = '/api/videos'; // Your API endpoint to fetch videos
            if (specificVideoId) {
                url += `?id=${specificVideoId}`;
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            // Filter out duplicate videos based on video_id before adding
            const newVideos = data.videos.filter(
                newVid => !videosData.some(existingVid => existingVid.video_id === newVid.video_id)
            );
            videosData = [...videosData, ...newVideos];
            favorites = data.favorites || [];
            likes = data.likes || {};
            renderVideos(); // Render newly fetched videos

            // If a specific video was requested and found, scroll to it and try to play
            if (specificVideoId && newVideos.length > 0) {
                const videoCard = document.querySelector(`.video-card[data-video-id="${specificVideoId}"]`);
                if (videoCard) {
                    videoCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    const videoElement = videoCard.querySelector('.video-wrapper video');
                    if (videoElement) {
                        if (currentPlayingVideo && currentPlayingVideo !== videoElement) {
                            currentPlayingVideo.pause();
                        }
                        // Attempt to play, but catch errors if autoplay is blocked by browser
                        videoElement.play().catch(e => console.warn("Autoplay specific video prevented:", e));
                        currentPlayingVideo = videoElement;
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching videos:', error);
            videoContainer.innerHTML = '<p style="text-align: center; color: var(--secondary-color);">Failed to load videos. Please try again later.</p>';
        } finally {
            loadingMoreVideos.style.display = 'none'; // Hide loading indicator
            fetchingMore = false;
        }
    }

    function renderVideos() {
        // Collect IDs of videos already rendered to avoid re-rendering
        const existingVideoIds = new Set(Array.from(videoContainer.querySelectorAll('.video-card')).map(card => card.dataset.videoId));

        videosData.forEach((video) => {
            if (!existingVideoIds.has(video.video_id)) {
                const videoCard = document.createElement('div');
                videoCard.classList.add('video-card');
                videoCard.dataset.videoId = video.video_id;

                videoCard.innerHTML = `
                    <div class="video-wrapper">
                        <video loop playsinline preload="metadata" data-video-id="${video.video_id}" poster="${video.cover || ''}">
                            <source src="${video.play}" type="video/mp4">
                            Your browser does not support the video tag.
                        </video>
                        <img src="/assets/peex_logo.png" alt="PeeX Authority" class="peex-logo-overlay">
                        <div class="watermark-overlay">https://asupan.peexs.my.id/</div>
                    </div>
                    <div class="video-description">
                        <div class="video-title">${video.title}</div>
                        <p>Source: TikTok | Creator: ${video.author || 'Unknown'}</p>
                    </div>
                    <div class="video-controls">
                        <div class="button-group">
                            <button class="like-btn ${likes[video.video_id] ? 'liked' : ''}" data-video-id="${video.video_id}">
                                ${likes[video.video_id] ? '<i class="fas fa-heart"></i> Liked' : '<i class="far fa-heart"></i> Like'}
                            </button>
                            <button class="favorite-btn ${favorites.some(fav => fav.video_id === video.video_id) ? 'favorited' : ''}" data-video-id="${video.video_id}" data-video-data='${JSON.stringify(video)}'>
                                ${favorites.some(fav => fav.video_id === video.video_id) ? '<i class="fas fa-star"></i> Favorited' : '<i class="far fa-star"></i> Add to Fav'}
                            </button>
                            <button class="comment-btn" data-video-id="${video.video_id}"><i class="fas fa-comment-dots"></i> Command</button>
                            <button class="download-btn" data-video-url="${encodeURIComponent(video.play)}" data-video-title="${encodeURIComponent(video.title.replace(/[^a-z0-9]/gi, '_'))}"><i class="fas fa-download"></i> Download</button>
                            <button class="copy-link-btn" data-video-id="${video.video_id}"><i class="fas fa-link"></i> Copy Link</button>
                        </div>
                    </div>
                `;
                videoContainer.appendChild(videoCard);
            }
        });

        // Attach listeners to video elements and controls after rendering
        addEventListenersToVideoElements();
    }

    function addEventListenersToVideoElements() {
        // Event delegation for all buttons and video interaction within videoContainer
        // This listener only needs to be added once to the parent container.
        videoContainer.removeEventListener('click', handleVideoContainerClick); // Prevent duplicate listeners
        videoContainer.addEventListener('click', handleVideoContainerClick);

        // Intersection Observer for auto-play/pause
        const options = {
            root: null, // viewport
            rootMargin: '0px',
            threshold: 0.7 // video needs to be 70% visible to play
        };

        // Disconnect previous observer if exists to avoid issues with re-observing
        if (window.videoObserver) {
            window.videoObserver.disconnect();
        }

        window.videoObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const videoElement = entry.target;
                if (entry.isIntersecting) {
                    // Only play if no other video is currently playing OR if it's the current one
                    if (!currentPlayingVideo || currentPlayingVideo === videoElement) {
                         videoElement.play().catch(e => console.warn("Autoplay prevented:", e));
                         currentPlayingVideo = videoElement;
                    } else if (currentPlayingVideo && currentPlayingVideo !== videoElement) {
                        // If another video is playing, pause it before playing the new one
                        currentPlayingVideo.pause();
                        videoElement.play().catch(e => console.warn("Autoplay prevented:", e));
                        currentPlayingVideo = videoElement;
                    }
                } else {
                    if (!videoElement.paused) {
                        videoElement.pause();
                        if (currentPlayingVideo === videoElement) {
                            currentPlayingVideo = null;
                        }
                    }
                }
            });
        }, options);

        // Observe all video elements that haven't been observed yet
        document.querySelectorAll('.video-wrapper video:not([data-observed])').forEach(videoElement => {
            videoElement.setAttribute('data-observed', 'true'); // Mark as observed
            window.videoObserver.observe(videoElement);

            // Handle video ending: play next video or fetch more
            videoElement.addEventListener('ended', () => {
                const currentVideoCard = videoElement.closest('.video-card');
                // Find the index of the current video in videosData
                const currentVideoIndex = videosData.findIndex(v => v.video_id === currentVideoCard.dataset.videoId);
                const nextVideo = videosData[currentVideoIndex + 1];

                if (nextVideo) {
                    // If next video exists in data, find its card and play
                    const nextVideoCard = document.querySelector(`.video-card[data-video-id="${nextVideo.video_id}"]`);
                    if (nextVideoCard) {
                        const nextVideoElement = nextVideoCard.querySelector('video');
                        if (nextVideoElement) {
                            nextVideoElement.play().catch(e => console.warn("Autoplay next prevented:", e));
                            currentPlayingVideo = nextVideoElement;
                            nextVideoCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }
                } else {
                    // If no next video in data, fetch more
                    fetchVideos().then(() => {
                        // After fetching, try to find and play the next video (which should now be in videosData)
                        const nextVideoAfterFetch = videosData[currentVideoIndex + 1];
                        if (nextVideoAfterFetch) {
                            const nextVideoCard = document.querySelector(`.video-card[data-video-id="${nextVideoAfterFetch.video_id}"]`);
                            if (nextVideoCard) {
                                const firstNewVideoElement = nextVideoCard.querySelector('video');
                                if (firstNewVideoElement) {
                                    firstNewVideoElement.play().catch(e => console.warn("Autoplay new video prevented:", e));
                                    currentPlayingVideo = firstNewVideoElement;
                                    firstNewVideoElement.closest('.video-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }
                            }
                        }
                    });
                }
            });
        });
    }

    // Function to handle clicks within the videoContainer (delegated events)
    async function handleVideoContainerClick(e) {
        const target = e.target;
        // Find the closest parent with data-video-id or a button/anchor within a video card
        const videoId = target.dataset.videoId || target.closest('.video-card')?.dataset.videoId;
        const videoElement = target.closest('.video-card')?.querySelector('.video-wrapper video');

        // Handle video play/pause on click anywhere on the video area, but not on buttons
        if (target.closest('.video-wrapper') && !target.closest('.video-controls')) {
            if (videoElement) {
                if (videoElement.paused) {
                    if (currentPlayingVideo && currentPlayingVideo !== videoElement) {
                        currentPlayingVideo.pause();
                    }
                    videoElement.play().catch(err => console.warn("Play prevented by user gesture:", err));
                    currentPlayingVideo = videoElement;
                } else {
                    videoElement.pause();
                    if (currentPlayingVideo === videoElement) {
                        currentPlayingVideo = null;
                    }
                }
            }
            return; // Stop here if it's a video area click, not a button click
        }

        if (!videoId) return; // If no video ID associated with the clicked element, exit

        // --- Button Handlers (delegated) ---
        // Like/Unlike Button
        if (target.classList.contains('like-btn') || target.closest('.like-btn')) {
            const button = target.closest('.like-btn');
            const isLiked = button.classList.contains('liked');
            const action = isLiked ? 'unlike' : 'like';
            try {
                const response = await fetch('/api/like', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ video_id: videoId, action: action })
                });
                const data = await response.json();
                if (data.success) {
                    likes = data.likes;
                    button.classList.toggle('liked');
                    button.innerHTML = likes[videoId] ? '<i class="fas fa-heart"></i> Liked' : '<i class="far fa-heart"></i> Like';
                }
            } catch (error) {
                console.error('Error liking/unliking:', error);
            }
        }

        // Favorite Button
        else if (target.classList.contains('favorite-btn') || target.closest('.favorite-btn')) {
            const button = target.closest('.favorite-btn');
            const videoData = JSON.parse(button.dataset.videoData);
            const isFavorited = favorites.some(fav => fav.video_id === videoId);
            const action = isFavorited ? 'remove' : 'add';
            try {
                const response = await fetch('/api/favorite', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ video_id: videoId, action: action, videoData: videoData })
                });
                const data = await response.json();
                if (data.success) {
                    favorites = data.favorites;
                    button.classList.toggle('favorited');
                    button.innerHTML = favorites.some(fav => fav.video_id === videoId) ? '<i class="fas fa-star"></i> Favorited' : '<i class="far fa-star"></i> Add to Fav';
                }
            } catch (error) {
                console.error('Error adding/removing favorite:', error);
            }
        }

        // Command Button
        else if (target.classList.contains('comment-btn') || target.closest('.comment-btn')) {
            currentVideoIdForCommands = videoId;
            openModal(commandModal);
            const videoTitle = videosData.find(v => v.video_id === videoId)?.title || videoId;
            modalCommandTitle.textContent = `Commands for Video: ${videoTitle.substring(0, 30)}${videoTitle.length > 30 ? '...' : ''}`;
            fetchCommands(videoId);
        }

        // Download Button (using server-side proxy for better compatibility)
        else if (target.classList.contains('download-btn') || target.closest('.download-btn')) {
            const button = target.closest('.download-btn');
            const videoUrl = decodeURIComponent(button.dataset.videoUrl);
            const videoTitle = decodeURIComponent(button.dataset.videoTitle);
            window.location.href = `/download-video?url=${encodeURIComponent(videoUrl)}&title=${encodeURIComponent(videoTitle)}`;
        }

        // Copy Link Button
        else if (target.classList.contains('copy-link-btn') || target.closest('.copy-link-btn')) {
            const button = target.closest('.copy-link-btn');
            const link = `https://asupan.peexs.my.id/v?id=${videoId}`; // Replace with your actual domain
            try {
                await navigator.clipboard.writeText(link);
                alert('Link copied to clipboard!');
            } catch (err) {
                console.error('Failed to copy text: ', err);
                alert('Failed to copy link. Please copy manually: ' + link);
            }
        }
    }


    // --- Modals ---
    function openModal(modalElement) {
        if (currentPlayingVideo && !currentPlayingVideo.paused) {
            currentPlayingVideo.pause();
        }
        modalElement.classList.add('active'); // Apply 'active' class for CSS transition
        modalElement.style.display = 'flex'; // Ensure it's displayed as flex
    }

    function closeModal(modalElement) {
        modalElement.classList.remove('active'); // Remove 'active' class to trigger fade out
        // Delay display:none to allow transition to finish
        setTimeout(() => {
            modalElement.style.display = 'none';
        }, 300); // This delay should match the CSS transition duration
        currentVideoIdForCommands = null;
    }

    closeButtons.forEach(button => {
        button.onclick = (e) => {
            closeModal(e.target.closest('.modal'));
        };
    });

    window.onclick = (event) => {
        if (event.target === commandModal) {
            closeModal(commandModal);
        }
        if (event.target === favoritesModal) {
            closeModal(favoritesModal);
        }
    };

    // --- Commands Feature (per video) ---
    showCommandsBtn.onclick = () => {
        if (videosData.length > 0) {
            const firstVisibleVideoCard = videoContainer.querySelector('.video-card');
            currentVideoIdForCommands = firstVisibleVideoCard ? firstVisibleVideoCard.dataset.videoId : (videosData[0] ? videosData[0].video_id : null);

            if (currentVideoIdForCommands) {
                openModal(commandModal);
                const videoTitle = videosData.find(v => v.video_id === currentVideoIdForCommands)?.title || currentVideoIdForCommands;
                modalCommandTitle.textContent = `Commands for Video: ${videoTitle.substring(0, 30)}${videoTitle.length > 30 ? '...' : ''}`;
                fetchCommands(currentVideoIdForCommands);
            } else {
                alert('No active video to view commands for. Please load videos first.');
            }
        } else {
            alert('No videos loaded yet to view commands.');
        }
    };

    async function fetchCommands(videoId) {
        if (!videoId) return;
        try {
            const response = await fetch(`/api/commands/${videoId}`);
            const commands = await response.json();
            displayCommands(commands);
        } catch (error) {
            console.error('Error fetching commands:', error);
            commandsList.innerHTML = '<p>Failed to load commands.</p>';
        }
    }

    function displayCommands(commands) {
        commandsList.innerHTML = '';
        if (commands.length === 0) {
            commandsList.innerHTML = '<p>No commands yet. Be the first to comment!</p>';
            return;
        }
        commands.forEach(cmd => {
            const cmdItem = document.createElement('div');
            cmdItem.classList.add('command-item');
            cmdItem.innerHTML = `<strong>${cmd.username}:</strong> ${cmd.command} <br><small>${new Date(cmd.timestamp).toLocaleString()}</small>`;
            commandsList.appendChild(cmdItem);
        });
        commandsList.scrollTop = commandsList.scrollHeight;
    }

    sendCommandBtn.onclick = async () => {
        const commandText = commandInput.value.trim();
        if (!commandText || !currentVideoIdForCommands) return;

        const randomNames = ["Budi", "Siti", "Agus", "Dewi", "Rizky", "Putri", "Joko", "Ani", "Surya", "Maya", "PeeX"];
        const randomUsername = randomNames[Math.floor(Math.random() * randomNames.length)];

        try {
            const response = await fetch('/api/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ video_id: currentVideoIdForCommands, username: randomUsername, command: commandText })
            });
            const data = await response.json();
            if (data.success) {
                commandInput.value = '';
                fetchCommands(currentVideoIdForCommands);
            } else {
                alert('Failed to send command.');
            }
        } catch (error) {
            console.error('Error sending command:', error);
            alert('An error occurred while sending command.');
        }
    };

    // --- Favorites Feature ---
    showFavoritesBtn.onclick = () => {
        renderFavorites();
        openModal(favoritesModal);
    };

    showHomeBtn.onclick = () => {
        closeModal(favoritesModal);
        closeModal(commandModal);
        // IntersectionObserver will handle resuming playback if user scrolls back to a video
    };

    function renderFavorites() {
        favoritesList.innerHTML = '';
        if (favorites.length === 0) {
            favoritesList.innerHTML = '<p>You have no favorite videos yet.</p>';
            return;
        }
        favorites.forEach(video => {
            const favItem = document.createElement('div');
            favItem.classList.add('favorite-item');
            favItem.innerHTML = `
                <img src="${video.cover}" alt="Video Cover">
                <div class="info">
                    <strong>${video.title}</strong><br>
                    <small>${video.region}</small>
                </div>
                <div class="favorite-item-buttons">
                    <button class="remove-btn" data-video-id="${video.video_id}"><i class="fas fa-trash-alt"></i> Remove</button>
                    <button class="download-btn-fav" data-video-url="${encodeURIComponent(video.play)}" data-video-title="${encodeURIComponent(video.title.replace(/[^a-z0-9]/gi, '_'))}"><i class="fas fa-download"></i></button>
                    <button class="copy-link-btn" data-video-id="${video.video_id}"><i class="fas fa-link"></i></button>
                    <button class="play-fav-btn" data-video-id="${video.video_id}"><i class="fas fa-play"></i></button>
                </div>
            `;
            favoritesList.appendChild(favItem);
        });

        // Add event listeners for remove, download, copy link, and play buttons in favorites modal
        favoritesList.querySelectorAll('.remove-btn').forEach(button => {
            button.onclick = async (e) => {
                const videoId = e.target.dataset.videoId || e.target.closest('button').dataset.videoId;
                try {
                    const response = await fetch('/api/favorite', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ video_id: videoId, action: 'remove' })
                    });
                    const data = await response.json();
                    if (data.success) {
                        favorites = data.favorites;
                        renderFavorites(); // Re-render favorites list
                        // Update main page favorite button state
                        const mainPageFavButton = document.querySelector(`.favorite-btn[data-video-id="${videoId}"]`);
                        if (mainPageFavButton) {
                            mainPageFavButton.classList.remove('favorited');
                            mainPageFavButton.innerHTML = '<i class="far fa-star"></i> Add to Fav';
                        }
                    }
                } catch (error) {
                    console.error('Error removing favorite:', error);
                }
            };
        });

        favoritesList.querySelectorAll('.download-btn-fav').forEach(button => {
            button.onclick = async (e) => {
                const videoUrl = decodeURIComponent(e.target.dataset.videoUrl || e.target.closest('button').dataset.videoUrl);
                const videoTitle = decodeURIComponent(e.target.dataset.videoTitle || e.target.closest('button').dataset.videoTitle);
                window.location.href = `/download-video?url=${encodeURIComponent(videoUrl)}&title=${encodeURIComponent(videoTitle)}`;
            };
        });

        favoritesList.querySelectorAll('.copy-link-btn').forEach(button => {
            button.onclick = async (e) => {
                const videoId = e.target.dataset.videoId || e.target.closest('button').dataset.videoId;
                const link = `https://asupan.peexs.my.id/v?id=${videoId}`;
                try {
                    await navigator.clipboard.writeText(link);
                    alert('Link copied to clipboard!');
                } catch (err) {
                    console.error('Failed to copy text: ', err);
                    alert('Failed to copy link. Please copy manually: ' + link);
                }
            };
        });

        favoritesList.querySelectorAll('.play-fav-btn').forEach(button => {
            button.onclick = (e) => {
                const videoId = e.target.dataset.videoId || e.target.closest('button').dataset.videoId;
                // Redirect to the main page with video ID to play it
                window.location.href = `/v?id=${videoId}`;
            };
        });
    }

    // Infinite scroll
    window.addEventListener('scroll', async () => {
        // Only fetch more if main content is active and not currently fetching
        if (!mainContent.classList.contains('active') || fetchingMore) return;

        // Fetch more videos when scroll reaches within 1000px from bottom
        if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1000) {
            console.log('Fetching more videos...');
            await fetchVideos();
        }
    });
});
