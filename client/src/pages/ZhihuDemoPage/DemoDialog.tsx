import { authClient } from '@lark-apaas/client-toolkit/auth';
import { resolveAppUrl } from '@lark-apaas/client-toolkit/utils/resolveAppUrl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { clearDemoHistory } from '../../api';
import type { DemoArticle } from '../../../../shared/api.interface';
import type { DemoAccountState } from './use-demo-account';
interface Props {
  state: DemoAccountState;
  modal: string;
  setModal: (s: string) => void;
  article?: DemoArticle;
}
const path = (id: string) => `/question/${id}/answer/demo`;
export function DemoDialog({ state, modal, setModal, article }: Props) {
  const { busy, mutate } = state;
  return (
    <Dialog
      open={!!modal}
      onOpenChange={(open) => {
        if (!open) setModal('');
      }}
    >
      <DialogContent className="zd-dialog">
        <DialogHeader>
          <DialogTitle>
            {modal === 'login'
              ? '登录，留下你的每一次发现'
              : modal === 'clear-history'
                ? '清空浏览记录？'
                : modal === 'about'
                  ? '关于此演示'
                  : modal === 'messages'
                    ? '消息'
                    : modal === 'inbox'
                      ? '私信'
                      : modal === 'share'
                        ? '分享这个问题'
                        : modal === 'votes'
                          ? '赞同这个回答'
                          : modal.replace('feature:', '')}
          </DialogTitle>
          <DialogDescription>
            {modal === 'login'
              ? '使用飞书 / 妙搭应用账号登录。收藏、浏览记录和设置会跟随你的账号保存。此处不需要填写知乎密码。'
              : modal === 'clear-history'
                ? '将删除当前账号的全部浏览记录。收藏、关注和其他设置会保留。此操作无法撤销。'
                : modal === 'about'
                  ? '黑客松功能演示底座，复刻知乎推荐、详情与设置页。文章、作者与计数为原创演示素材；账号与数据独立于知乎。'
                  : modal === 'messages' || modal === 'inbox'
                    ? '暂无消息。此演示尚未开放消息收发。'
                    : modal === 'share'
                      ? '复制下方链接，即可分享此问题。链接不包含你的个人数据。'
                      : modal === 'votes'
                        ? '点击「赞同」保存你的态度，再次点击可以取消。显示的基础计数为演示数据。'
                        : '此演示暂未开放这项功能。你可以浏览问题、阅读全文，并使用收藏、赞同、关注和个人数据管理。'}
          </DialogDescription>
        </DialogHeader>
        {modal === 'login' && (
          <button
            className="zd-primary"
            onClick={() => authClient.session.redirectToLogin()}
          >
            使用应用账号登录
          </button>
        )}
        {modal === 'clear-history' && (
          <div className="zd-dialog-buttons">
            <button className="zd-outline" onClick={() => setModal('')}>
              取消
            </button>
            <button
              className="zd-danger"
              disabled={busy}
              onClick={() =>
                void mutate(async () => {
                  await clearDemoHistory();
                  setModal('');
                }, '浏览记录已清空')
              }
            >
              确认清空
            </button>
          </div>
        )}
        {modal === 'share' && (
          <Input
            readOnly
            value={resolveAppUrl(article ? path(article.id) : '/')}
            onFocus={(e) => e.target.select()}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
