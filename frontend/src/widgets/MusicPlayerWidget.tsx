import { useState, useRef, useEffect } from 'react';
import * as MusicPlayerService from '../../bindings/ltools/plugins/musicplayer/service';
import { Song } from '../../bindings/ltools/plugins/musicplayer/models';
import { Icon } from '../components/Icon';

export function MusicPlayerWidget() {
    const [songs, setSongs] = useState<Song[]>([]);
    const [currentSong, setCurrentSong] = useState<Song | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [coverURL, setCoverURL] = useState<string>('');
    const [preloadQueue, setPreloadQueue] = useState<Song[]>([]); // 预加载队列
    const [songCovers, setSongCovers] = useState<Map<string, string>>(new Map()); // 搜索结果封面缓存
    const [showLyrics, setShowLyrics] = useState(false); // 是否显示歌词
    const [lyrics, setLyrics] = useState<string>(''); // 歌词内容
    const [parsedLyrics, setParsedLyrics] = useState<Array<{ time: number; text: string }>>([]); // 解析后的歌词
    const [isPreloading, setIsPreloading] = useState(false); // 是否正在预加载
    const [hasInitialized, setHasInitialized] = useState(false); // 是否已初始化
    const [currentLyricIndex, setCurrentLyricIndex] = useState(-1); // 当前行索引

    const audioRef = useRef<HTMLAudioElement>(null);
    const lyricsContainerRef = useRef<HTMLDivElement>(null);
    const lastScrollTimeRef = useRef<number>(0); // 上次滚动时间

    // 更新进度
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateProgress = () => {
            if (audio.currentTime && audio.duration) {
                setProgress(audio.currentTime);
                setDuration(audio.duration);
            }
        };

        audio.addEventListener('timeupdate', updateProgress);
        audio.addEventListener('loadedmetadata', updateProgress);

        return () => {
            audio.removeEventListener('timeupdate', updateProgress);
            audio.removeEventListener('loadedmetadata', updateProgress);
        };
    }, []);

    // 音频事件监听器
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleError = (e: Event) => {
            const target = e.target as HTMLAudioElement;
            const error = target.error;
            if (error) {
                console.error('🎵 Audio Error:', error.message);
            }
        };

        // 自动播放下一曲
        const handleEnded = () => {
            console.log('🎵 Song ended, playing next...');
            playNext();
        };

        audio.addEventListener('error', handleError);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('error', handleError);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [songs, currentIndex]); // 依赖 songs 和 currentIndex

    // 预加载队列管理
    useEffect(() => {
        // 只在已初始化后才自动补充预加载队列
        // 当队列剩余少于3首时，自动补充
        // 但要确保不在加载中、不在预加载中，避免重复请求
        if (hasInitialized && preloadQueue.length < 3 && !isLoading && !isPreloading) {
            preloadMoreSongs();
        }
    }, [preloadQueue.length, isLoading, isPreloading, hasInitialized]);

    // 歌词滚动：根据当前播放进度滚动到对应歌词行
    useEffect(() => {
        if (!showLyrics || parsedLyrics.length === 0 || !lyricsContainerRef.current) return;

        // 找到当前应该显示的歌词行
        const currentTime = progress;
        let newLineIndex = 0;

        for (let i = 0; i < parsedLyrics.length; i++) {
            if (parsedLyrics[i].time <= currentTime) {
                newLineIndex = i;
            } else {
                break;
            }
        }

        // 只在行改变时才滚动（避免频繁滚动）
        if (newLineIndex === currentLyricIndex) {
            return;
        }

        setCurrentLyricIndex(newLineIndex);

        // 节流：限制滚动频率（最少间隔 300ms）
        const now = Date.now();
        if (now - lastScrollTimeRef.current < 300) {
            return;
        }
        lastScrollTimeRef.current = now;

        // 使用 requestAnimationFrame 优化滚动性能
        requestAnimationFrame(() => {
            const container = lyricsContainerRef.current;
            if (!container) return;

            const lineElements = container.querySelectorAll('.lyrics-line');
            const currentElement = lineElements[newLineIndex] as HTMLElement;

            if (currentElement) {
                // 计算滚动位置：当前行居中
                const containerHeight = container.clientHeight;
                const elementTop = currentElement.offsetTop;
                const elementHeight = currentElement.clientHeight;
                const scrollTop = elementTop - containerHeight / 2 + elementHeight / 2;

                // 使用 instant 滚动，避免 smooth 导致的抖动
                container.scrollTop = Math.max(0, scrollTop);
            }
        });
    }, [progress, parsedLyrics, showLyrics, currentLyricIndex]);

    // 切换歌曲时重置歌词显示状态
    useEffect(() => {
        setShowLyrics(false);
        setCurrentLyricIndex(-1);
        lastScrollTimeRef.current = 0;
    }, [currentSong?.id]);

    // 格式化时间
    const formatTime = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // 解析 LRC 歌词格式
    const parseLyrics = (lrcText: string) => {
        if (!lrcText) return [];

        const lines = lrcText.split('\n');
        const parsed: Array<{ time: number; text: string }> = [];

        for (const line of lines) {
            // 匹配 [mm:ss.xx] 或 [mm:ss] 格式的时间标签
            const match = line.match(/\[(\d{2}):(\d{2})\.?(\d{2})?\](.*)/);
            if (match) {
                const minutes = parseInt(match[1]);
                const seconds = parseInt(match[2]);
                const milliseconds = match[3] ? parseInt(match[3]) : 0;
                const time = minutes * 60 + seconds + milliseconds / 100;
                const text = match[4].trim();

                if (text) {
                    parsed.push({ time, text });
                }
            }
        }

        return parsed.sort((a, b) => a.time - b.time);
    };

    // 获取并解析歌词
    const fetchLyrics = async (song: Song) => {
        console.log('🎵 [Lyrics] Fetching lyrics for song:', song.name, 'lyric_id:', song.lyric_id);

        if (!song.lyric_id) {
            console.warn('🎵 [Lyrics] No lyric_id for song:', song.name);
            setLyrics('');
            setParsedLyrics([]);
            return;
        }

        try {
            console.log('🎵 [Lyrics] Calling GetLyric API with lyric_id:', song.lyric_id);
            const lyricText = await MusicPlayerService.GetLyric(song.lyric_id);
            console.log('🎵 [Lyrics] Got lyric text (length:', lyricText.length, '):', lyricText.substring(0, 100));

            setLyrics(lyricText);
            const parsed = parseLyrics(lyricText);
            console.log('🎵 [Lyrics] Parsed', parsed.length, 'lines:', parsed.slice(0, 3));
            setParsedLyrics(parsed);
        } catch (error) {
            console.error('🎵 [Lyrics] Failed to load lyrics:', error);
            setLyrics('');
            setParsedLyrics([]);
        }
    };

    // 预加载更多歌曲
    const preloadMoreSongs = async () => {
        // 防止重复预加载
        if (isPreloading) {
            console.log('🎵 [Preload] Already preloading, skip');
            return;
        }

        setIsPreloading(true);
        try {
            console.log('🎵 [Preload] Starting preload...');
            const newSongs = await MusicPlayerService.GetRandomSongs(5);
            console.log('🎵 [Preload] Preloaded', newSongs.length, 'songs');
            setPreloadQueue(prev => [...prev, ...newSongs]);
        } catch (error) {
            console.error('🎵 [Preload] Failed to preload songs:', error);
            // 失败后等待5秒再重试，避免频繁请求
            setTimeout(() => {
                setIsPreloading(false);
            }, 5000);
            return;
        } finally {
            setIsPreloading(false);
        }
    };

    // 随机播放（使用预加载队列）
    const playRandom = async () => {
        if (isLoading) {
            console.log('🎵 [Random] Already loading, skip');
            return;
        }

        // 标记已初始化，启动预加载机制
        if (!hasInitialized) {
            setHasInitialized(true);
        }

        setIsLoading(true);
        try {
            let songsToPlay: Song[] = [];

            // 如果预加载队列有歌曲，直接使用
            if (preloadQueue.length >= 3) {
                console.log('🎵 [Random] Using preload queue, size:', preloadQueue.length);
                songsToPlay = preloadQueue.slice(0, 10);
                // 从队列中移除已使用的歌曲
                setPreloadQueue(prev => prev.slice(10));
            } else {
                // 队列不足，直接加载
                console.log('🎵 [Random] Preload queue insufficient, loading directly...');
                const results = await MusicPlayerService.GetRandomSongs(10);
                songsToPlay = results;
            }

            // 预加载封面图片
            console.log('🎵 [Random] Preloading covers for', songsToPlay.length, 'songs');
            const coverMap = new Map<string, string>();
            await Promise.all(
                songsToPlay.map(async (song) => {
                    if (song.pic_id) {
                        try {
                            const picURL = await MusicPlayerService.GetPicURL(song.pic_id);
                            coverMap.set(song.id, picURL);
                        } catch (error) {
                            console.error(`🎵 [Random] Failed to load cover for ${song.name}:`, error);
                        }
                    }
                })
            );
            setSongCovers(coverMap);

            // 设置歌曲列表并开始播放
            setSongs(songsToPlay);
            if (songsToPlay.length > 0) {
                setCurrentIndex(0);
                await playSong(songsToPlay[0]);
            }

            // 后台继续预加载更多歌曲（延迟1秒，避免并发请求）
            setTimeout(() => {
                if (preloadQueue.length < 3 && !isPreloading) {
                    preloadMoreSongs();
                }
            }, 1000);
        } catch (error) {
            console.error('🎵 [Random] Failed to get random songs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // 搜索歌曲
    const searchSongs = async () => {
        if (!searchKeyword.trim()) return;

        console.log('🎵 [Search] Starting search for:', searchKeyword);
        setIsLoading(true);
        try {
            const results = await MusicPlayerService.Search(searchKeyword);
            console.log('🎵 [Search] Got', results.length, 'results');
            setSongs(results);

            if (results.length > 0) {
                setCurrentSong(results[0]);
                setCurrentIndex(0);
                checkIfLiked(results[0]);
            }

            // 预加载搜索结果的封面图片
            console.log('🎵 [Search] Starting cover preload...');
            const coverMap = new Map<string, string>();
            console.log('🎵 [Search] Preloading covers for', results.length, 'songs');

            await Promise.all(
                results.map(async (song) => {
                    console.log(`🎵 [Search] Song ${song.name}: pic_id="${song.pic_id}"`);
                    if (song.pic_id) {
                        try {
                            const picURL = await MusicPlayerService.GetPicURL(song.pic_id);
                            console.log(`🎵 [Search] Got cover URL for ${song.name}:`, picURL);
                            coverMap.set(song.id, picURL);
                        } catch (error) {
                            console.error(`🎵 [Search] Failed to load cover for ${song.name} (id=${song.id}, pic_id="${song.pic_id}"):`, error);
                        }
                    } else {
                        console.warn(`🎵 [Search] Song ${song.name} has no pic_id`);
                    }
                })
            );

            console.log('🎵 [Search] Final coverMap size:', coverMap.size, 'keys:', Array.from(coverMap.keys()));
            setSongCovers(coverMap);
            console.log('🎵 [Search] Cover preload complete');
        } catch (error) {
            console.error('🎵 [Search] Search failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // 播放歌曲
    const playSong = async (song: Song, retryCount = 0) => {
        if (!audioRef.current) return;

        console.log('🎵 [PlaySong] Playing song:', {
            name: song.name,
            id: song.id,
            lyric_id: song.lyric_id,
            pic_id: song.pic_id
        });

        try {
            const url = await MusicPlayerService.GetSongURL(song.id);

            if (!url) {
                console.error('🎵 No URL returned for song:', song.id);
                if (retryCount < 3) {
                    setTimeout(() => playSong(song, retryCount + 1), 1000);
                }
                return;
            }

            setCurrentSong(song);
            audioRef.current.src = url;
            await audioRef.current.play();
            setIsPlaying(true);

            // 获取封面图片URL
            if (song.pic_id) {
                try {
                    const picURL = await MusicPlayerService.GetPicURL(song.pic_id);
                    setCoverURL(picURL);
                } catch (error) {
                    console.error('Failed to get cover URL:', error);
                    setCoverURL('');
                }
            } else {
                setCoverURL('');
            }

            // 获取歌词
            await fetchLyrics(song);
        } catch (error) {
            console.error('🎵 Failed to get song URL:', error);
        }
    };

    // 检查歌曲是否已喜欢
    const checkIfLiked = async (song: Song) => {
        try {
            const likeList = await MusicPlayerService.GetLikeList();
            const liked = likeList.some(s => s.id === song.id);
            setIsLiked(liked);
        } catch (error) {
            console.error('Failed to check like status:', error);
        }
    };

    // 切换播放/暂停
    const togglePlay = async () => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            if (audioRef.current.src) {
                await audioRef.current.play();
                setIsPlaying(true);
            }
        }
    };

    // 上一曲
    const playPrev = () => {
        if (songs.length === 0) return;
        const prevIndex = currentIndex === 0 ? songs.length - 1 : currentIndex - 1;
        setCurrentIndex(prevIndex);
        playSong(songs[prevIndex]);
    };

    // 下一曲（自动补充预加载队列）
    const playNext = async () => {
        // 标记已初始化
        if (!hasInitialized) {
            setHasInitialized(true);
        }

        if (songs.length === 0) {
            // 如果没有歌曲列表，从预加载队列获取
            if (preloadQueue.length > 0) {
                const nextSong = preloadQueue[0];
                setSongs([nextSong]);
                setCurrentIndex(0);
                setPreloadQueue(prev => prev.slice(1));
                await playSong(nextSong);
            } else {
                // 队列也为空，重新加载
                await playRandom();
            }
            return;
        }

        const nextIndex = (currentIndex + 1) % songs.length;
        setCurrentIndex(nextIndex);
        await playSong(songs[nextIndex]);

        // 即将播完时，后台补充队列
        if (nextIndex >= songs.length - 2 && preloadQueue.length < 5 && !isPreloading) {
            setTimeout(() => preloadMoreSongs(), 1000);
        }
    };

    // 切换喜欢状态
    const toggleLike = async () => {
        if (!currentSong) return;

        try {
            if (isLiked) {
                await MusicPlayerService.RemoveFromLikes(currentSong.id);
                setIsLiked(false);
            } else {
                await MusicPlayerService.AddToLikes(currentSong);
                setIsLiked(true);
            }
        } catch (error) {
            console.error('Failed to toggle like:', error);
        }
    };

    // 播放结束自动下一曲
    const handleEnded = () => {
        playNext();
    };

    // 进度条点击
    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!audioRef.current || !duration) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        const newTime = percentage * duration;

        audioRef.current.currentTime = newTime;
        setProgress(newTime);
    };

    return (
        <>
            <div className="vinyl-player">
                {/* 背景装饰 */}
                <div className="vinyl-bg-glow" />

                {/* 主容器 */}
                <div className="vinyl-container" style={{ '--wails-draggable': 'drag' } as React.CSSProperties}>
                    {/* 关闭按钮 */}
                    <button
                        onClick={() => MusicPlayerService.HideWindow()}
                        className="vinyl-close-btn"
                        style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
                        title="关闭窗口"
                    >
                        <Icon name="x" size={14} />
                    </button>

                    {/* 黑胶唱片 */}
                    <div
                        className="vinyl-disc-container"
                        onClick={() => setShowLyrics(!showLyrics)}
                        style={{ cursor: 'pointer' }}
                        title={showLyrics ? '点击显示封面' : '点击显示歌词'}
                    >
                        {/* 旋转的唱片背景和封面 */}
                        <div className={`vinyl-disc ${isPlaying ? 'spinning' : ''}`}>
                            <div className="vinyl-grooves" />

                            {/* 封面图片 - 跟着旋转 */}
                            {!showLyrics && (
                                <div className="vinyl-center">
                                    {currentSong && coverURL ? (
                                        <img
                                            src={coverURL}
                                            alt={currentSong.name}
                                            className="vinyl-cover"
                                        />
                                    ) : (
                                        <div className="vinyl-cover-placeholder">
                                            <Icon name="sparkles" size={32} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 静态的歌词显示区域 */}
                        {showLyrics && (
                            <div className="vinyl-lyrics-display" ref={lyricsContainerRef}>
                                {parsedLyrics.length > 0 ? (
                                    parsedLyrics.map((line, index) => {
                                        const isCurrentLine = (() => {
                                            const currentTime = progress;
                                            const nextLine = parsedLyrics[index + 1];
                                            return line.time <= currentTime &&
                                                   (!nextLine || nextLine.time > currentTime);
                                        })();

                                        return (
                                            <div
                                                key={index}
                                                className={`lyrics-line ${isCurrentLine ? 'current' : ''}`}
                                            >
                                                {line.text}
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="lyrics-empty">
                                        {lyrics ? '解析歌词失败' : '暂无歌词'}
                                    </div>
                                )}
                            </div>
                        )}

                        {isLoading && (
                            <div className="vinyl-loading">
                                <div className="vinyl-loading-spinner" />
                            </div>
                        )}
                    </div>

                    {/* 歌曲信息 */}
                    {currentSong && (
                        <div className="vinyl-info">
                            <h3 className="vinyl-title">{currentSong.name}</h3>
                            <p className="vinyl-artist">{currentSong.artist.join(', ')}</p>
                        </div>
                    )}

                    {/* 进度条 */}
                    <div className="vinyl-progress-container">
                        <span className="vinyl-time">{formatTime(progress)}</span>
                        <div className="vinyl-progress-bar" onClick={handleProgressClick}>
                            <div
                                className="vinyl-progress-fill"
                                style={{ width: `${(progress / duration) * 100}%` }}
                            />
                            <div
                                className="vinyl-progress-dot"
                                style={{ left: `${(progress / duration) * 100}%` }}
                            />
                        </div>
                        <span className="vinyl-time">{formatTime(duration)}</span>
                    </div>

                    {/* 喜欢按钮 - 左上角 */}
                    {currentSong && (
                        <button
                            onClick={toggleLike}
                            className={`vinyl-like-btn ${isLiked ? 'liked' : ''}`}
                            title={isLiked ? '取消喜欢' : '喜欢'}
                        >
                            <Icon name="heart" size={18} />
                        </button>
                    )}

                    {/* 控制按钮 */}
                    <div className="vinyl-controls">
                        <button
                            onClick={playRandom}
                            className="vinyl-btn vinyl-btn-secondary"
                            title="随机播放"
                            disabled={isLoading}
                        >
                            <Icon name="refresh" size={20} />
                        </button>

                        <button
                            onClick={playPrev}
                            className="vinyl-btn vinyl-btn-tertiary"
                            title="上一曲"
                        >
                            <Icon name="chevron-left" size={20} />
                        </button>

                        <button
                            onClick={togglePlay}
                            className="vinyl-btn vinyl-btn-primary"
                            title={isPlaying ? '暂停' : '播放'}
                        >
                            <Icon name={isPlaying ? 'pause' : 'play'} size={24} />
                        </button>

                        <button
                            onClick={playNext}
                            className="vinyl-btn vinyl-btn-tertiary"
                            title="下一曲"
                        >
                            <Icon name="chevron-right" size={20} />
                        </button>

                        <button
                            onClick={() => setShowSearch(!showSearch)}
                            className="vinyl-btn vinyl-btn-secondary"
                            title={showSearch ? '关闭搜索' : '搜索'}
                        >
                            <Icon name={showSearch ? 'x' : 'search'} size={20} />
                        </button>
                    </div>
                </div>

                {/* 搜索面板 */}
                {showSearch && (
                    <div className="vinyl-search-overlay">
                        <div className="vinyl-search-panel">
                            <button
                                onClick={() => setShowSearch(false)}
                                className="vinyl-search-close"
                            >
                                <Icon name="x" size={16} />
                            </button>

                            <div className="vinyl-search-input-wrapper">
                                <Icon name="search" size={18} />
                                <input
                                    type="text"
                                    value={searchKeyword}
                                    onChange={(e) => setSearchKeyword(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && searchSongs()}
                                    placeholder="搜索歌曲..."
                                    className="vinyl-search-input"
                                    autoFocus
                                />
                            </div>

                            {songs.length > 0 && (
                                <div className="vinyl-search-results">
                                    {songs.map((song, index) => {
                                        const coverUrl = songCovers.get(song.id);
                                        console.log(`🎵 [Render] Song ${index}: ${song.name}, coverUrl=`, coverUrl);

                                        return (
                                            <div
                                                key={index}
                                                onClick={() => {
                                                    playSong(song);
                                                    setShowSearch(false);
                                                }}
                                                className="vinyl-search-item"
                                            >
                                                {coverUrl ? (
                                                    <img
                                                        src={coverUrl}
                                                        alt={song.name}
                                                        className="vinyl-search-cover"
                                                    />
                                                ) : (
                                                    <div className="vinyl-search-cover-placeholder">
                                                        <Icon name="sparkles" size={20} />
                                                    </div>
                                                )}
                                                <div className="vinyl-search-info">
                                                    <div className="vinyl-search-title">{song.name}</div>
                                                    <div className="vinyl-search-artist">{song.artist.join(', ')}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* 音频元素 */}
            <audio ref={audioRef} onEnded={handleEnded} crossOrigin="anonymous" preload="auto" />

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Rajdhani:wght@300;400;500;600;700&display=swap');

                .vinyl-player {
                    position: relative;
                    width: 100vw;
                    height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%);
                    overflow: hidden;
                }

                /* 背景光晕效果 */
                .vinyl-bg-glow {
                    position: absolute;
                    width: 600px;
                    height: 600px;
                    border-radius: 50%;
                    background: radial-gradient(circle,
                        rgba(255, 0, 128, 0.15) 0%,
                        rgba(0, 255, 255, 0.1) 30%,
                        transparent 70%
                    );
                    filter: blur(60px);
                    animation: vinyl-pulse 4s ease-in-out infinite;
                }

                @keyframes vinyl-pulse {
                    0%, 100% { transform: scale(1); opacity: 0.6; }
                    50% { transform: scale(1.2); opacity: 0.8; }
                }

                /* 主容器 */
                .vinyl-container {
                    position: relative;
                    z-index: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 24px;
                    padding: 48px 40px 40px;
                }

                /* 关闭按钮 */
                .vinyl-close-btn {
                    position: absolute;
                    top: 30px;
                    right: 8px;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: rgba(255, 0, 128, 0.1);
                    border: 1px solid rgba(255, 0, 128, 0.3);
                    color: #ff0080;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    z-index: 10;
                }

                .vinyl-close-btn:hover {
                    background: rgba(255, 0, 128, 0.2);
                    border-color: rgba(255, 0, 128, 0.5);
                    transform: rotate(90deg) scale(1.1);
                    box-shadow: 0 0 20px rgba(255, 0, 128, 0.5);
                }

                /* 黑胶唱片容器 */
                .vinyl-disc-container {
                    position: relative;
                    width: 320px;
                    height: 320px;
                }

                /* 黑胶唱片 */
                .vinyl-disc {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%);
                    box-shadow:
                        0 0 0 8px #0a0a0a,
                        0 0 40px rgba(0, 255, 255, 0.3),
                        0 0 80px rgba(255, 0, 128, 0.2),
                        inset 0 0 60px rgba(0, 0, 0, 0.8);
                    animation: vinyl-idle-glow 3s ease-in-out infinite;
                    z-index: 1;
                }

                @keyframes vinyl-idle-glow {
                    0%, 100% {
                        box-shadow:
                            0 0 0 8px #0a0a0a,
                            0 0 40px rgba(0, 255, 255, 0.3),
                            0 0 80px rgba(255, 0, 128, 0.2),
                            inset 0 0 60px rgba(0, 0, 0, 0.8);
                    }
                    50% {
                        box-shadow:
                            0 0 0 8px #0a0a0a,
                            0 0 60px rgba(0, 255, 255, 0.5),
                            0 0 100px rgba(255, 0, 128, 0.4),
                            inset 0 0 60px rgba(0, 0, 0, 0.8);
                    }
                }

                .vinyl-disc.spinning {
                    animation: vinyl-spin 3s linear infinite;
                }

                @keyframes vinyl-spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                /* 黑胶纹理 */
                .vinyl-grooves {
                    position: absolute;
                    inset: 0;
                    border-radius: 50%;
                    background: repeating-radial-gradient(
                        circle at center,
                        transparent 0px,
                        transparent 1px,
                        rgba(255, 255, 255, 0.03) 2px,
                        transparent 3px
                    );
                    opacity: 0.6;
                }

                /* 唱片中心 */
                .vinyl-center {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 160px;
                    height: 160px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #ff0080 0%, #00ffff 100%);
                    padding: 3px;
                    box-shadow:
                        0 0 30px rgba(255, 0, 128, 0.5),
                        inset 0 0 20px rgba(0, 0, 0, 0.3);
                    z-index: 1;
                }

                .vinyl-cover {
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    object-fit: cover;
                    box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.5);
                }

                .vinyl-cover-placeholder {
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #1a1a2e 0%, #0a0a0a 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: rgba(255, 0, 128, 0.3);
                }

                /* 歌词显示区域 */
                .vinyl-lyrics-display {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 280px;
                    height: 280px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, rgba(26, 26, 46, 0.98) 0%, rgba(10, 10, 10, 0.98) 100%);
                    overflow-y: auto;
                    overflow-x: hidden;
                    padding: 60px 30px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: flex-start;
                    box-shadow:
                        0 0 30px rgba(255, 0, 128, 0.5),
                        inset 0 0 20px rgba(0, 0, 0, 0.3);
                    z-index: 2;

                    /* 隐藏滚动条 - Firefox */
                    scrollbar-width: none;
                    /* 隐藏滚动条 - IE/Edge */
                    -ms-overflow-style: none;
                }

                /* 隐藏滚动条 - Chrome/Safari/Opera */
                .vinyl-lyrics-display::-webkit-scrollbar {
                    display: none;
                }

                .vinyl-lyrics-display::-webkit-scrollbar {
                    width: 4px;
                }

                .vinyl-lyrics-display::-webkit-scrollbar-track {
                    background: transparent;
                }

                .vinyl-lyrics-display::-webkit-scrollbar-thumb {
                    background: rgba(0, 255, 255, 0.3);
                    border-radius: 2px;
                }

                .lyrics-line {
                    font-family: 'Rajdhani', sans-serif;
                    font-size: 13px;
                    color: rgba(255, 255, 255, 0.4);
                    padding: 6px 12px;
                    text-align: center;
                    transition: all 0.3s ease;
                    line-height: 1.6;
                    min-width: 100px;
                }

                .lyrics-line.current {
                    color: #00ffff;
                    font-size: 15px;
                    font-weight: 600;
                    text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
                    transform: scale(1.05);
                }

                .lyrics-empty {
                    font-family: 'Rajdhani', sans-serif;
                    font-size: 14px;
                    color: rgba(255, 255, 255, 0.3);
                    text-align: center;
                    padding: 20px;
                }

                /* 加载动画 */
                .vinyl-loading {
                    position: absolute;
                    inset: 0;
                    border-radius: 50%;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    backdrop-filter: blur(4px);
                }

                .vinyl-loading-spinner {
                    width: 48px;
                    height: 48px;
                    border: 3px solid transparent;
                    border-top-color: #00ffff;
                    border-right-color: #ff0080;
                    border-radius: 50%;
                    animation: vinyl-loading-spin 1s linear infinite;
                }

                @keyframes vinyl-loading-spin {
                    to { transform: rotate(360deg); }
                }

                /* 歌曲信息 */
                .vinyl-info {
                    text-align: center;
                    max-width: 320px;
                    animation: vinyl-fade-in 0.5s ease-out;
                }

                @keyframes vinyl-fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .vinyl-title {
                    font-family: 'Orbitron', monospace;
                    font-size: 20px;
                    font-weight: 700;
                    background: linear-gradient(90deg, #ff0080, #00ffff);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    margin: 0 0 8px 0;
                    text-shadow: 0 0 20px rgba(255, 0, 128, 0.5);
                    letter-spacing: 0.5px;
                }

                .vinyl-artist {
                    font-family: 'Rajdhani', sans-serif;
                    font-size: 16px;
                    color: rgba(255, 255, 255, 0.6);
                    margin: 0;
                    font-weight: 500;
                    letter-spacing: 0.5px;
                }

                /* 进度条 */
                .vinyl-progress-container {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    width: 320px;
                }

                .vinyl-time {
                    font-family: 'Orbitron', monospace;
                    font-size: 11px;
                    color: rgba(0, 255, 255, 0.8);
                    min-width: 40px;
                    font-weight: 500;
                    letter-spacing: 0.5px;
                }

                .vinyl-progress-bar {
                    flex: 1;
                    height: 4px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 2px;
                    position: relative;
                    cursor: pointer;
                    overflow: visible;
                    transition: height 0.2s;
                }

                .vinyl-progress-bar:hover {
                    height: 6px;
                }

                .vinyl-progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #ff0080, #00ffff);
                    border-radius: 2px;
                    transition: width 0.1s linear;
                    box-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
                }

                .vinyl-progress-dot {
                    position: absolute;
                    top: 50%;
                    width: 12px;
                    height: 12px;
                    background: #00ffff;
                    border-radius: 50%;
                    transform: translate(-50%, -50%);
                    box-shadow: 0 0 10px rgba(0, 255, 255, 0.8);
                    opacity: 0;
                    transition: opacity 0.2s;
                }

                .vinyl-progress-bar:hover .vinyl-progress-dot {
                    opacity: 1;
                }

                /* 控制按钮 */
                .vinyl-controls {
                    display: flex;
                    gap: 16px;
                    align-items: center;
                }

                .vinyl-btn {
                    border: none;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    font-family: inherit;
                }

                .vinyl-btn-primary {
                    width: 64px;
                    height: 64px;
                    background: linear-gradient(135deg, #ff0080, #00ffff);
                    color: white;
                    box-shadow: 0 0 30px rgba(255, 0, 128, 0.5);
                }

                .vinyl-btn-primary:hover {
                    transform: scale(1.1);
                    box-shadow: 0 0 50px rgba(255, 0, 128, 0.8);
                }

                .vinyl-btn-primary:active {
                    transform: scale(0.95);
                }

                .vinyl-btn-secondary {
                    width: 44px;
                    height: 44px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(0, 255, 255, 0.3);
                    color: #00ffff;
                }

                .vinyl-btn-secondary:hover {
                    background: rgba(0, 255, 255, 0.1);
                    border-color: rgba(0, 255, 255, 0.6);
                    box-shadow: 0 0 20px rgba(0, 255, 255, 0.5);
                    transform: scale(1.05);
                }

                .vinyl-btn-secondary:disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                }

                .vinyl-btn-secondary:disabled:hover {
                    transform: none;
                    box-shadow: none;
                }

                .vinyl-btn-tertiary {
                    width: 44px;
                    height: 44px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 0, 128, 0.3);
                    color: #ff0080;
                }

                .vinyl-btn-tertiary:hover {
                    background: rgba(255, 0, 128, 0.1);
                    border-color: rgba(255, 0, 128, 0.6);
                    box-shadow: 0 0 20px rgba(255, 0, 128, 0.5);
                    transform: scale(1.05);
                }

                /* 喜欢按钮 - 左上角 */
                .vinyl-like-btn {
                    position: absolute;
                    top: 30px;
                    left: 10px;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 0, 128, 0.3);
                    color: rgba(255, 0, 128, 0.5);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    z-index: 10;
                }

                .vinyl-like-btn:hover {
                    background: rgba(255, 0, 128, 0.1);
                    border-color: rgba(255, 0, 128, 0.6);
                    box-shadow: 0 0 20px rgba(255, 0, 128, 0.5);
                    transform: scale(1.1);
                }

                .vinyl-like-btn.liked {
                    background: rgba(255, 0, 128, 0.2);
                    border-color: #ff0080;
                    color: #ff0080;
                    box-shadow: 0 0 20px rgba(255, 0, 128, 0.5);
                }

                /* 搜索面板 */
                .vinyl-search-overlay {
                    position: absolute;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.9);
                    backdrop-filter: blur(10px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 100;
                    animation: vinyl-fade-in 0.3s ease-out;
                }

                .vinyl-search-panel {
                    width: 400px;
                    max-width: 90vw;
                    background: rgba(26, 26, 46, 0.95);
                    border: 1px solid rgba(0, 255, 255, 0.3);
                    border-radius: 20px;
                    padding: 24px;
                    box-shadow: 0 0 40px rgba(0, 255, 255, 0.3);
                    position: relative;
                }

                .vinyl-search-close {
                    position: absolute;
                    top: 16px;
                    right: 16px;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: rgba(255, 0, 128, 0.1);
                    border: 1px solid rgba(255, 0, 128, 0.3);
                    color: #ff0080;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s;
                    z-index:999;
                }

                .vinyl-search-close:hover {
                    background: rgba(255, 0, 128, 0.2);
                    border-color: rgba(255, 0, 128, 0.5);
                    transform: rotate(90deg);
                }

                .vinyl-search-input-wrapper {
                    position: relative;
                    margin-bottom: 16px;
                    color: rgba(0, 255, 255, 0.5);
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(0, 255, 255, 0.2);
                    border-radius: 12px;
                    padding: 12px 16px;
                    transition: all 0.3s;
                }

                .vinyl-search-input-wrapper:focus-within {
                    border-color: rgba(0, 255, 255, 0.6);
                    box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
                }

                .vinyl-search-input {
                    flex: 1;
                    background: transparent;
                    border: none;
                    outline: none;
                    color: white;
                    font-family: 'Rajdhani', sans-serif;
                    font-size: 16px;
                    font-weight: 500;
                }

                .vinyl-search-input::placeholder {
                    color: rgba(255, 255, 255, 0.3);
                }

                .vinyl-search-results {
                    max-height: 400px;
                    overflow-y: auto;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(0, 255, 255, 0.3) transparent;
                }

                .vinyl-search-results::-webkit-scrollbar {
                    width: 6px;
                }

                .vinyl-search-results::-webkit-scrollbar-track {
                    background: transparent;
                }

                .vinyl-search-results::-webkit-scrollbar-thumb {
                    background: rgba(0, 255, 255, 0.3);
                    border-radius: 3px;
                }

                .vinyl-search-item {
                    display: flex;
                    gap: 12px;
                    padding: 12px;
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                    margin-bottom: 8px;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }

                .vinyl-search-item:hover {
                    background: rgba(0, 255, 255, 0.1);
                    border-color: rgba(0, 255, 255, 0.3);
                    transform: translateX(4px);
                    box-shadow: 0 0 20px rgba(0, 255, 255, 0.2);
                }

                .vinyl-search-cover {
                    width: 48px;
                    height: 48px;
                    border-radius: 8px;
                    object-fit: cover;
                    flex-shrink: 0;
                    background: linear-gradient(135deg, #1a1a2e 0%, #0a0a0a 100%);
                }

                .vinyl-search-cover-placeholder {
                    width: 48px;
                    height: 48px;
                    border-radius: 8px;
                    background: linear-gradient(135deg, #1a1a2e 0%, #0a0a0a 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: rgba(0, 255, 255, 0.3);
                    flex-shrink: 0;
                }

                .vinyl-search-info {
                    flex: 1;
                    min-width: 0;
                }

                .vinyl-search-title {
                    font-family: 'Orbitron', monospace;
                    font-size: 14px;
                    font-weight: 600;
                    color: white;
                    margin-bottom: 4px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .vinyl-search-artist {
                    font-family: 'Rajdhani', sans-serif;
                    font-size: 13px;
                    color: rgba(255, 255, 255, 0.5);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
            `}</style>
        </>
    );
}
