import { Link } from 'react-router-dom';
import { Bookmark, GitBranch, Search, Share2 } from 'lucide-react';
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
          <GitBranch size={22} />
        </span>
        知路<span className="qm-brand-caption">从一个问题，走向下一个</span>
      </Link>
      <div className="qm-header-actions">
        <button
          className="qm-search-trigger"
          aria-label="搜索知乎问题"
          onClick={() => openSearch(null)}
        >
          <Search size={17} />
          <span>搜索知乎问题</span>
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
