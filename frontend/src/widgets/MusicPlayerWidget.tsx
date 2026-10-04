import { useState, useRef, useEffect } from 'react';
import * as MusicPlayerService from '../../bindings/ltools/plugins/musicplayer/servicelx';
import { Song } from '../../bindings/ltools/plugins/musicplayer/models';
import { Icon } from '../components/Icon';
import { Dialogs } from '@wailsio/runtime';
import { useToast } from '../hooks/useToast';
import { t } from '@/i18n';

export function MusicPlayerWidget() {
    const [songs, setSongs] = useState<Song[]>([]);
    const [currentSong, setCurrentSong] = useState<Song | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState('');
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

    // 搜索分页状态
    const [searchPage, setSearchPage] = useState(1); // 当前搜索页码
    const [hasMoreResults, setHasMoreResults] = useState(true); // 是否还有更多结果
    const [isLoadingMore, setIsLoadingMore] = useState(false); // 是否正在加载更多

    // 视图模式状态
    type ViewMode = 'player' | 'search' | 'likes' | 'hot';
    const [viewMode, setViewMode] = useState<ViewMode>('player');

    // 喜欢列表状态
    const [likedSongs, setLikedSongs] = useState<Array<{song: Song, liked_at: string}>>([]);
    const [likesPage, setLikesPage] = useState(1);
    const [hasMoreLikes, setHasMoreLikes] = useState(true);
    const [isLoadingLikes, setIsLoadingLikes] = useState(false);
    const [likesTotal, setLikesTotal] = useState(0);

    // 热门歌曲状态
    const [hotSongs, setHotSongs] = useState<Song[]>([]);
    const [hotPage, setHotPage] = useState(1);
    const [hasMoreHot, setHasMoreHot] = useState(true);
    const [isLoadingHot, setIsLoadingHot] = useState(false);

    // 下载状态
    const [isDownloading, setIsDownloading] = useState(false); // 当前歌曲下载状态
    const [downloadingSongs, setDownloadingSongs] = useState<Set<string>>(new Set()); // 搜索列表下载状态

    const toast = useToast();

    const lastProgressRef = useRef<number>(0); // 上一次的播放进度（用于检测跳跃）
    const latestProgressRef = useRef<number>(0); // 最新的播放进度
    const latestParsedLyricsRef = useRef<Array<{ time: number; text: string }>>([]); // 最新的解析歌词

    const audioRef = useRef<HTMLAudioElement>(null);
    const lyricsContainerRef = useRef<HTMLDivElement>(null);
    const lastScrollTimeRef = useRef<number>(0); // 上次滚动时间
    const searchResultsRef = useRef<HTMLDivElement>(null); // 搜索结果容器引用
    const likesListRef = useRef<HTMLDivElement>(null);
    const hotListRef = useRef<HTMLDivElement>(null);

    // 更新最新的进度和歌词（不触发重渲染）
    useEffect(() => {
        latestProgressRef.current = progress;
    }, [progress]);

    useEffect(() => {
        latestParsedLyricsRef.current = parsedLyrics;
    }, [parsedLyrics]);

    // 禁止歌词区域滚动
    useEffect(() => {
        const container = lyricsContainerRef.current;
        if (!container) return;

        const preventScroll = (e: WheelEvent | TouchEvent) => {
            e.preventDefault();
            e.stopPropagation();
        };

        // 添加事件监听器（passive: false 允许 preventDefault 生效）
        container.addEventListener('wheel', preventScroll, { passive: false });
        container.addEventListener('touchmove', preventScroll, { passive: false });

        return () => {
            container.removeEventListener('wheel', preventScroll);
            container.removeEventListener('touchmove', preventScroll);
        };
    }, [showLyrics]);

    // 搜索结果滚动监听 - 自动加载更多
    useEffect(() => {
        const container = searchResultsRef.current;
        if (!container || viewMode !== 'search') return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            // 距离底部100px时触发加载
            if (scrollHeight - scrollTop - clientHeight < 100) {
                loadMoreSearchResults();
            }
        };

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [viewMode, searchKeyword, searchPage, hasMoreResults, isLoadingMore]);

    // 喜欢列表滚动监听
    useEffect(() => {
        const container = likesListRef.current;
        if (!container || viewMode !== 'likes') return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            if (scrollHeight - scrollTop - clientHeight < 100 && hasMoreLikes && !isLoadingLikes) {
                loadLikedSongs(likesPage + 1);
            }
        };

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [viewMode, likesPage, hasMoreLikes, isLoadingLikes]);

    // 热门歌曲滚动监听
    useEffect(() => {
        const container = hotListRef.current;
        if (!container || viewMode !== 'hot') return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            if (scrollHeight - scrollTop - clientHeight < 100 && hasMoreHot && !isLoadingHot) {
                loadHotSongs(hotPage + 1);
            }
        };

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [viewMode, hotPage, hasMoreHot, isLoadingHot]);

    // ESC 键关闭列表页
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && (viewMode === 'likes' || viewMode === 'hot' || viewMode === 'search')) {
                setViewMode('player');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [viewMode]);

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
            // 静默处理音频错误
        };

        // 自动播放下一曲
        const handleEnded = () => {
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

        // 修复：找到"下一个时间点大于当前时间"的前一行
        // 这样可以确保显示的是"正在唱"的歌词，而不是"将要唱"的歌词
        for (let i = 0; i < parsedLyrics.length; i++) {
            if (parsedLyrics[i].time <= currentTime) {
                newLineIndex = i;
            } else {
                // 找到第一个时间大于当前时间的行，停止
                break;
            }
        }

        // 检测进度跳跃（用户拖动进度条）
        const progressDelta = Math.abs(currentTime - lastProgressRef.current);
        const isSeeking = progressDelta > 2; // 如果跳跃超过 2 秒，认为是用户拖动
        lastProgressRef.current = currentTime;

        // 只在行改变时才滚动
        if (newLineIndex === currentLyricIndex && !isSeeking) {
            return;
        }

        setCurrentLyricIndex(newLineIndex);

        // 如果是跳跃，立即滚动（忽略节流）
        // 否则使用节流限制滚动频率
        const now = Date.now();
        if (!isSeeking && now - lastScrollTimeRef.current < 300) {
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

                // 如果是跳跃，使用 instant 滚动（立即跳转）
                // 否则使用 smooth 滚动（平滑过渡）
                container.scrollTo({
                    top: Math.max(0, scrollTop),
                    behavior: isSeeking ? 'instant' : 'smooth'
                });
            }
        });
    }, [progress, parsedLyrics, showLyrics, currentLyricIndex]);

    // 切换歌曲时重置歌词显示状态
    useEffect(() => {
        setShowLyrics(false);
        setCurrentLyricIndex(-1);
        lastScrollTimeRef.current = 0;
        lastProgressRef.current = 0; // 重置进度跟踪
    }, [currentSong?.id]);

    // 切换歌词显示状态时，重置并立即滚动到当前位置
    useEffect(() => {
        if (showLyrics && lyricsContainerRef.current) {
            // 重置状态
            setCurrentLyricIndex(-1);
            lastScrollTimeRef.current = 0;
            lastProgressRef.current = latestProgressRef.current;

            // 使用最新的进度和歌词
            const currentTime = latestProgressRef.current;
            const currentLyrics = latestParsedLyricsRef.current;

            if (currentLyrics.length === 0) return;

            // 立即滚动到当前进度对应的歌词行
            let targetLineIndex = 0;

            for (let i = 0; i < currentLyrics.length; i++) {
                if (currentLyrics[i].time <= currentTime) {
                    targetLineIndex = i;
                } else {
                    break;
                }
            }

            setCurrentLyricIndex(targetLineIndex);

            // 延迟一帧确保 DOM 已渲染
            requestAnimationFrame(() => {
                const container = lyricsContainerRef.current;
                if (!container) return;

                const lineElements = container.querySelectorAll('.lyrics-line');
                const targetElement = lineElements[targetLineIndex] as HTMLElement;

                if (targetElement) {
                    const containerHeight = container.clientHeight;
                    const elementTop = targetElement.offsetTop;
                    const elementHeight = targetElement.clientHeight;
                    const scrollTop = elementTop - containerHeight / 2 + elementHeight / 2;

                    container.scrollTo({
                        top: Math.max(0, scrollTop),
                        behavior: 'instant'
                    });
                }
            });
        }
    }, [showLyrics]); // 只依赖 showLyrics，使用 ref 获取最新值

    // 格式化时间
    const formatTime = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // 解析 LRC 歌词格式（支持两种格式）
    const parseLyrics = (lrcText: string) => {
        if (!lrcText) return [];

        const lines = lrcText.split('\n');
        const parsed: Array<{ time: number; text: string }> = [];

        for (const line of lines) {
            // 格式1: [分:秒.毫秒] 标准LRC格式
            // 例如: [03:45.12]歌词内容
            let match = line.match(/\[(\d{2}):(\d{2})\.?(\d{2})?\](.*)/);

            if (match) {
                const minutes = parseInt(match[1]);
                const seconds = parseInt(match[2]);
                const milliseconds = match[3] ? parseInt(match[3]) : 0;
                const time = minutes * 60 + seconds + milliseconds / 100;
                const text = match[4].trim();

                if (text) {
                    parsed.push({ time, text });
                }
            } else {
                // 格式2: [秒.毫秒] 简化格式（MusicFree 返回的格式）
                // 例如: [225.12]歌词内容
                match = line.match(/\[(\d+\.?\d*)\](.*)/);
                if (match) {
                    const time = parseFloat(match[1]);
                    const text = match[2].trim();

                    if (text && !isNaN(time)) {
                        parsed.push({ time, text });
                    }
                }
            }
        }

        return parsed.sort((a, b) => a.time - b.time);
    };

    // 获取并解析歌词
    const fetchLyrics = async (song: Song) => {
        if (!song.lyric_id) {
            setLyrics('');
            setParsedLyrics([]);
            return;
        }

        try {
            // 传递完整的 song 对象，而不只是 lyric_id
            const lyricText = await MusicPlayerService.GetLyric(song);
            setLyrics(lyricText);
            const parsed = parseLyrics(lyricText);
            setParsedLyrics(parsed);
        } catch (error) {
            setLyrics('');
            setParsedLyrics([]);
        }
    };

    // 预加载更多歌曲
    const preloadMoreSongs = async () => {
        // 防止重复预加载
        if (isPreloading) {
            return;
        }

        setIsPreloading(true);
        try {
            const newSongs = await MusicPlayerService.GetRandomSongs(5);
            setPreloadQueue(prev => [...prev, ...newSongs]);
        } catch (error) {
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
                songsToPlay = preloadQueue.slice(0, 10);
                // 从队列中移除已使用的歌曲
                setPreloadQueue(prev => prev.slice(10));
            } else {
                // 队列不足，直接加载
                const results = await MusicPlayerService.GetRandomSongs(10);
                songsToPlay = results;
            }

            // 预加载封面图片（保留已有缓存）
            const coverMap = new Map(songCovers);
            await Promise.all(
                songsToPlay.map(async (song) => {
                    if (song.pic_id) {
                        try {
                            const picURL = await MusicPlayerService.GetPicURL(song.pic_id);
                            coverMap.set(song.id, picURL);
                        } catch (error) {
                            // 忽略单个封面加载失败
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
            // 忽略错误
        } finally {
            setIsLoading(false);
        }
    };

    // 搜索歌曲
    const searchSongs = async () => {
        if (!searchKeyword.trim()) return;

        setIsLoading(true);
        setSearchPage(1); // 重置页码
        setHasMoreResults(true); // 重置是否有更多结果
        try {
            const results = await MusicPlayerService.Search(searchKeyword, 1);
            setSongs(results);

            if (results.length > 0) {
                setCurrentSong(results[0]);
                setCurrentIndex(0);
                checkIfLiked(results[0]);
            }

            // 如果返回结果少于20条，说明没有更多了
            if (results.length < 20) {
                setHasMoreResults(false);
            }

            // 预加载搜索结果的封面图片（保留已有缓存）
            const coverMap = new Map(songCovers);
            await Promise.all(
                results.map(async (song) => {
                    if (song.pic_id) {
                        try {
                            const picURL = await MusicPlayerService.GetPicURL(song.pic_id);
                            coverMap.set(song.id, picURL);
                        } catch (error) {
                            // 忽略单个封面加载失败
                        }
                    }
                })
            );
            setSongCovers(coverMap);
        } catch (error) {
            // 忽略错误
        } finally {
            setIsLoading(false);
        }
    };

    // 加载更多搜索结果
    const loadMoreSearchResults = async () => {
        if (isLoadingMore || !hasMoreResults || !searchKeyword.trim()) return;

        setIsLoadingMore(true);
        try {
            const nextPage = searchPage + 1;
            const results = await MusicPlayerService.Search(searchKeyword, nextPage);

            if (results.length === 0) {
                setHasMoreResults(false);
            } else {
                // 追加新结果到现有列表
                setSongs(prev => [...prev, ...results]);

                // 预加载新结果的封面图片
                const coverMap = new Map(songCovers);
                await Promise.all(
                    results.map(async (song) => {
                        if (song.pic_id) {
                            try {
                                const picURL = await MusicPlayerService.GetPicURL(song.pic_id);
                                coverMap.set(song.id, picURL);
                            } catch (error) {
                                // 忽略单个封面加载失败
                            }
                        }
                    })
                );
                setSongCovers(coverMap);

                setSearchPage(nextPage);

                // 如果返回结果少于20条，说明没有更多了
                if (results.length < 20) {
                    setHasMoreResults(false);
                }
            }
        } catch (error) {
            // 忽略错误
        } finally {
            setIsLoadingMore(false);
        }
    };

    // 播放歌曲
    const playSong = async (song: Song, retryCount = 0) => {
        if (!audioRef.current) return;

        try {
            // 使用 GetSongURLWithMetadata 以确保能获取 URL
            const url = await MusicPlayerService.GetSongURLWithMetadata(song, '320k');

            if (!url) {
                if (retryCount < 3) {
                    setTimeout(() => playSong(song, retryCount + 1), 1000);
                }
                return;
            }

            setCurrentSong(song);

            // 🔧 关键修复：在设置新 src 之前，先清理 audio 元素状态
            const audio = audioRef.current;

            // 1. 暂停当前播放
            audio.pause();

            // 2. 移除旧的 src，触发网络请求中止
            audio.removeAttribute('src');

            // 3. 重置音频元素状态
            audio.load();

            // 4. 设置新的 src
            audio.src = url;

            try {
                await audioRef.current.play();
                setIsPlaying(true);
            } catch (playError: any) {
                throw playError;
            }

            // 获取封面图片URL
            if (song.pic_id) {
                try {
                    const picURL = await MusicPlayerService.GetPicURL(song.pic_id);
                    setCoverURL(picURL);
                } catch (error) {
                    setCoverURL('');
                }
            } else {
                setCoverURL('');
            }

            // 获取歌词
            await fetchLyrics(song);
        } catch (error) {
            // 忽略错误
        }
    };

    // 检查歌曲是否已喜欢
    const checkIfLiked = async (song: Song) => {
        try {
            const likeList = await MusicPlayerService.GetLikeList();
            const liked = likeList.some(s => s.id === song.id);
            setIsLiked(liked);
        } catch (error) {
            // 忽略错误
        }
    };

    // 切换播放/暂停
    const togglePlay = async () => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            // 如果没有当前歌曲且没有音频源，则随机播放
            if (!currentSong && !audioRef.current.src) {
                await playRandom();
            } else if (audioRef.current.src) {
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
            // 忽略错误
        }
    };

    // 格式化时间（显示"X分钟前"、"X小时前"、"X天前"）
    const formatTimeAgo = (dateString: string): string => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return t('刚刚');
        if (diffMins < 60) return t('{n}分钟前', { n: diffMins });
        if (diffHours < 24) return t('{n}小时前', { n: diffHours });
        if (diffDays < 7) return t('{n}天前', { n: diffDays });

        return date.toLocaleDateString('zh-CN');
    };

    // 加载喜欢列表
    const loadLikedSongs = async (page: number = 1) => {
        if (isLoadingLikes) return;

        setIsLoadingLikes(true);
        try {
            const result = await MusicPlayerService.GetLikeListPaginated(page, 20);

            if (!result) return;

            if (page === 1) {
                setLikedSongs(result.songs);
            } else {
                setLikedSongs(prev => [...prev, ...result.songs]);
            }

            setLikesPage(page);
            setHasMoreLikes(result.has_more);
            setLikesTotal(result.total);

            // 预加载封面
            await Promise.all(result.songs.map(async (item) => {
                if (!songCovers.has(item.song.id)) {
                    const picURL = await MusicPlayerService.GetPicURL(item.song.pic_id);
                    setSongCovers(prev => new Map(prev).set(item.song.id, picURL));
                }
            }));
        } catch (error) {
            console.error('加载喜欢列表失败:', error);
            toast.error(t('加载失败'));
        } finally {
            setIsLoadingLikes(false);
        }
    };

    // 加载热门歌曲
    const loadHotSongs = async (page: number = 1) => {
        if (isLoadingHot) return;

        setIsLoadingHot(true);
        try {
            const result = await MusicPlayerService.GetHotSongs(page, 20);

            if (!result) return;

            if (page === 1) {
                setHotSongs(result.songs);
            } else {
                setHotSongs(prev => [...prev, ...result.songs]);
            }

            setHotPage(page);
            setHasMoreHot(result.has_more);

            // 预加载封面
            await Promise.all(result.songs.map(async (song) => {
                if (!songCovers.has(song.id)) {
                    const picURL = await MusicPlayerService.GetPicURL(song.pic_id);
                    setSongCovers(prev => new Map(prev).set(song.id, picURL));
                }
            }));
        } catch (error) {
            console.error('加载热门歌曲失败:', error);
            toast.error(t('加载失败'));
        } finally {
            setIsLoadingHot(false);
        }
    };

    // 播放整个喜欢列表
    const playAllLiked = async () => {
        try {
            const songs = await MusicPlayerService.PlayLikeList();
            if (songs.length === 0) {
                toast.warning(t('喜欢列表为空'));
                return;
            }

            setSongs(songs);
            setCurrentIndex(0);
            await playSong(songs[0]);
            setViewMode('player'); // 切回播放器视图
            toast.success(t('开始播放 {n} 首喜欢的歌曲', { n: songs.length }));
        } catch (error) {
            console.error('播放失败:', error);
            toast.error(t('播放失败'));
        }
    };

    // 播放热门歌曲
    const playAllHot = async () => {
        try {
            const songs = await MusicPlayerService.PlayHotSongs();
            if (songs.length === 0) {
                toast.warning(t('暂无热门歌曲'));
                return;
            }

            setSongs(songs);
            setCurrentIndex(0);
            await playSong(songs[0]);
            setViewMode('player');
            toast.success(t('开始播放 {n} 首热门歌曲', { n: songs.length }));
        } catch (error) {
            console.error('播放失败:', error);
            toast.error(t('播放失败'));
        }
    };

    // 取消喜欢（从列表中移除）
    const handleRemoveFromLikes = async (songId: string) => {
        try {
            await MusicPlayerService.RemoveFromLikes(songId);

            // 从列表中移除
            setLikedSongs(prev => prev.filter(item => item.song.id !== songId));
            setLikesTotal(prev => prev - 1);

            // 如果当前播放的歌曲被取消喜欢，更新状态
            if (currentSong?.id === songId) {
                setIsLiked(false);
            }

            toast.success(t('已取消喜欢'));
        } catch (error) {
            console.error('取消喜欢失败:', error);
            toast.error(t('操作失败'));
        }
    };

    // 下载当前歌曲
    const handleDownloadCurrentSong = async () => {
        if (!currentSong) return;

        try {
            setIsDownloading(true);

            // 1. 打开保存对话框
            const savePath = await Dialogs.SaveFile({
                Title: t('保存音乐 - {name}', { name: currentSong.name }),
                Filename: `${currentSong.name}.mp3`,
                Filters: [
                    { DisplayName: t('音频文件'), Pattern: '*.mp3;*.flac;*.aac;*.m4a' },
                    { DisplayName: t('MP3 音频'), Pattern: '*.mp3' },
                    { DisplayName: t('FLAC 无损'), Pattern: '*.flac' },
                    { DisplayName: t('所有文件'), Pattern: '*.*' }
                ]
            });

            if (!savePath) return; // 用户取消

            // 2. 调用后端下载
            await MusicPlayerService.DownloadSong(currentSong, savePath);

            // 3. 显示成功提示
            toast.success(t('下载完成：{name}', { name: currentSong.name }));

        } catch (error: any) {
            console.error('Download failed:', error);
            toast.error(t('下载失败：{msg}', { msg: error?.message || t('未知错误') }));
        } finally {
            setIsDownloading(false);
        }
    };

    // 下载搜索列表中的歌曲
    const handleDownloadSearchSong = async (song: Song) => {
        try {
            // 添加到下载中集合
            setDownloadingSongs(prev => new Set(prev).add(song.id));

            // 1. 打开保存对话框
            const savePath = await Dialogs.SaveFile({
                Title: t('保存音乐 - {name}', { name: song.name }),
                Filename: `${song.name}.mp3`,
                Filters: [
                    { DisplayName: t('音频文件'), Pattern: '*.mp3;*.flac;*.aac;*.m4a' },
                    { DisplayName: t('MP3 音频'), Pattern: '*.mp3' },
                    { DisplayName: t('FLAC 无损'), Pattern: '*.flac' },
                    { DisplayName: t('所有文件'), Pattern: '*.*' }
                ]
            });

            if (!savePath) {
                // 用户取消，从下载中集合移除
                setDownloadingSongs(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(song.id);
                    return newSet;
                });
                return;
            }

            // 2. 调用后端下载
            await MusicPlayerService.DownloadSong(song, savePath);

            // 3. 显示成功提示
            toast.success(t('下载完成：{name}', { name: song.name }));

        } catch (error: any) {
            console.error('Download failed:', error);
            toast.error(t('下载失败：{msg}', { msg: error?.message || t('未知错误') }));
        } finally {
            // 从下载中集合移除
            setDownloadingSongs(prev => {
                const newSet = new Set(prev);
                newSet.delete(song.id);
                return newSet;
            });
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

                {/* 顶部按钮组 - 绝对定位 */}
                {viewMode === 'player' && (
                    <div className="vinyl-top-group">
                        <button
                            onClick={() => {
                                setViewMode('likes');
                                if (likedSongs.length === 0) loadLikedSongs(1);
                            }}
                            className="vinyl-top-group-btn"
                        >
                            <Icon name="heart" size={16} />
                            <span>{t('喜欢')}</span>
                            {likesTotal > 0 && <span className="vinyl-badge">{likesTotal}</span>}
                        </button>

                        <span className="vinyl-top-divider">·</span>

                        <button
                            onClick={() => {
                                setViewMode('hot');
                                if (hotSongs.length === 0) loadHotSongs(1);
                            }}
                            className="vinyl-top-group-btn"
                        >
                            <Icon name="fire" size={16} />
                            <span>{t('热门')}</span>
                        </button>
                    </div>
                )}

                {/* 主容器 */}
                <div className="vinyl-container" style={{ '--wails-draggable': 'drag' } as React.CSSProperties}>
                    {/* 关闭按钮 */}
                    <button
                        onClick={() => MusicPlayerService.HideWindow()}
                        className="vinyl-close-btn"
                        style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
                        title={t("关闭窗口")}
                    >
                        <Icon name="x" size={14} />
                    </button>

                    {/* 黑胶唱片 */}
                    <div
                        className="vinyl-disc-container"
                        onClick={() => setShowLyrics(!showLyrics)}
                        style={{ cursor: 'pointer' }}
                        title={showLyrics ? t('点击显示封面') : t('点击显示歌词')}
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

                        {/* 静态的歌词显示区域 - 禁止用户滚动 */}
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
                                        {lyrics ? t('解析歌词失败') : t('暂无歌词')}
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
                    <div className="vinyl-info">
                        <h3 className="vinyl-title">{currentSong ? currentSong.name : t('暂未播放')}</h3>
                        <p className="vinyl-artist">{currentSong ? currentSong.artist.join(', ') : '—'}</p>
                    </div>

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

                        {/* 下载按钮 - 进度条右边 */}
                        {currentSong && (
                            <button
                                onClick={handleDownloadCurrentSong}
                                className="vinyl-download-btn"
                                title={t("下载当前歌曲")}
                                disabled={isDownloading}
                            >
                                {isDownloading ? (
                                    <Icon name="refresh-cw" size={16} className="animate-spin" />
                                ) : (
                                    <Icon name="download" size={16} />
                                )}
                            </button>
                        )}

                    </div>

                    {/* 喜欢按钮 - 左上角 */}
                    {currentSong && (
                        <button
                            onClick={toggleLike}
                            className={`vinyl-like-btn ${isLiked ? 'liked' : ''}`}
                            title={isLiked ? t('取消喜欢') : t('喜欢')}
                        >
                            <Icon name="heart" size={18} />
                        </button>
                    )}

                    {/* 控制按钮 */}
                    <div className="vinyl-controls">
                        <button
                            onClick={playRandom}
                            className="vinyl-btn vinyl-btn-secondary"
                            title={t("随机播放")}
                            disabled={isLoading}
                        >
                            <Icon name="refresh" size={20} />
                        </button>

                        <button
                            onClick={playPrev}
                            className="vinyl-btn vinyl-btn-tertiary"
                            title={t("上一曲")}
                        >
                            <Icon name="chevron-left" size={20} />
                        </button>

                        <button
                            onClick={togglePlay}
                            className="vinyl-btn vinyl-btn-primary"
                            title={isPlaying ? t('暂停') : t('播放')}
                        >
                            <Icon name={isPlaying ? 'pause' : 'play'} size={24} />
                        </button>

                        <button
                            onClick={playNext}
                            className="vinyl-btn vinyl-btn-tertiary"
                            title={t("下一曲")}
                        >
                            <Icon name="chevron-right" size={20} />
                        </button>

                        <button
                            onClick={() => {
                                if (viewMode === 'search') {
                                    setViewMode('player');
                                } else {
                                    setViewMode('search');
                                }
                            }}
                            className="vinyl-btn vinyl-btn-secondary"
                            title={viewMode === 'search' ? t('关闭搜索') : t('搜索')}
                        >
                            <Icon name={viewMode === 'search' ? 'x' : 'search'} size={20} />
                        </button>
                    </div>
                </div>

                {/* 喜欢列表视图 */}
                {viewMode === 'likes' && (
                    <div className="vinyl-list-view" ref={likesListRef}>
                        {/* 一键播放按钮 */}
                        <div className="vinyl-list-header">
                            <button
                                onClick={playAllLiked}
                                className="vinyl-play-all-btn"
                                disabled={likedSongs.length === 0}
                            >
                                <Icon name="play" size={16} />
                                {t('播放全部 (')}{likesTotal})
                            </button>
                        </div>

                        {/* 歌曲列表 */}
                        {likedSongs.map((item, index) => {
                            const coverUrl = songCovers.get(item.song.id);

                            return (
                                <div key={`${item.song.id}-${index}`} className="vinyl-list-item">
                                    <div
                                        className="vinyl-list-item-main"
                                        onClick={() => {
                                            playSong(item.song);
                                            setViewMode('player');
                                        }}
                                    >
                                        {coverUrl ? (
                                            <img src={coverUrl} alt={item.song.name} className="vinyl-list-cover" />
                                        ) : (
                                            <div className="vinyl-list-cover-placeholder">
                                                <Icon name="sparkles" size={20} />
                                            </div>
                                        )}
                                        <div className="vinyl-list-info">
                                            <div className="vinyl-list-name">{item.song.name}</div>
                                            <div className="vinyl-list-artist">{item.song.artist.join(', ')}</div>
                                            <div className="vinyl-list-meta">
                                                {formatTimeAgo(item.liked_at)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="vinyl-list-actions">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                playSong(item.song);
                                            }}
                                            title={t("播放")}
                                        >
                                            <Icon name="play" size={16} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveFromLikes(item.song.id);
                                            }}
                                            title={t("取消喜欢")}
                                            className="liked"
                                        >
                                            <Icon name="heart" size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {/* 加载状态 */}
                        {isLoadingLikes && (
                            <div className="vinyl-list-loading">
                                <div className="vinyl-loading-spinner" />
                            </div>
                        )}
                        {!hasMoreLikes && likedSongs.length > 0 && (
                            <div className="vinyl-list-end">{t('已加载全部')}</div>
                        )}
                    </div>
                )}

                {/* 热门歌曲列表视图 */}
                {viewMode === 'hot' && (
                    <div className="vinyl-list-view" ref={hotListRef}>
                        <div className="vinyl-list-header">
                            <button onClick={playAllHot} className="vinyl-play-all-btn">
                                <Icon name="play" size={16} />
                                {t('播放全部热门')}
                            </button>
                        </div>

                        {/* 歌曲列表 */}
                        {hotSongs.map((song, index) => {
                            const coverUrl = songCovers.get(song.id);

                            return (
                                <div key={`${song.id}-${index}`} className="vinyl-list-item">
                                    <div
                                        className="vinyl-list-item-main"
                                        onClick={() => {
                                            playSong(song);
                                            setViewMode('player');
                                        }}
                                    >
                                        {coverUrl ? (
                                            <img src={coverUrl} alt={song.name} className="vinyl-list-cover" />
                                        ) : (
                                            <div className="vinyl-list-cover-placeholder">
                                                <Icon name="sparkles" size={20} />
                                            </div>
                                        )}
                                        <div className="vinyl-list-info">
                                            <div className="vinyl-list-name">{song.name}</div>
                                            <div className="vinyl-list-artist">{song.artist.join(', ')}</div>
                                        </div>
                                    </div>
                                    <div className="vinyl-list-actions">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                playSong(song);
                                            }}
                                            title={t("播放")}
                                        >
                                            <Icon name="play" size={16} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDownloadSearchSong(song);
                                            }}
                                            title={t("下载")}
                                            disabled={downloadingSongs.has(song.id)}
                                        >
                                            {downloadingSongs.has(song.id) ? (
                                                <Icon name="refresh-cw" size={16} className="animate-spin" />
                                            ) : (
                                                <Icon name="download" size={16} />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {/* 加载状态 */}
                        {isLoadingHot && (
                            <div className="vinyl-list-loading">
                                <div className="vinyl-loading-spinner" />
                            </div>
                        )}
                        {!hasMoreHot && hotSongs.length > 0 && (
                            <div className="vinyl-list-end">{t('已加载全部')}</div>
                        )}
                    </div>
                )}

                {/* 搜索面板 */}
                {/* 搜索视图 */}
                {viewMode === 'search' && (
                    <div className="vinyl-list-view">
                        {/* 搜索框 */}
                        <div className="vinyl-list-header">
                            <div className="vinyl-search-input-wrapper">
                                <Icon name="search" size={18} />
                                <input
                                    type="text"
                                    value={searchKeyword}
                                    onChange={(e) => setSearchKeyword(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && searchSongs()}
                                    placeholder={t("搜索歌曲...")}
                                    className="vinyl-search-input"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* 搜索结果 */}
                        {songs.length > 0 && (
                            <div ref={searchResultsRef}>
                                {songs.map((song, index) => {
                                    const coverUrl = songCovers.get(song.id);

                                    return (
                                        <div key={`${song.id}-${index}`} className="vinyl-list-item">
                                            <div
                                                className="vinyl-list-item-main"
                                                onClick={() => {
                                                    playSong(song);
                                                    setViewMode('player');
                                                }}
                                            >
                                                {coverUrl ? (
                                                    <img src={coverUrl} alt={song.name} className="vinyl-list-cover" />
                                                ) : (
                                                    <div className="vinyl-list-cover-placeholder">
                                                        <Icon name="sparkles" size={20} />
                                                    </div>
                                                )}
                                                <div className="vinyl-list-info">
                                                    <div className="vinyl-list-name">{song.name}</div>
                                                    <div className="vinyl-list-artist">{song.artist.join(', ')}</div>
                                                </div>
                                            </div>
                                            <div className="vinyl-list-actions">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        playSong(song);
                                                    }}
                                                    title={t("播放")}
                                                >
                                                    <Icon name="play" size={16} />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDownloadSearchSong(song);
                                                    }}
                                                    title={t("下载")}
                                                    disabled={downloadingSongs.has(song.id)}
                                                >
                                                    {downloadingSongs.has(song.id) ? (
                                                        <Icon name="refresh-cw" size={16} className="animate-spin" />
                                                    ) : (
                                                        <Icon name="download" size={16} />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* 加载状态 */}
                                {isLoadingMore && (
                                    <div className="vinyl-list-loading">
                                        <div className="vinyl-loading-spinner" />
                                    </div>
                                )}
                                {!hasMoreResults && songs.length > 0 && !isLoadingMore && (
                                    <div className="vinyl-list-end">{t('已加载全部结果')}</div>
                                )}
                            </div>
                        )}
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
                    padding: 88px 40px 40px;
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
                    min-height: 57px;
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
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 100%;
                }

                .vinyl-artist {
                    font-family: 'Rajdhani', sans-serif;
                    font-size: 16px;
                    color: rgba(255, 255, 255, 0.6);
                    margin: 0;
                    font-weight: 500;
                    letter-spacing: 0.5px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 100%;
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

                /* 下载按钮 - 进度条上方 */
                .vinyl-download-btn {
                    border-radius: 50%;
                    background: transparent;
                    border: none;
                    color: rgba(0, 255, 255, 0.6);
                    cursor: pointer;
                    display: flex;
                    align-items: end;
                    justify-content: center;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .vinyl-download-btn:hover {
                    color: #00ffff;
                    transform: scale(1.15);
                }

                .vinyl-download-btn:disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                }

                .vinyl-download-btn:disabled:hover {
                    transform: none;
                }

                /* 搜索框样式 */
                .vinyl-search-input-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 25px;
                    padding: 12px 20px;
                    transition: all 0.3s;
                    width: 100%;
                    max-width: 400px;
                }

                .vinyl-search-input-wrapper:focus-within {
                    border-color: rgba(255, 0, 128, 0.5);
                    box-shadow: 0 0 20px rgba(255, 0, 128, 0.3);
                }

                .vinyl-search-input {
                    flex: 1;
                    background: transparent;
                    border: none;
                    outline: none;
                    color: white;
                    font-family: 'Rajdhani', sans-serif;
                    font-size: 15px;
                    font-weight: 500;
                }

                .vinyl-search-input::placeholder {
                    color: rgba(255, 255, 255, 0.4);
                }

                /* 顶部按钮组 - 绝对定位 */
                .vinyl-top-group {
                    position: absolute;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    align-items: center;
                    gap: 0;
                    z-index: 50;
                    background: rgba(255, 255, 255, 0.08);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 0, 128, 0.3);
                    border-radius: 16px;
                    padding: 2px;
                    box-shadow: 0 0 20px rgba(255, 0, 128, 0.2);
                }

                .vinyl-top-group-btn {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 5px 12px;
                    border-radius: 13px;
                    background: transparent;
                    border: none;
                    color: rgba(255, 255, 255, 0.7);
                    font-family: 'Rajdhani', sans-serif;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    white-space: nowrap;
                    position: relative;
                }

                .vinyl-top-group-btn:hover {
                    background: rgba(255, 0, 128, 0.2);
                    color: #fff;
                }

                .vinyl-top-divider {
                    width: 1px;
                    height: 16px;
                    background: linear-gradient(
                        to bottom,
                        transparent,
                        rgba(255, 0, 128, 0.5),
                        transparent
                    );
                    margin: 0 2px;
                    font-size: 14px;
                    color: rgba(255, 0, 128, 0.6);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .vinyl-badge {
                    background: rgba(255, 0, 128, 0.4);
                    color: #fff;
                    padding: 1px 6px;
                    border-radius: 8px;
                    font-size: 10px;
                    font-weight: 700;
                    margin-left: 3px;
                    min-width: 16px;
                    text-align: center;
                }

                /* 列表视图 */
                .vinyl-list-view {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%);
                    z-index: 100;
                    display: flex;
                    flex-direction: column;
                    padding: 60px 20px 20px;
                    overflow-y: auto;
                }

                .vinyl-list-header {
                    display: flex;
                    justify-content: center;
                    margin-bottom: 20px;
                }

                .vinyl-play-all-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px 24px;
                    background: linear-gradient(135deg, rgba(255, 0, 128, 0.2), rgba(0, 255, 255, 0.2));
                    border: 1px solid rgba(255, 0, 128, 0.5);
                    border-radius: 25px;
                    color: #fff;
                    font-family: 'Rajdhani', sans-serif;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .vinyl-play-all-btn:hover:not(:disabled) {
                    background: linear-gradient(135deg, rgba(255, 0, 128, 0.3), rgba(0, 255, 255, 0.3));
                    box-shadow: 0 0 30px rgba(255, 0, 128, 0.4);
                    transform: translateY(-2px);
                }

                .vinyl-play-all-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .vinyl-list-item {
                    display: flex;
                    align-items: center;
                    padding: 12px;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 12px;
                    margin-bottom: 8px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .vinyl-list-item:hover {
                    background: rgba(255, 255, 255, 0.08);
                    border-color: rgba(255, 255, 255, 0.1);
                    transform: translateX(4px);
                }

                .vinyl-list-item-main {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    cursor: pointer;
                    min-width: 0;
                }

                .vinyl-list-cover {
                    width: 50px;
                    height: 50px;
                    border-radius: 8px;
                    object-fit: cover;
                    flex-shrink: 0;
                }

                .vinyl-list-cover-placeholder {
                    width: 50px;
                    height: 50px;
                    border-radius: 8px;
                    background: rgba(255, 0, 128, 0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: rgba(255, 0, 128, 0.3);
                    flex-shrink: 0;
                }

                .vinyl-list-info {
                    flex: 1;
                    min-width: 0;
                }

                .vinyl-list-name {
                    font-family: 'Rajdhani', sans-serif;
                    font-size: 15px;
                    font-weight: 600;
                    color: #fff;
                    margin-bottom: 4px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .vinyl-list-artist {
                    font-family: 'Rajdhani', sans-serif;
                    font-size: 13px;
                    color: rgba(255, 255, 255, 0.5);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .vinyl-list-meta {
                    font-family: 'Rajdhani', sans-serif;
                    font-size: 11px;
                    color: rgba(255, 255, 255, 0.3);
                    margin-top: 2px;
                }

                .vinyl-list-actions {
                    display: flex;
                    gap: 8px;
                    flex-shrink: 0;
                }

                .vinyl-list-actions button {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: rgba(255, 255, 255, 0.6);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .vinyl-list-actions button:hover {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: rgba(255, 255, 255, 0.2);
                    color: #fff;
                }

                .vinyl-list-actions button.liked {
                    color: #ff0080;
                    border-color: rgba(255, 0, 128, 0.3);
                }

                .vinyl-list-loading {
                    display: flex;
                    justify-content: center;
                    padding: 20px;
                }

                .vinyl-list-end {
                    text-align: center;
                    padding: 16px;
                    color: rgba(255, 255, 255, 0.3);
                    font-family: 'Rajdhani', sans-serif;
                    font-size: 13px;
                }

                /* 旋转动画 */
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .animate-spin {
                    animation: spin 1s linear infinite;
                }
            `}</style>
        </>
    );
}
