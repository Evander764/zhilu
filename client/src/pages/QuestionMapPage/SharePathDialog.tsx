import { ExternalLink } from 'lucide-react';
import { Input } from '../../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '../../components/ui/dialog';
interface Props {
  shareUrl: string;
  setShareUrl: (url: string) => void;
  copyShare: () => Promise<void>;
}
export default function SharePathDialog({
  shareUrl,
  setShareUrl,
  copyShare,
}: Props) {
  return (
    <Dialog
      open={Boolean(shareUrl)}
      onOpenChange={(open) => {
        if (!open) setShareUrl('');
      }}
    >
      <DialogContent className="qm-share-dialog">
        <DialogTitle>把这条路分享出去</DialogTitle>
        <DialogDescription>
          链接只包含公开问题与探索顺序，不包含搜索文字或身份信息。
        </DialogDescription>
        <Input
          aria-label="公开路径分享链接"
          value={shareUrl}
          readOnly
          onFocus={(e) => e.target.select()}
        />
        <button className="qm-primary" onClick={() => void copyShare()}>
          复制分享链接
        </button>
        <a href={shareUrl} target="_blank" rel="noopener noreferrer">
          打开接收页面
          <ExternalLink size={14} />
        </a>
      </DialogContent>
    </Dialog>
  );
}
