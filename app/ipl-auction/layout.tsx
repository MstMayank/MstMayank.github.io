import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './auction.css';
export const metadata:Metadata={title:{default:'IPL 2027 Auction Room | The Cricket Space',template:'%s | The Cricket Space'},description:'Your franchise. Your calls. A custom IPL 2027 retention simulation by The Cricket Space.'};
export default function AuctionLayout({children}:{children:ReactNode}){return <div className="auction-app"><header className="auction-nav"><a className="auction-brand" href="/">THE CRICKET <span>SPACE</span></a><a className="back-home" href="/">← Cricket Space</a></header><main className="auction-shell">{children}</main><footer className="auction-footer"><span>THE CRICKET SPACE / FAN-BUILT, GAME-READY.</span><span>Custom simulation. Not affiliated with the IPL or BCCI.</span></footer></div>;}
