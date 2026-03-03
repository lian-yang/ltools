import { MusicPlayerWidget } from '../widgets/MusicPlayerWidget';

export function MusicPlayerPage() {
    return (
        <div className="music-player-page">
            <MusicPlayerWidget />
            <style>{`
                .music-player-page {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: transparent !important;
                    background-color: transparent !important;
                }

                /* 强制覆盖全局 body 样式 */
                body {
                    background: transparent !important;
                    background-color: transparent !important;
                }
            `}</style>
        </div>
    );
}
