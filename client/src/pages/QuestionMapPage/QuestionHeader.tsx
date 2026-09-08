import { Link } from 'react-router-dom';
import { Bookmark, Search, Share2 } from 'lucide-react';
interface Props {
  save: () => void;
  share: () => void;
  openSearch: (id: string | null) => void;
}
export default function QuestionHeader({ save, share, openSearch }: Props) {
  return (
    <header className="qm-header">
      <Link to="/map" className="qm-brand" aria-label="知路首页">
        <span className="qm-brand-mark">
          <svg
            viewBox="0 0 36 36"
            width="32"
            height="32"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M8 26V15a7 7 0 017-7h13M8 26h13a7 7 0 007-7V8"
              stroke="currentColor"
              strokeWidth="2.5"
            />
            <circle cx="8" cy="26" r="4" fill="currentColor" />
            <circle cx="28" cy="8" r="4" fill="currentColor" />
          </svg>
        </span>
        知路<span className="qm-brand-caption">每个问题，都有下一步。</span>
      </Link>
      <div className="qm-header-actions">
        <button
          className="qm-search-trigger"
          aria-label="搜索问题"
          onClick={() => openSearch(null)}
        >
          <Search size={17} />
          <span>搜索问题</span>
        </button>
        <button className="qm-icon" onClick={save} aria-label="保存当前路径">
          <Bookmark size={18} />
        </button>
        <button className="qm-share" onClick={share}>
          <Share2 size={16} />
          <span>分享路径</span>
        </button>
      </div>
    </header>
  );
}
