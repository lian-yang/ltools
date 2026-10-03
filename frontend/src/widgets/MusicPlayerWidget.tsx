import { useState, useRef, useEffect, type CSSProperties } from 'react';
import * as MusicPlayerService from '../../bindings/ltools/plugins/musicplayer/servicelx';
import { Song } from '../../bindings/ltools/plugins/musicplayer/models';
import { Icon } from '../components/Icon';
import { Button, EmptyState, IconButton, Input, Spinner } from '../components/ui';
import { Dialogs } from '@wailsio/runtime';
import { useToast } from '../hooks/useToast';

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
    const preloadRetryTimerRef = useRef<number | null>(null); // 预加载失败重试定时器

    // 卸载时清理定时器，避免泄漏
    useEffect(() => {
        return () => {
            if (preloadRetryTimerRef.current !== null) {
                window.clearTimeout(preloadRetryTimerRef.current);
                preloadRetryTimerRef.current = null;
            }
        };
    }, []);

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
            setIsPreloading(false);
        } catch (error) {
            // 失败后等待5秒再重试，避免频繁请求
            // （修复：原实现中 finally 会立即清除 isPreloading，5 秒延时重试实际失效且定时器未清理）
            preloadRetryTimerRef.current = window.setTimeout(() => {
                setIsPreloading(false);
            }, 5000);
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

            // 关键修复：在设置新 src 之前，先清理 audio 元素状态
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

        if (diffMins < 1) return '刚刚';
        if (diffMins < 60) return `${diffMins}分钟前`;
        if (diffHours < 24) return `${diffHours}小时前`;
        if (diffDays < 7) return `${diffDays}天前`;

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
            toast.error('加载失败');
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
            toast.error('加载失败');
        } finally {
            setIsLoadingHot(false);
        }
    };

    // 播放整个喜欢列表
    const playAllLiked = async () => {
        try {
            const songs = await MusicPlayerService.PlayLikeList();
            if (songs.length === 0) {
                toast.warning('喜欢列表为空');
                return;
            }

            setSongs(songs);
            setCurrentIndex(0);
            await playSong(songs[0]);
            setViewMode('player'); // 切回播放器视图
            toast.success(`开始播放 ${songs.length} 首喜欢的歌曲`);
        } catch (error) {
            console.error('播放失败:', error);
            toast.error('播放失败');
        }
    };

    // 播放热门歌曲
    const playAllHot = async () => {
        try {
            const songs = await MusicPlayerService.PlayHotSongs();
            if (songs.length === 0) {
                toast.warning('暂无热门歌曲');
                return;
            }

            setSongs(songs);
            setCurrentIndex(0);
            await playSong(songs[0]);
            setViewMode('player');
            toast.success(`开始播放 ${songs.length} 首热门歌曲`);
        } catch (error) {
            console.error('播放失败:', error);
            toast.error('播放失败');
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

            toast.success('已取消喜欢');
        } catch (error) {
            console.error('取消喜欢失败:', error);
            toast.error('操作失败');
        }
    };

    // 下载当前歌曲
    const handleDownloadCurrentSong = async () => {
        if (!currentSong) return;

        try {
            setIsDownloading(true);

            // 1. 打开保存对话框
            const savePath = await Dialogs.SaveFile({
                Title: `保存音乐 - ${currentSong.name}`,
                Filename: `${currentSong.name}.mp3`,
                Filters: [
                    { DisplayName: '音频文件', Pattern: '*.mp3;*.flac;*.aac;*.m4a' },
                    { DisplayName: 'MP3 音频', Pattern: '*.mp3' },
                    { DisplayName: 'FLAC 无损', Pattern: '*.flac' },
                    { DisplayName: '所有文件', Pattern: '*.*' }
                ]
            });

            if (!savePath) return; // 用户取消

            // 2. 调用后端下载
            await MusicPlayerService.DownloadSong(currentSong, savePath);

            // 3. 显示成功提示
            toast.success(`下载完成：${currentSong.name}`);

        } catch (error: any) {
            console.error('Download failed:', error);
            toast.error(`下载失败：${error?.message || '未知错误'}`);
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
                Title: `保存音乐 - ${song.name}`,
                Filename: `${song.name}.mp3`,
                Filters: [
                    { DisplayName: '音频文件', Pattern: '*.mp3;*.flac;*.aac;*.m4a' },
                    { DisplayName: 'MP3 音频', Pattern: '*.mp3' },
                    { DisplayName: 'FLAC 无损', Pattern: '*.flac' },
                    { DisplayName: '所有文件', Pattern: '*.*' }
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
            toast.success(`下载完成：${song.name}`);

        } catch (error: any) {
            console.error('Download failed:', error);
            toast.error(`下载失败：${error?.message || '未知错误'}`);
        } finally {
            // 从下载中集合移除
            setDownloadingSongs(prev => {
                const newSet = new Set(prev);
                newSet.delete(song.id);
                return newSet;
            });
        }
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
            <div className="mp-root">
                {/* 顶部工具条：喜欢 / 热门入口 + 关闭（窗口拖拽区） */}
                <div className="mp-topbar" style={{ '--wails-draggable': 'drag' } as CSSProperties}>
                    <div className="mp-topbar-side">
                        {viewMode === 'player' && currentSong && (
                            <IconButton
                                name="heart"
                                size="sm"
                                label={isLiked ? '取消喜欢' : '喜欢'}
                                onClick={toggleLike}
                                className={`mp-like ${isLiked ? 'liked' : ''}`}
                            />
                        )}
                    </div>

                    {viewMode === 'player' && (
                        <div className="mp-tabs">
                            <button
                                className="mp-tab"
                                onClick={() => {
                                    setViewMode('likes');
                                    if (likedSongs.length === 0) loadLikedSongs(1);
                                }}
                            >
                                <Icon name="heart" size={13} />
                                <span>喜欢</span>
                                {likesTotal > 0 && <span className="mp-tab-badge tnum">{likesTotal}</span>}
                            </button>

                            <button
                                className="mp-tab"
                                onClick={() => {
                                    setViewMode('hot');
                                    if (hotSongs.length === 0) loadHotSongs(1);
                                }}
                            >
                                <Icon name="fire" size={13} />
                                <span>热门</span>
                            </button>
                        </div>
                    )}

                    <div className="mp-topbar-side mp-topbar-right">
                        <IconButton
                            name="x"
                            size="sm"
                            label="关闭窗口"
                            onClick={() => MusicPlayerService.HideWindow()}
                        />
                    </div>
                </div>

                {/* 播放器主视图（窗口拖拽区） */}
                <div className="mp-window" style={{ '--wails-draggable': 'drag' } as CSSProperties}>
                    {/* 封面 / 歌词（点击切换） */}
                    <div
                        className="mp-cover-wrap"
                        onClick={() => setShowLyrics(!showLyrics)}
                        title={showLyrics ? '点击显示封面' : '点击显示歌词'}
                    >
                        {!showLyrics && (
                            <div className="mp-cover">
                                {currentSong && coverURL ? (
                                    <img
                                        src={coverURL}
                                        alt={currentSong.name}
                                        className="mp-cover-img"
                                    />
                                ) : (
                                    <div className="mp-cover-placeholder">
                                        <Icon name="sparkles" size={28} />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 歌词显示区域 - 禁止用户滚动 */}
                        {showLyrics && (
                            <div className="mp-lyrics" ref={lyricsContainerRef}>
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
                            <div className="mp-cover-loading">
                                <Spinner size={18} />
                            </div>
                        )}
                    </div>

                    {/* 歌曲信息 */}
                    <div className="mp-info">
                        <h3 className="mp-title">{currentSong ? currentSong.name : '暂未播放'}</h3>
                        <p className="mp-artist">{currentSong ? currentSong.artist.join(', ') : '—'}</p>
                    </div>

                    {/* 进度条 */}
                    <div className="mp-progress-row">
                        <span className="mp-time mp-time-current tnum">{formatTime(progress)}</span>
                        <div className="mp-progress" onClick={handleProgressClick}>
                            <div className="mp-progress-track">
                                <div
                                    className="mp-progress-fill"
                                    style={{ width: duration > 0 ? `${(progress / duration) * 100}%` : '0%' }}
                                />
                            </div>
                            <div
                                className="mp-progress-dot"
                                style={{ left: duration > 0 ? `${(progress / duration) * 100}%` : '0%' }}
                            />
                        </div>
                        <span className="mp-time tnum">{formatTime(duration)}</span>

                        {/* 下载按钮 - 进度条右边 */}
                        {currentSong && (
                            <IconButton
                                name={isDownloading ? 'refresh-cw' : 'download'}
                                size="sm"
                                label={isDownloading ? '下载中' : '下载当前歌曲'}
                                onClick={handleDownloadCurrentSong}
                                disabled={isDownloading}
                                className={isDownloading ? 'animate-spin' : ''}
                            />
                        )}
                    </div>

                    {/* 控制按钮 */}
                    <div className="mp-controls">
                        <IconButton
                            name="refresh"
                            label="随机播放"
                            onClick={playRandom}
                            disabled={isLoading}
                        />

                        <IconButton
                            name="skip-back"
                            label="上一曲"
                            onClick={playPrev}
                        />

                        <IconButton
                            name={isPlaying ? 'pause' : 'play'}
                            label={isPlaying ? '暂停' : '播放'}
                            onClick={togglePlay}
                            className="mp-play-main"
                        />

                        <IconButton
                            name="skip-forward"
                            label="下一曲"
                            onClick={playNext}
                        />

                        <IconButton
                            name={viewMode === 'search' ? 'x' : 'search'}
                            label={viewMode === 'search' ? '关闭搜索' : '搜索'}
                            onClick={() => {
                                if (viewMode === 'search') {
                                    setViewMode('player');
                                } else {
                                    setViewMode('search');
                                }
                            }}
                        />
                    </div>
                </div>

                {/* 喜欢列表视图 */}
                {viewMode === 'likes' && (
                    <div className="mp-list">
                        {/* 顶栏：返回 + 播放全部 */}
                        <div className="mp-list-topbar">
                            <IconButton
                                name="chevron-left"
                                label="返回播放器"
                                onClick={() => setViewMode('player')}
                            />
                            <span className="mp-list-title">我的喜欢</span>
                            <div className="mp-list-topbar-spacer" />
                            <Button
                                variant="secondary"
                                size="sm"
                                icon="play"
                                onClick={playAllLiked}
                                disabled={likedSongs.length === 0}
                            >
                                播放全部{likesTotal > 0 ? ` (${likesTotal})` : ''}
                            </Button>
                        </div>

                        {/* 歌曲列表 */}
                        <div className="mp-list-scroll" ref={likesListRef}>
                            {likedSongs.map((item, index) => {
                                const coverUrl = songCovers.get(item.song.id);
                                const song = item.song;

                                return (
                                    <div
                                        key={`${song.id}-${index}`}
                                        className={`row row-clickable mp-row ${currentSong?.id === song.id ? 'row-selected' : ''}`}
                                        onClick={() => {
                                            playSong(song);
                                            setViewMode('player');
                                        }}
                                    >
                                        {coverUrl ? (
                                            <img src={coverUrl} alt={song.name} className="mp-row-cover" />
                                        ) : (
                                            <div className="mp-row-cover mp-row-cover-placeholder">
                                                <Icon name="sparkles" size={16} />
                                            </div>
                                        )}
                                        <div className="mp-row-info">
                                            <div className="mp-row-name">{song.name}</div>
                                            <div className="mp-row-artist">{song.artist.join(', ')}</div>
                                        </div>
                                        <span className="mp-row-meta tnum">{formatTimeAgo(item.liked_at)}</span>
                                        <div className="mp-row-actions" onClick={(e) => e.stopPropagation()}>
                                            <IconButton
                                                size="sm"
                                                name="play"
                                                label="播放"
                                                onClick={() => playSong(song)}
                                            />
                                            <IconButton
                                                size="sm"
                                                name="heart"
                                                label="取消喜欢"
                                                tone="danger"
                                                onClick={() => handleRemoveFromLikes(song.id)}
                                            />
                                        </div>
                                    </div>
                                );
                            })}

                            {/* 加载状态 */}
                            {isLoadingLikes && (
                                <div className="mp-list-loading">
                                    <Spinner size={16} />
                                </div>
                            )}
                            {!hasMoreLikes && likedSongs.length > 0 && (
                                <div className="mp-list-end">已加载全部</div>
                            )}
                            {!isLoadingLikes && likedSongs.length === 0 && (
                                <EmptyState
                                    icon="heart"
                                    title="还没有喜欢的歌曲"
                                    description="播放歌曲时点击红心，喜欢的歌曲会出现在这里"
                                />
                            )}
                        </div>
                    </div>
                )}

                {/* 热门歌曲列表视图 */}
                {viewMode === 'hot' && (
                    <div className="mp-list">
                        <div className="mp-list-topbar">
                            <IconButton
                                name="chevron-left"
                                label="返回播放器"
                                onClick={() => setViewMode('player')}
                            />
                            <span className="mp-list-title">热门歌曲</span>
                            <div className="mp-list-topbar-spacer" />
                            <Button variant="secondary" size="sm" icon="play" onClick={playAllHot}>
                                播放全部
                            </Button>
                        </div>

                        {/* 歌曲列表 */}
                        <div className="mp-list-scroll" ref={hotListRef}>
                            {hotSongs.map((song, index) => {
                                const coverUrl = songCovers.get(song.id);

                                return (
                                    <div
                                        key={`${song.id}-${index}`}
                                        className={`row row-clickable mp-row ${currentSong?.id === song.id ? 'row-selected' : ''}`}
                                        onClick={() => {
                                            playSong(song);
                                            setViewMode('player');
                                        }}
                                    >
                                        {coverUrl ? (
                                            <img src={coverUrl} alt={song.name} className="mp-row-cover" />
                                        ) : (
                                            <div className="mp-row-cover mp-row-cover-placeholder">
                                                <Icon name="sparkles" size={16} />
                                            </div>
                                        )}
                                        <div className="mp-row-info">
                                            <div className="mp-row-name">{song.name}</div>
                                            <div className="mp-row-artist">{song.artist.join(', ')}</div>
                                        </div>
                                        <div className="mp-row-actions" onClick={(e) => e.stopPropagation()}>
                                            <IconButton
                                                size="sm"
                                                name="play"
                                                label="播放"
                                                onClick={() => playSong(song)}
                                            />
                                            <IconButton
                                                size="sm"
                                                name="download"
                                                label="下载"
                                                disabled={downloadingSongs.has(song.id)}
                                                onClick={() => handleDownloadSearchSong(song)}
                                            />
                                        </div>
                                    </div>
                                );
                            })}

                            {/* 加载状态 */}
                            {isLoadingHot && (
                                <div className="mp-list-loading">
                                    <Spinner size={16} />
                                </div>
                            )}
                            {!hasMoreHot && hotSongs.length > 0 && (
                                <div className="mp-list-end">已加载全部</div>
                            )}
                            {!isLoadingHot && hotSongs.length === 0 && (
                                <EmptyState
                                    icon="fire"
                                    title="暂无热门歌曲"
                                    description="稍后再来看看"
                                />
                            )}
                        </div>
                    </div>
                )}

                {/* 搜索视图 */}
                {viewMode === 'search' && (
                    <div className="mp-list">
                        {/* 搜索框 */}
                        <div className="mp-list-topbar">
                            <IconButton
                                name="chevron-left"
                                label="返回播放器"
                                onClick={() => setViewMode('player')}
                            />
                            <div className="mp-search-wrap">
                                <Icon name="search" size={13} className="mp-search-icon" />
                                <Input
                                    type="text"
                                    value={searchKeyword}
                                    onChange={(e) => setSearchKeyword(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && searchSongs()}
                                    placeholder="搜索歌曲"
                                    className="mp-search-input"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* 搜索结果 */}
                        <div className="mp-list-scroll" ref={searchResultsRef}>
                            {songs.map((song, index) => {
                                const coverUrl = songCovers.get(song.id);

                                return (
                                    <div
                                        key={`${song.id}-${index}`}
                                        className={`row row-clickable mp-row ${currentSong?.id === song.id ? 'row-selected' : ''}`}
                                        onClick={() => {
                                            playSong(song);
                                            setViewMode('player');
                                        }}
                                    >
                                        {coverUrl ? (
                                            <img src={coverUrl} alt={song.name} className="mp-row-cover" />
                                        ) : (
                                            <div className="mp-row-cover mp-row-cover-placeholder">
                                                <Icon name="sparkles" size={16} />
                                            </div>
                                        )}
                                        <div className="mp-row-info">
                                            <div className="mp-row-name">{song.name}</div>
                                            <div className="mp-row-artist">{song.artist.join(', ')}</div>
                                        </div>
                                        <div className="mp-row-actions" onClick={(e) => e.stopPropagation()}>
                                            <IconButton
                                                size="sm"
                                                name="play"
                                                label="播放"
                                                onClick={() => playSong(song)}
                                            />
                                            <IconButton
                                                size="sm"
                                                name="download"
                                                label="下载"
                                                disabled={downloadingSongs.has(song.id)}
                                                onClick={() => handleDownloadSearchSong(song)}
                                            />
                                        </div>
                                    </div>
                                );
                            })}

                            {/* 加载状态 */}
                            {(isLoading || isLoadingMore) && songs.length === 0 && (
                                <div className="mp-list-loading">
                                    <Spinner size={16} />
                                </div>
                            )}
                            {isLoadingMore && songs.length > 0 && (
                                <div className="mp-list-loading">
                                    <Spinner size={16} />
                                </div>
                            )}
                            {!hasMoreResults && songs.length > 0 && !isLoadingMore && (
                                <div className="mp-list-end">已加载全部结果</div>
                            )}
                            {songs.length === 0 && !isLoading && (
                                <EmptyState
                                    icon="search"
                                    title={searchKeyword ? '未找到相关歌曲' : '搜索歌曲'}
                                    description={searchKeyword ? '换个关键词试试' : '输入歌名或歌手，回车搜索'}
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* 音频元素（ended 事件在 useEffect 中统一绑定，避免重复触发下一曲） */}
            <audio ref={audioRef} crossOrigin="anonymous" preload="auto" />

                <style>{`
                    /* ============================================================
                       音乐播放器窗口 — 设计系统 v2「精密仪器」
                       全部使用 styles.css 的 token；无渐变 / 无辉光 / 无玻璃拟态
                       ============================================================ */

                    .mp-root {
                        position: relative;
                        width: 100vw;
                        height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: var(--color-surface-0);
                        color: var(--color-text-1);
                        font-family: var(--font-ui);
                        overflow: hidden;
                    }

                    /* Wails 无边框窗口：仅顶部栏与窗口空白处可拖拽，
                       可点元件一律 no-drag，避免拖拽吞掉点击 */
                    .mp-root button,
                    .mp-root input,
                    .mp-cover-wrap,
                    .mp-progress {
                        --wails-draggable: no-drag;
                    }

                    /* ---------- 顶部工具条 ---------- */

                    .mp-topbar {
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 44px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 0 10px;
                        z-index: 5;
                    }

                    .mp-topbar-side {
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        min-width: 56px;
                    }

                    .mp-topbar-right {
                        justify-content: flex-end;
                    }

                    .mp-tabs {
                        position: absolute;
                        left: 50%;
                        top: 9px;
                        transform: translateX(-50%);
                        display: flex;
                        align-items: center;
                        gap: 2px;
                    }

                    .mp-tab {
                        display: inline-flex;
                        align-items: center;
                        gap: 5px;
                        height: 26px;
                        padding: 0 10px;
                        border: none;
                        border-radius: var(--radius-control);
                        background: transparent;
                        color: var(--color-text-2);
                        font-size: 12px;
                        font-weight: 500;
                        white-space: nowrap;
                        transition:
                            background-color var(--dur-1) ease,
                            color var(--dur-1) ease,
                            transform 100ms ease-out;
                    }

                    .mp-tab:hover {
                        background: rgba(255, 255, 255, 0.07);
                        color: var(--color-text-1);
                    }

                    .mp-tab:active {
                        transform: scale(0.97);
                    }

                    .mp-tab-badge {
                        font-size: 10.5px;
                        line-height: 15px;
                        min-width: 16px;
                        padding: 0 5px;
                        border-radius: 999px;
                        background: rgba(255, 255, 255, 0.08);
                        color: var(--color-text-3);
                        text-align: center;
                    }

                    /* 喜欢（激活态 = 强调色 subtle） */
                    .icon-btn.mp-like.liked,
                    .icon-btn.mp-like.liked:hover:not(:disabled) {
                        color: var(--color-accent-text);
                        background: var(--color-accent-subtle);
                    }

                    /* ---------- 主视图 ---------- */

                    .mp-window {
                        position: relative;
                        z-index: 1;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 16px;
                        padding: 60px 36px 32px;
                        width: 100%;
                        max-width: 380px;
                    }

                    /* ---------- 封面 / 歌词 ---------- */

                    .mp-cover-wrap {
                        position: relative;
                        width: 240px;
                        height: 240px;
                        flex-shrink: 0;
                        cursor: pointer;
                    }

                    .mp-cover {
                        position: absolute;
                        inset: 0;
                        border-radius: var(--radius-card);
                        border: 1px solid var(--color-hairline);
                        background: var(--color-surface-2);
                        overflow: hidden;
                    }

                    .mp-cover-img {
                        display: block;
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                    }

                    .mp-cover-placeholder {
                        width: 100%;
                        height: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: var(--color-text-4);
                    }

                    .mp-cover-loading {
                        position: absolute;
                        inset: 0;
                        z-index: 2;
                        border-radius: var(--radius-card);
                        background: rgba(4, 5, 8, 0.55);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }

                    .mp-lyrics {
                        position: absolute;
                        inset: 0;
                        border-radius: var(--radius-card);
                        border: 1px solid var(--color-hairline);
                        background: var(--color-surface-1);
                        overflow-y: auto;
                        overflow-x: hidden;
                        padding: 14px 10px;
                        scrollbar-width: none;
                        -ms-overflow-style: none;
                    }

                    .mp-lyrics::-webkit-scrollbar {
                        display: none;
                    }

                    .lyrics-line {
                        font-size: 12.5px;
                        line-height: 22px;
                        padding: 4px 8px;
                        color: var(--color-text-4);
                        text-align: center;
                        transition: color var(--dur-1) ease;
                    }

                    .lyrics-line.current {
                        font-size: 14px;
                        font-weight: 550;
                        color: var(--color-text-1);
                    }

                    .lyrics-empty {
                        height: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 20px;
                        font-size: 12px;
                        color: var(--color-text-4);
                        text-align: center;
                    }

                    /* ---------- 歌曲信息 ---------- */

                    .mp-info {
                        text-align: center;
                        max-width: 300px;
                        min-height: 42px;
                    }

                    .mp-title {
                        margin: 0 0 2px;
                        font-size: 13.5px;
                        font-weight: 600;
                        color: var(--color-text-1);
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        max-width: 100%;
                    }

                    .mp-artist {
                        margin: 0;
                        font-size: 12px;
                        color: var(--color-text-3);
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        max-width: 100%;
                    }

                    /* ---------- 进度条（可点跳转，自绘条） ---------- */

                    .mp-progress-row {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        width: 280px;
                    }

                    .mp-time {
                        font-family: var(--font-mono);
                        font-size: 11px;
                        color: var(--color-text-3);
                        min-width: 38px;
                    }

                    .mp-time-current {
                        text-align: right;
                    }

                    /* 16px 高的可点击热区，视觉条只有 4px */
                    .mp-progress {
                        position: relative;
                        flex: 1;
                        height: 16px;
                        display: flex;
                        align-items: center;
                        cursor: pointer;
                    }

                    .mp-progress-track {
                        width: 100%;
                        height: 4px;
                        border-radius: 999px;
                        background: rgba(255, 255, 255, 0.07);
                        overflow: hidden;
                    }

                    .mp-progress-fill {
                        height: 100%;
                        border-radius: 999px;
                        background: var(--color-accent);
                        transition: width 100ms linear;
                    }

                    .mp-progress-dot {
                        position: absolute;
                        top: 50%;
                        width: 10px;
                        height: 10px;
                        border-radius: 50%;
                        background: var(--color-accent);
                        transform: translate(-50%, -50%);
                        opacity: 0;
                        transition: opacity var(--dur-1) ease;
                        pointer-events: none;
                    }

                    .mp-progress:hover .mp-progress-dot {
                        opacity: 1;
                    }

                    /* ---------- 播放控制 ---------- */

                    .mp-controls {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }

                    .mp-root .icon-btn:disabled {
                        opacity: 0.4;
                    }

                    /* 主播放键：放大 + 唯一强调色面积 */
                    .icon-btn.mp-play-main {
                        width: 44px;
                        height: 44px;
                        border-radius: 999px;
                        background: var(--color-accent);
                        color: #fff;
                    }

                    .icon-btn.mp-play-main:hover:not(:disabled) {
                        background: var(--color-accent-hover);
                        color: #fff;
                    }

                    .icon-btn.mp-play-main:active:not(:disabled) {
                        background: var(--color-accent-pressed);
                        transform: scale(0.96);
                    }

                    .icon-btn.mp-play-main svg {
                        width: 20px;
                        height: 20px;
                    }

                    /* ---------- 列表视图（喜欢 / 热门 / 搜索） ---------- */

                    .mp-list {
                        position: absolute;
                        inset: 0;
                        z-index: 20;
                        background: var(--color-surface-0);
                        display: flex;
                        flex-direction: column;
                        padding: 10px 12px 12px;
                    }

                    .mp-list-topbar {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        flex-shrink: 0;
                        margin-bottom: 10px;
                    }

                    .mp-list-topbar-spacer {
                        flex: 1;
                    }

                    .mp-list-title {
                        font-size: 13px;
                        font-weight: 600;
                        color: var(--color-text-1);
                    }

                    .mp-list-scroll {
                        flex: 1;
                        min-height: 0;
                        overflow-y: auto;
                        overflow-x: hidden;
                        display: flex;
                        flex-direction: column;
                        align-items: stretch;
                    }

                    .mp-row {
                        padding: 6px 8px;
                        flex-shrink: 0;
                    }

                    .mp-row-cover {
                        width: 40px;
                        height: 40px;
                        border-radius: var(--radius-card);
                        border: 1px solid var(--color-hairline);
                        background: var(--color-surface-2);
                        object-fit: cover;
                        flex-shrink: 0;
                    }

                    .mp-row-cover-placeholder {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: var(--color-text-4);
                    }

                    .mp-row-info {
                        flex: 1;
                        min-width: 0;
                    }

                    .mp-row-name {
                        font-size: 12.5px;
                        font-weight: 500;
                        color: var(--color-text-1);
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }

                    .mp-row-artist {
                        margin-top: 1px;
                        font-size: 11.5px;
                        color: var(--color-text-3);
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }

                    .mp-row-meta {
                        flex-shrink: 0;
                        font-size: 11px;
                        color: var(--color-text-4);
                    }

                    .mp-row-actions {
                        display: flex;
                        align-items: center;
                        gap: 2px;
                        flex-shrink: 0;
                    }

                    .mp-list-loading {
                        display: flex;
                        justify-content: center;
                        padding: 16px;
                    }

                    .mp-list-end {
                        padding: 12px;
                        font-size: 11.5px;
                        color: var(--color-text-4);
                        text-align: center;
                    }

                    .mp-list .empty-state {
                        padding: 32px 16px;
                    }

                    /* ---------- 搜索框 ---------- */

                    .mp-search-wrap {
                        position: relative;
                        flex: 1;
                        min-width: 0;
                        display: flex;
                        align-items: center;
                    }

                    .mp-search-icon {
                        position: absolute;
                        left: 9px;
                        top: 50%;
                        transform: translateY(-50%);
                        color: var(--color-text-4);
                        pointer-events: none;
                    }

                    .mp-search-input {
                        padding-left: 28px;
                    }
                `}</style>
            </>
        );
    }
