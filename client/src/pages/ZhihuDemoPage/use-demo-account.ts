import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getDemoAccount, setDemoActivity } from '../../api';
import type {
  DemoAccount,
  DemoActivityKind,
} from '../../../../shared/api.interface';

export function useDemoAccount(onLogin: () => void) {
  const [account, setAccount] = useState<DemoAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const refresh = useCallback(async () => {
    setError('');
    try {
      setAccount(await getDemoAccount());
    } catch (e) {
      setError(e instanceof Error ? e.message : '账号数据加载失败');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const has = (kind: DemoActivityKind, id: string) =>
    !!account?.activity.some((a) => a.kind === kind && a.targetId === id);
  async function mutate(action: () => Promise<unknown>, message: string) {
    if (loading) {
      toast('正在读取登录状态');
      return;
    }
    if (error) {
      toast.error(error);
      return;
    }
    if (!account) {
      onLogin();
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await action();
      await refresh();
      if (message) toast.success(message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '保存失败，请重试');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function toggle(kind: DemoActivityKind, id: string) {
    const enabled = !has(kind, id);
    void mutate(
      () => setDemoActivity(kind, id, enabled),
      enabled ? '已保存到你的账号' : '已取消',
    );
  }
  return {
    account,
    loading,
    error,
    busy,
    refresh,
    has,
    mutate,
    toggle,
    setAccount,
  };
}
export type DemoAccountState = ReturnType<typeof useDemoAccount>;
