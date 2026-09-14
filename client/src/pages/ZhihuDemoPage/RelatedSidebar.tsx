import { useEffect, useRef, useState } from 'react';
import { GitBranch, X } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';
import type { RelatedRequest } from '../../../../shared/related-tree';
import type { RelatedState } from './use-related-tree';
import { RelatedTreeView } from './RelatedTreeView';
interface Props {
  current: RelatedRequest;
  state: RelatedState;
  retry: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}
export function RelatedSidebar({
  current,
  state,
  retry,
  open,
  setOpen,
}: Props) {
  const [drawer, setDrawer] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const resize = () => {
      if (!media.matches) setDrawer(false);
    };
    media.addEventListener('change', resize);
    return () => media.removeEventListener('change', resize);
  }, []);
  const close = () => {
    setOpen(false);
    heading.current?.focus({ preventScroll: true });
  };
  const content = (
    <RelatedTreeView
      current={current}
      state={state}
      retry={retry}
      onSelect={() => {
        if (drawer) {
          setDrawer(false);
          setOpen(false);
        }
      }}
    />
  );
  return (
    <>
      <section
        className="zd-panel zd-related-desktop"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.stopPropagation();
            close();
          }
        }}
      >
        <button
          ref={heading}
          className="zd-related-toggle"
          aria-expanded={open}
          aria-controls="related-desktop-tree"
          onClick={() => setOpen(!open)}
        >
          <GitBranch size={17} />
          <strong>相关问题</strong>
          <span>{open ? '收起' : '展开'}</span>
        </button>
        <div id="related-desktop-tree" hidden={!open}>
          {content}
        </div>
      </section>
      <Dialog
        open={drawer}
        onOpenChange={(value) => {
          setDrawer(value);
          setOpen(value);
        }}
      >
        <DialogTrigger asChild>
          <button ref={trigger} className="zd-related-mobile-trigger">
            <GitBranch size={17} />
            相关问题
          </button>
        </DialogTrigger>
        <DialogContent
          className="zd-related-drawer"
          showCloseButton={false}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus({ preventScroll: true });
          }}
        >
          <div className="zd-related-drawer-heading">
            <DialogTitle>相关问题</DialogTitle>
            <DialogClose aria-label="关闭相关问题">
              <X size={20} />
            </DialogClose>
          </div>
          <DialogDescription>
            选择问题继续探索，展开回答片段查看知乎来源。
          </DialogDescription>
          {content}
        </DialogContent>
      </Dialog>
    </>
  );
}
