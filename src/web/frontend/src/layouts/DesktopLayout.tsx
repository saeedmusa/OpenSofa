import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { NewSessionModal } from '../components/NewSessionModal';
import { useResponsive } from '../hooks/useResponsive';

export function DesktopLayout() {
  const { isDesktop } = useResponsive();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const handleOpenModal = () => setIsModalOpen(true);
    window.addEventListener('open-new-session-modal', handleOpenModal);
    return () => window.removeEventListener('open-new-session-modal', handleOpenModal);
  }, []);

  if (!isDesktop) {
    return <Outlet />;
  }

  return (
    <div className="flex h-screen bg-void">
      <Sidebar />
      <main className="flex-1 overflow-hidden bg-void ml-80">
        <Outlet />
      </main>
      
      <NewSessionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
}
