
import Navbar from '@/components/app_layout/Navbar';

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
      <div className="min-h-screen bg-gray-50">
        <main>
          <Navbar/>
          {children}
        </main>
      </div>
  );
}

