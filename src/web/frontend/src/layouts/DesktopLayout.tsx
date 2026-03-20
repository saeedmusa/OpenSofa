import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { useResponsive } from '../hooks/useResponsive';

export function DesktopLayout() {
  const { isDesktop } = useResponsive();

  if (!isDesktop) {
    return <Outlet />;
  }

  return (
    <div className="flex h-screen bg-void">
      <Sidebar />
      <main className="flex-1 overflow-hidden bg-void ml-80">
        <Outlet />
      </main>
    </div>
  );
}
